# Air Nexus — AirGPT

## Local HTTPS setup

AirGPT uses a locally trusted HTTPS certificate for development. API requests stay on the same HTTPS origin, so chat, voice input, TTS, clipboard access, and other secure browser features do not create mixed-content requests.

### 1. Create and trust the local certificate

```powershell
npm run setup:https
```

On Windows this uses an installed `mkcert` command when available, otherwise it downloads the pinned official mkcert binary into the ignored `.tools/` directory. It installs mkcert's local certificate authority and creates ignored files in `.certs/` for `localhost`, `127.0.0.1`, and `::1`. Never commit those certificate files or the generated private key. If both official mkcert download endpoints are blocked, the script uses Git's bundled OpenSSL to create and trust one CA-disabled certificate restricted to those loopback names; this is narrower than trusting a local CA.

macOS users can install mkcert with `brew install mkcert`; Linux users should use their distribution package or the official mkcert release before running the equivalent `mkcert -install` and certificate command.

### 2. Configure local environment variables

Copy `.env.example` to `.env.local`, then add your server-side Groq key:

```env
LOCAL_HTTPS=true
API_URL=https://localhost:3000
GROQ_API_KEY=your_server_side_key
```

Only variables prefixed with `NEXT_PUBLIC_` are exposed by Next.js to browser code. Keep API keys unprefixed and access them only from server routes.

### 3. Run AirGPT

```powershell
npm install
npm run dev
```

Open [https://localhost:3000](https://localhost:3000). The browser should show a normal trusted connection without a certificate warning. Do not use the old `http://localhost:3000` address.

If the certificate files are missing, rerun `npm run setup:https`. To remove the localhost-only fallback certificate from the user trust store, run `certutil -user -delstore Root (Get-Content .certs/localhost-thumbprint.txt)`. If a browser was open while mkcert installed its certificate authority, restart the browser once so it reloads the operating-system trust store.

## Local API and CORS behavior

- Browser requests use the current page origin, for example `https://localhost:3000/api/chat`; no private server URL or key is bundled into frontend code.
- Same-origin requests need no CORS exception.
- Development CORS responses are restricted to the configured `API_URL` plus trusted HTTPS loopback origins. Unknown origins are not granted access.
- `OPTIONS` preflight requests are supported for local API routes.

## Nexus Points and student tools

The local demo persists the current plan, plan expiry, Nexus Points balance, one-time reward IDs, and the transaction ledger in browser `localStorage`. Users earn 25 points once per daily login, 10 points the first time each task is completed, and the configured streak rewards. Marketplace plan and store redemptions validate the balance before points are deducted.

The Calculators page includes:

- Grade Calculator (Free): multiple assessments, weighting validation, current/weighted grade, and target-grade planning.
- ATAR Calculator (Plus): VCE subject search/dropdowns, raw study scores, automatic year-aware scaling, a subject breakdown, estimated aggregate/range, and the required VTAC disclaimer.
- Graphing Calculator (Premium): safe expressions, multiple functions, x/y ranges, zoom, reset, clear, and invalid-expression errors.

VCE scaling estimates live in `lib/atar/atar-scaling-data.ts`. Add a new year-versioned table there when official data is available; the calculator logic and UI do not need to change. Current values are explicitly marked as illustrative placeholders, not official VTAC data.

Grade and ATAR results can be saved to the on-device calculator history. To manually test plan gates, open Marketplace, activate or redeem a plan, then revisit Calculators. Clear the site data for `https://localhost:3000` to reset all demo account and reward state.
## Quality checks

```powershell
npm run lint
npm run typecheck
npm run test:atar
npm run build
```
### Port 3000 is already in use

If Next.js reports `EADDRINUSE`, a previous AirGPT dev server is still running. Stop only the stale AirGPT listener, then restart:

```powershell
npm run dev:stop
npm run dev
```

The stop helper verifies that the listener belongs to this AirGPT Next.js project before terminating it. It will not stop an unrelated application using port 3000.
