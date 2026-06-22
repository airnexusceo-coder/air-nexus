param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)

if ($listeners.Count -eq 0) {
  Write-Host "Port $Port is already free." -ForegroundColor Green
  exit 0
}

$processIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($processId in $processIds) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
  $commandLine = [string]$process.CommandLine
  $isThisProject = $commandLine.IndexOf($projectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
  $isNextServer = $commandLine -match 'node_modules[\\/]next[\\/]dist[\\/]server'

  if (-not ($isThisProject -and $isNextServer)) {
    throw "Port $Port is used by another application (PID $processId). It was not stopped."
  }

  Stop-Process -Id $processId -Force
  Write-Host "Stopped the stale AirNexus dev server (PID $processId)." -ForegroundColor Yellow
}

Start-Sleep -Milliseconds 500
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "Port $Port is still occupied."
}

Write-Host "Port $Port is ready. Run: npm run dev" -ForegroundColor Green
