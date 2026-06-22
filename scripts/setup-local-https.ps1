$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$certificateDirectory = Join-Path $projectRoot '.certs'
$certificatePath = Join-Path $certificateDirectory 'localhost.pem'
$keyPath = Join-Path $certificateDirectory 'localhost-key.pem'

$mkcertCommand = Get-Command mkcert -ErrorAction SilentlyContinue
$toolsDirectory = Join-Path $projectRoot '.tools'
$localMkcert = Join-Path $toolsDirectory 'mkcert.exe'
$mkcertPath = if ($mkcertCommand) { $mkcertCommand.Source } elseif ((Test-Path $localMkcert) -and (Get-Item $localMkcert).Length -gt 1MB) { $localMkcert } else { $null }

if (-not $mkcertPath) {
  $version = '1.4.4'
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
  $downloadUrls = @(
    "https://dl.filippo.io/mkcert/v${version}?for=windows/$architecture",
    "https://github.com/FiloSottile/mkcert/releases/download/v${version}/mkcert-v${version}-windows-$architecture.exe"
  )
  $downloadPath = "$localMkcert.download"
  New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
  Remove-Item -LiteralPath $localMkcert -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
  Write-Host 'Downloading the official mkcert binary for this project...' -ForegroundColor Cyan
  foreach ($downloadUrl in $downloadUrls) {
    & curl.exe --fail --location --ssl-revoke-best-effort --retry 3 --retry-all-errors --retry-delay 2 --silent --show-error --output $downloadPath $downloadUrl
    if ($LASTEXITCODE -eq 0 -and (Test-Path $downloadPath) -and (Get-Item $downloadPath).Length -gt 1MB) { break }
    Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path $downloadPath) -or (Get-Item $downloadPath).Length -le 1MB) {
    Write-Host 'mkcert download was blocked; using a localhost-only trusted certificate fallback.' -ForegroundColor Yellow
    $opensslCandidates = @(
      'C:\Program Files\Git\usr\bin\openssl.exe',
      'C:\Program Files\Git\mingw64\bin\openssl.exe'
    )
    $opensslPath = $opensslCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $opensslPath) { throw 'mkcert download failed and OpenSSL is not available for the localhost-only fallback.' }

    New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
    Remove-Item -LiteralPath $certificatePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $keyPath -Force -ErrorAction SilentlyContinue
    & $opensslPath req -x509 -newkey rsa:2048 -sha256 -days 397 -nodes -keyout $keyPath -out $certificatePath -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1' -addext 'basicConstraints=critical,CA:FALSE' -addext 'keyUsage=critical,digitalSignature,keyEncipherment' -addext 'extendedKeyUsage=serverAuth'
    if ($LASTEXITCODE -ne 0) { throw 'OpenSSL could not generate the localhost-only certificate.' }

    & certutil.exe -user -addstore Root $certificatePath
    if ($LASTEXITCODE -ne 0) { throw 'Windows could not trust the localhost-only certificate.' }
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificatePath)
    [System.IO.File]::WriteAllText((Join-Path $certificateDirectory 'localhost-thumbprint.txt'), $certificate.Thumbprint)

    Write-Host ''
    Write-Host 'Trusted localhost-only HTTPS is ready.' -ForegroundColor Green
    Write-Host 'Start AirNexus with: npm run dev' -ForegroundColor Green
    Write-Host 'Open: https://localhost:3000' -ForegroundColor Green
    exit 0
  }
  Move-Item -LiteralPath $downloadPath -Destination $localMkcert -Force
  Unblock-File -LiteralPath $localMkcert -ErrorAction SilentlyContinue
  $mkcertPath = $localMkcert
}

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

Write-Host 'Installing the mkcert local certificate authority...' -ForegroundColor Cyan
& $mkcertPath -install
if ($LASTEXITCODE -ne 0) { throw 'mkcert could not install its local certificate authority.' }

Write-Host 'Generating a certificate for localhost, 127.0.0.1, and ::1...' -ForegroundColor Cyan
& $mkcertPath -cert-file $certificatePath -key-file $keyPath localhost 127.0.0.1 '::1'
if ($LASTEXITCODE -ne 0) { throw 'mkcert could not generate the localhost certificate.' }

Write-Host ''
Write-Host 'Trusted local HTTPS is ready.' -ForegroundColor Green
Write-Host 'Start AirNexus with: npm run dev' -ForegroundColor Green
Write-Host 'Open: https://localhost:3000' -ForegroundColor Green
