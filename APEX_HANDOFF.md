# Apex Handoff — Nexus Vault

This document reflects Apex **as actually built**, not a future plan. Apex is a feature *inside* AirGPT (not a separate app, not a realtime arena game) built around a persistent **Nexus Vault** economy and an asynchronous, server-resolved **breach** system. Two earlier directions ("Nexus Clash", "Core Control" as a separate app) were built and fully removed earlier in this same development history — see §27 for what's deprecated and why nothing from them should be reused.

The breach resolver — the core remaining feature from the previous handoff revision — is now fully implemented, tested, and reviewed. This revision documents that as-built state honestly, including what was and wasn't runtime-verified.

---

## 1. Product structure

```
AIRNEXUS                                (overall brand/ecosystem)
└── AIRGPT                              (the main application — unchanged)
    ├── Study features (AI Tutor, Flashcards, Revision, Nexus Library, …)
    └── APEX                            (a workspace section, not a separate app)
        └── Nexus Vault economy/strategy game + breach combat
```

One AirNexus account, one Supabase auth session, one profile, one friend graph. Apex has no separate login, shell, or top-level route — it's reached the same way "Marketplace" or "Calculators" are: a `navItems` entry (`lib/data.ts`) that sets `activeSection = 'Apex'` inside the existing AirGPT workspace (`components/workspace.tsx`).

## 2. What Apex is

An **asynchronous** strategy/economy game with a turn-based combat layer. No realtime arena, no reflex combat, no requirement that both players be online. Every player owns a **Nexus Vault** that generates and spends **Core Energy** continuously, including while offline. Players build a defence chain, then asynchronously **breach** friends' Vaults — a multi-step, decision-driven session resolved entirely server-side, one action per request, never a live session both players watch simultaneously.

## 3. Core game loop

Study → earn Nexus Points → acquire technology in the Systems Lab → install it in Manage Vault (spends Core Energy + capacity) → the Vault generates/spends Core Energy over time → equip a breach loadout and commit a budget → play through the breach turn by turn (Scan / Probe / Overload / deploy a tool / Retreat) against the target's real, hidden defence chain → Clash XP, a Core Energy reward, and achievements are awarded on completion → review Breach History and the defender's own Breach Alerts feed → adapt strategy.

## 4. Resources

| Resource | Symbol | Purpose | Where it lives |
|---|---|---|---|
| **Nexus Points** | ✦ | Buy technology *ownership* (permanent) | Existing AirGPT client-side balance — see §19 |
| **Core Energy** | ◇ | *Power* owned technology: upkeep, repairs, scans, breach budgets, breach actions | `apex_vaults.core_energy` — fully server-authoritative |
| **Clash XP** | — | Competitive progression → Apex Rank | `apex_profiles.apex_xp` — fully server-authoritative, awarded by `apex_finalize_breach` |

Owning a technology is not the same as it running for free — installed defence tech still costs ongoing Core Energy upkeep, and breach tools cost per-use activation energy.

## 5. The Nexus Vault

One per account (`apex_vaults`, seeded on signup). Fields: `core_energy`, `vault_integrity` (0–100, starts at 100), `generator_level` (starts at 1), `energy_storage_capacity` (default 5,000), `auto_repair_enabled`/`auto_repair_reserve`, `breaches_enabled`, `last_economy_resolved_at`. New accounts are honestly zeroed: 0 Core Energy, 100% Integrity, no defences installed.

## 6. Core Energy economy

- **Generation**: `generator_level × 100` CE/hour (`GENERATOR_OUTPUT_PER_LEVEL_PER_HOUR` in `lib/apex/vault/config.ts`, kept in sync by hand with the hardcoded value in the SQL resolver — see §7).
- **Upkeep**: sum of `upkeep_energy_per_hour` for every *enabled* installed defence.
- **Net flow**: output − upkeep. Shown on the Vault card; if negative, the UI shows an estimated "reserves last Xh Ym" computed from real state.
- **Storage cap**: energy generated beyond `energy_storage_capacity` is lost (clamped).
- **Auto-shutdown**: if projected upkeep would exceed available energy, the *lowest energy-priority* enabled defence(s) are automatically disabled inside the resolver — real, not just a UI concept.

## 7. Economy resolution (the trusted implementation)

**`apex_resolve_vault_economy(p_user_id uuid)`** (`SECURITY DEFINER`, migration `0003`) is the single place elapsed-time math happens: row-locks the vault, computes `elapsed = now() - last_economy_resolved_at` (server clock only), applies generator output clamped to capacity, charges upkeep in `energy_priority` order (auto-disabling what can't be afforded), updates `core_energy`/`last_economy_resolved_at`, records an `apex_transactions` row. `resolveVaultEconomy(userId)` (`lib/apex/vault/economy.ts`) calls it via the service-role client; every route that reads or mutates a Vault calls it first ("lazy" resolution on access — correct, not a shortcut; no cron required).

Other atomic primitives, all `SECURITY DEFINER`, row-locked, and **revoked from `public`/`anon`/`authenticated`** (only callable via the service-role client): `apex_adjust_core_energy` (general spend/credit), `apex_repair_vault` (atomic CE→Integrity), and — new this revision — `apex_award_achievement`, `apex_create_breach_layers`, `apex_finalize_breach`, `apex_breach_take_action` (migration `0004`).

## 8. Defence capacity

Fixed at **8** (`DEFENCE_CAPACITY` in `lib/apex/vault/config.ts`) — a game-balance constant, not a per-user DB column. Installing a defence consumes capacity for as long as it's *installed*; deactivating to save energy does not free the slot, only uninstalling does.

## 9. Defence technology (seeded catalog, fully wired)

8 defence + 8 breach technologies, seeded idempotently into `apex_technologies` (migration `0003`; migration `0004` adds `counters_technology_id` to link 5 breach techs to the defence tech they counter). **All costs are explicit starting balance, not final** — tune via that table, never hardcode elsewhere.

| Slug | Capacity | Startup | Upkeep/hr | Countered by (breach) |
|---|---|---|---|---|
| mirage | 1 | ◇120 | ◇8 | True Signal |
| firewall | 2 | ◇200 | ◇15 | Phase Signal |
| core-lock | 2 | ◇260 | ◇6 | Breach Key |
| core-shield | 2 | ◇180 | ◇30 | Overclock |
| ghost-layer | 2 | ◇190 | ◇12 | Deep Scan |
| counter-trace | 1 | ◇100 | ◇5 | — |
| signal-redirect | 2 | ◇220 | ◇18 | — |
| fortress-core | 3 | ◇400 | ◇45 | — |

Systems Lab (`POST /api/apex/technologies`) acquires ownership. **Manage Vault now has a dedicated "Owned, Not Installed" panel** listing every owned-but-uninstalled defence technology with an **Install** button (`POST /api/apex/vault/defences` `action: 'install'`) — this closes a gap from the previous revision where acquiring a technology had no follow-up UI path to actually install it.

## 10. Energy priority & defence order

Each installed defence has an independent `defence_order` (the sequence an attacker's breach layers are built from — now live, see §12) and `energy_priority` (which system shuts down first on a deficit — live since §7). Both reorderable via move-up/move-down controls in Manage Vault (no drag-and-drop — no accessible DnD primitive exists in this codebase).

## 11. Vault Integrity

0–100, starts at 100. `POST /api/apex/vault/repair` restores it in 10%-increments at ◇250 per increment (`repairCostForPercent()` in `lib/apex/vault/config.ts`, `Math.ceil` on partial percentages — the Manage Vault UI calls this same function so the displayed price always matches what's charged). **Auto-Repair** (`auto_repair_enabled`/`auto_repair_reserve`) is a real, persisted setting. A successful breach against you now genuinely damages Integrity (`BREACH_INTEGRITY_DAMAGE = 15` per breach, `apex_finalize_breach`) — but the automatic *consumption* of the Auto-Repair reserve in response to that damage is still not wired to anything; the setting exists and is honestly displayed, nothing currently spends from it automatically. This is the one piece of §5-era "not yet implemented" scope that remains genuinely open — see §24.

## 12. Breach system — fully implemented

A breach is created via `POST /api/apex/breach` (`startBreach()`): validates the target is an accepted friend, has breaches enabled, isn't rate-limited or under post-breach protection, resolves the attacker's economy, atomically commits the breach budget, creates an `apex_breach_sessions` row (`status: 'active'`, `expires_at` = now + 30 min), records the equipped loadout (ownership-verified server-side), then calls `apex_create_breach_layers` to snapshot the **defender's current active defence chain** into exactly 3 layers (Outer Perimeter / Inner Sanctum / Core Gate — see §13 for why this is a snapshot, not live state).

**Compensating transaction, not a single atomic write**: session creation, loadout insert, and layer-snapshot creation are 3 separate PostgREST calls (no cross-call DB transaction is available from this client). If loadout or layer creation fails after the budget was committed, `startBreach()` catches it, marks the session `abandoned`+`finalized`, and refunds the committed Core Energy via a positive `apex_adjust_core_energy` call — the attacker is never left charged with a broken session. This is a disclosed design tradeoff, not a hidden gap.

The breach then plays out turn by turn: `GET /api/apex/breach/[id]` (attacker-only, 403 otherwise) returns the sanitised current state; `POST /api/apex/breach/[id]/action` submits one decision (`scan` / `probe` / `overload` / `use_tool` / `retreat`) and returns the newly-resolved state. All resolution math lives in one `SECURITY DEFINER` function, `apex_breach_take_action` (migration `0004`) — the client never computes an outcome.

## 13. The 3-layer / defence-snapshot model

A breach always has exactly 3 layers regardless of Vault size — a deliberate design choice for a consistent, UI-friendly shape:

- **Layer 0 (Outer Perimeter)**: the defender's first active defence by `defence_order` (or a strength-60 baseline if none).
- **Layer 1 (Inner Sanctum)**: the second active defence (or strength-70 baseline).
- **Layer 2 (Core Gate)**: a strength-80 baseline plus half the `startup_energy_cost` of every further active defence folded in — so having more than two active defences still genuinely raises the final gate's strength, without needing an unbounded layer count.

**Snapshot, not live state**: layers are built once, at breach creation, from the defender's active defences *at that moment* (`apex_create_breach_layers`). If the defender edits their Vault mid-breach, the in-progress breach is unaffected — chosen for fairness/reproducibility, and so the attacker's session never has to query the defender's live private tables. This is documented in the migration `0004` header as an explicit decision, not an oversight.

Five conceptual stages map onto this without a separate stage column: **SCAN** (an optional reveal action on the current layer, folded into layer 0's flow) → **OUTER** (layer 0) → **DEEP** (layer 1) → **CORE** (layer 2) → **RESULT** (session finalised). `apex_breach_sessions.current_layer_index` is the single source of truth for progress.

## 14. Breach actions and resolution math

All constants live in `lib/apex/vault/breach-config.ts` (TypeScript, display-only preview values) and are mirrored **by hand** in `apex_breach_take_action`/`apex_finalize_breach` (SQL, authoritative — SQL can't import TS). Per-action:

| Action | Cost | Base pressure (fraction of layer strength) |
|---|---|---|
| Scan | ◇10 | 0 (reveals the layer's identity only; once per layer) |
| Probe | ◇20 | 22% |
| Overload | ◇60 | 40% |
| Use Tool (matched counter) | tool's `activation_energy_cost` | 68% |
| Use Tool (mismatched) | tool's `activation_energy_cost` | 30% |

Every pressure roll applies a bounded, **auditable** random factor (`0.85`–`1.15`, computed server-side with SQL `random()`, never client `Math.random()`) and is stored in the event's JSON payload for full auditability — strategy dominates, some uncertainty remains. A layer survives at most `MAX_ACTIONS_PER_LAYER` (4) actions or until `breach_energy_remaining` drops below `MIN_VIABLE_BREACH_ENERGY` (15), whichever comes first — either ends the breach as `contained`. Breaking layer 2 ends it as `breached`. `retreat` ends it as `retreated` immediately, no penalty beyond energy already spent. An expired (30-minute-old) still-`active` session auto-resolves as `contained` on its next touch.

Breach tools have real scarcity: `apex_breach_loadout.charges_remaining` (default 1) is decremented on `use_tool` and row-locked during the check — no double-spending a tool's single use within a breach.

## 15. Clash XP, rewards, and anti-farming

All computed once per breach, atomically, inside `apex_finalize_breach` (idempotent via a `finalized` flag checked under the session's row lock — a duplicate/replayed finalize call is a safe no-op):

- **Breached**: `round((40 + layers_broken × 6) × multiplier)` XP, plus `round(8 × multiplier)` more if the defender's pre-battle XP was higher (an underdog bonus) — plus a Core Energy reward of `round(budget_initial × 0.25)`.
- **Contained**: `round(10 × multiplier)` XP, but only if the attacker reached at least layer 1 — a pure retreat-before-engaging earns nothing.
- **Retreated**: 0 XP, 0 reward.
- **Anti-farm**: `multiplier` is `1 / 0.5 / 0.2 / 0` based on how many *finalized* breaches the same attacker→defender pair completed in the trailing 24 hours (`ANTI_FARM_MULTIPLIERS`) — repeatedly farming one friend's Vault stops being worth it fast.

The reward is funded as an **independent economy sink from the defender**, not a direct transfer: two separate `apex_adjust_core_energy` calls with distinct transaction types (`breach_reward` for the attacker, `breach_destabilisation` for the defender, clamped to the defender's actual balance so it can never go negative) — this is deliberate, matching the product requirement that breaching never directly "steals" a resource from another player. A successful breach also reduces the defender's `vault_integrity` by 15.

## 16. Hidden information

`apex_breach_layers` (the defence snapshot) has RLS **enabled with no SELECT policy at all** — no client, including the attacker, can query it directly. The only path to breach state is `getBreachState()`/`buildBreachState()` (`lib/apex/vault/breach.ts`), which fetches via the service role and maps each raw layer row through `sanitizeLayerRow()` (`lib/apex/vault/breach-config.ts`) — a small, pure, independently unit-tested function whose entire job is: **an unrevealed layer's `name` is always `null`**, regardless of what the raw row contains, whether it's already broken, or anything else. `apex_breach_events` similarly has RLS enabled with no client SELECT policy — the event log is only ever read server-side and reshaped into `BreachEventView[]` for the current viewer. `apex_vault_defences` (a Vault owner's real defence chain) remains select-own only, exactly as before — an attacker can never read a friend's raw defence rows, only the derived `ApexTarget` summary (§20) and whatever the breach snapshot reveals mid-breach.

## 17. Breach history and the defender's activity feed

Both real, both server-computed, both reachable from ApexHome:

- **`GET /api/apex/breach/history`** (`listBreachHistory()`) — the current user's completed/expired breaches in either role, with opponent name, result, layers broken, XP (attacker only), timestamps. Rendered by `components/apex/breach-history.tsx` and a "Recent Breaches" preview on ApexHome.
- **`GET /api/apex/activity`** (`listDefenderActivity()`) — the current user's *defender*-role activity: for each finalized breach against them, a human-readable message built from the real result (e.g. "A breach succeeded against your Vault — 2 defence layers fell." / "Your Vault held — no defence layers were lost."). Rendered as "Breach Alerts" on ApexHome. This replaces the honest-empty placeholder from the previous revision with real, derived content.

Neither view ever exposes the *other* player's hidden defence chain or breach loadout — both are built from already-sanitised `apex_breach_sessions`/count data, not raw layer/loadout rows.

## 18. Achievements

9 achievements, seeded into `apex_achievements` (migration `0004`, public read-only catalog), granted per-user into `apex_user_achievements` (select-own only) exclusively by `apex_award_achievement()` — an idempotent (`on conflict do nothing`) `SECURITY DEFINER` insert, called only from `apex_finalize_breach` and `apex_award_achievement` itself is unreachable by any client. **No client can grant itself an achievement.**

| Slug | Condition |
|---|---|
| first-breach | Successfully breach a Vault (1st time) |
| corebreaker | 5 successful breaches (attacker) |
| deep-breach | Reach the Core Gate (layer 2) in any breach |
| against-the-odds | Breach a higher-XP defender's Vault |
| systems-architect | Own 12+ Apex technologies |
| full-power | Use all 8 Defence Capacity at once |
| perfect-defence | Contain a breach without losing a layer (defender) |
| untouchable | Successfully defend against a higher-XP attacker |
| five-containments | 5 successful defences |

`GET /api/apex/achievements` (`listAchievements()`) joins the catalog with the user's earned rows client-side of the request (user-token, RLS-safe, no service role needed for a read-your-own-plus-public-catalog query). Rendered by `components/apex/achievements-panel.tsx`, embedded directly on ApexHome.

## 19. Clash XP and Rank

`apex_profiles.apex_xp` (bigint, default 0), mutated exclusively by `apex_finalize_breach` (no client write policy exists on the table at all). Rank is **always derived, never stored**: `deriveApexRank(xp)` in `lib/apex/config.ts` is the one place the ladder (Unranked → Bronze I–III → Silver I–III → Gold I–III → Apex → Apex Elite → White Wolf) lives. `GET /api/apex/profile` returns `{xp, rank, label, nextLabel, nextThreshold, progress}`; ApexHome renders it as a progression bar. This now genuinely changes as breaches resolve, unlike the previous revision where it was permanently 0/Unranked for every account.

## 20. Nexus Points integration (unchanged, disclosed gap)

Nexus Points remain client-side `localStorage` (`lib/nexus-points.ts`), owned by `components/airnexus-app.tsx` — there is still no server-side NP ledger anywhere in AirGPT (a pre-existing platform gap, not Apex-specific). Technology acquisition records ownership server-side (trusted), but the NP cost check reuses the existing client-trusted `onRedeemReward()` flow (same pattern Marketplace already uses). Hardening this needs a real server NP ledger — cross-cutting platform work, out of scope for Apex alone.

## 21. Friend system, targets

Fully reused from `lib/airnexus/social.ts` (the one AirGPT-wide friend graph). `listApexTargets()` (`lib/apex/vault/targets.ts`) layers a public Vault summary (Integrity band → coarse "signal", defence *count* not order or identity, derived rank, breach-availability status honoring `breaches_enabled`/cooldowns/protection) on top of `getAcceptedFriends()` — never exact Core Energy or the defence chain.

## 22. Subscriptions

Untouched — `lib/plans.ts`, same client-side plan state as the rest of AirGPT. No Apex-specific billing. Premium grants nothing in Apex (no code path checks `plan` for any Apex mutation), matching the requirement that Premium stay cosmetic/QoL-only if ever extended into Apex.

## 23. Routes

**None dedicated.** Apex is `activeSection === 'Apex'` inside the existing AirGPT workspace. API routes (all `runtime = 'nodejs'`, all require auth via `requireAuth()`):

- `GET /api/apex/vault`, `PATCH /api/apex/vault` (auto-repair settings, `breachesEnabled` toggle)
- `POST /api/apex/vault/defences` (`install` / `uninstall` / `activate` / `deactivate` / `reorder` / `set_priority`, discriminated by an `action` field)
- `POST /api/apex/vault/repair`
- `GET /api/apex/technologies`, `POST /api/apex/technologies` (acquire)
- `GET /api/apex/targets`
- `POST /api/apex/breach` (start a breach)
- `GET /api/apex/breach/[id]` (attacker-only breach state)
- `POST /api/apex/breach/[id]/action` (submit one breach decision)
- `GET /api/apex/breach/history`
- `GET /api/apex/activity` (defender activity feed)
- `GET /api/apex/achievements`
- `GET /api/apex/profile`

## 24. Not yet implemented / known limitations

Everything in the previous revision's "not yet implemented" list is now built **except**:

- **Auto-Repair's automatic consumption trigger.** The setting (`auto_repair_enabled`/`auto_repair_reserve`) is real and persisted, and Integrity damage from a lost breach is now real (§11), but nothing currently spends the reserve automatically in response. A player must still repair manually in Manage Vault. This is the one genuine feature gap remaining from the original spec.
- **Nexus Conditions** (global periodic modifiers) — no code exists at all; not even a config boundary. Out of scope until the core loop has real usage data to balance against.
- **Server-side Nexus Points ledger** — pre-existing platform gap (§20), not Apex-specific.
- **A scheduled/cron economy resolver** — resolution is correct today via lazy on-access resolution; a cron job is a valid future optimisation for notification-timing purposes, not a correctness requirement.
- **True single-transaction atomicity for breach creation** — the compensating-transaction/refund approach in `startBreach()` (§12) is a disclosed, reviewed tradeoff, not a bug, but it is not the same guarantee as one SQL transaction.

## 25. Files created this revision

**Database**: `supabase/migrations/0004_apex_breach_resolver.sql` (breach layers, achievements, 4 new `SECURITY DEFINER` functions, additive-only ALTERs to `apex_technologies`/`apex_breach_loadout`/`apex_breach_sessions`).

**Server** (`lib/apex/vault/`): `breach-config.ts` (breach constants + `sanitizeLayerRow`, `antiFarmMultiplier`, `previewVictoryXp`), `achievements.ts`, `recommendations.ts` (pure `deriveVaultRecommendations`, split out of `vault.ts` so it can be imported from a client component without pulling in `server-only`/`next/headers`). `breach.ts` and `vault.ts` were substantially rewritten/extended.

**API** (`app/api/apex/`): `breach/[id]/route.ts`, `breach/[id]/action/route.ts`, `breach/history/route.ts`, `activity/route.ts`, `achievements/route.ts`. `breach/route.ts` was rewritten (POST-only; the old 501-stub `PATCH` handler is gone).

**UI** (`components/apex/`): `breach-history.tsx`, `achievements-panel.tsx`. `breach-shell.tsx` was fully rewritten from a static placeholder into the interactive turn-based UI. `apex-home.tsx` was rewritten to wire in real breach history, real defender activity, the achievements panel, `deriveVaultRecommendations()` output, and a 4th primary action ("Breach History"). `manage-vault.tsx` gained the "Owned, Not Installed" install panel (§9) and now uses `repairCostForPercent()` instead of a separately-hardcoded (and previously incorrect) price formula.

**Tests**: `tests/apex-vault.test.ts` + a `test:apex` package.json script, following this repo's existing plain-`tsc`+`node` pattern (see `test:atar`) since there's no test framework installed. Covers `deriveApexRank`, `repairCostForPercent`, `antiFarmMultiplier`/`previewVictoryXp`, and `sanitizeLayerRow` (the hidden-information boundary — explicitly asserts an unrevealed layer's name is always `null`, including when already broken).

## 26. Database

Migrations, in order: `0001_student_memory.sql` → `0002_airnexus_social_economy.sql` (`profiles`, `friendships`, `apex_profiles`; `air_wallets`/`air_transactions` deprecated/inert) → `0003_apex_nexus_vault.sql` (Vault economy schema) → `0004_apex_breach_resolver.sql` (breach resolver, achievements). All additive; no already-applied table is altered in a breaking way. RLS is enabled on every Apex table; see §16 and §28 for the specifics. No secrets in any committed file.

## 27. Security review

Every Core Energy, Vault Integrity, or Clash XP mutation goes through a `SECURITY DEFINER` Postgres function (row-locked with `for update` where concurrency matters) or the service-role backend (`supabaseServiceFetch`, server-only, never exposed to the client). Confirmed this revision, by direct inspection of both migrations:

- **No table grants a client INSERT/UPDATE/DELETE policy** on any Apex table — RLS default-denies writes when no policy exists, which every Apex table relies on.
- **All 7 `SECURITY DEFINER` functions** (`apex_resolve_vault_economy`, `apex_repair_vault`, `apex_adjust_core_energy`, `apex_award_achievement`, `apex_create_breach_layers`, `apex_finalize_breach`, `apex_breach_take_action`) end with `revoke all on function ... from public, anon, authenticated` — callable only via the service-role connection.
- **`apex_breach_layers` and `apex_breach_events`**: RLS enabled, zero client SELECT policies. The only path to their data is the sanitising TypeScript layer (§16).
- **`apex_vault_defences`, `apex_breach_loadout`**: select-own only (or attacker-of-that-session for loadout) — never friend/defender-readable.
- **`sanitizeLayerRow()`** is independently unit-tested (§25) specifically because it's the one function standing between a raw defence-identity row and the client.
- **Double ownership checks on every breach action**: `takeBreachAction()` checks session ownership client-application-side before calling the RPC, *and* `apex_breach_take_action` re-checks `p_attacker_id` against the row-locked session — defense in depth, not reliance on a single layer.
- **Randomness is server-side and auditable**: every pressure roll's `random_factor` is persisted in the event payload; nothing depends on client-supplied numbers.
- **Error messages returned to the client are hand-written, human-readable strings** (`readableActionError()` in `breach.ts`), not raw SQL exception text or stack traces, for the breach-action path specifically. Other Apex routes reuse this codebase's existing `readSupabaseRestJson`/`handleAirnexusError` pattern (pre-existing sitewide, not introduced by Apex), which does forward PostgREST `message` fields — those are deliberately human-authored error strings from this codebase's own `raise exception` calls, not internal/sensitive detail.

**Bug found and fixed during this review**: `apex-home.tsx` (a `'use client'` component) originally imported `deriveVaultRecommendations` from `lib/apex/vault/vault.ts`, which carries a `server-only` + `next/headers` import chain — this compiled fine under `tsc --noEmit` (which doesn't understand the `server-only` bundler boundary) but **failed `pnpm build`** outright, since Next.js refuses to bundle `server-only` code into the client. Fixed by extracting the pure function into `lib/apex/vault/recommendations.ts` (no server dependency). This is why `pnpm build` — not just typecheck — is required verification for every change in this codebase; see §29.

**Dead code removed**: a large block of CSS in `app/globals.css` (`.apex-shell`, `.apex-nav-link`, `.apex-hero-ring(s)`, `.apex-arena-grid`, `.apex-node`, `.cc-ability`, `.cc-node-row/-badge`, `.cc-team-panel/-icon`, `.cc-air-heat-panel`, `.cc-joystick*`, `.cc-surge-hold`) was leftover from the deleted "Core Control" arena UI and referenced by zero remaining components — confirmed via grep before removal. `.cc-meter-track`/`.cc-meter-fill` were kept, since `breach-shell.tsx` genuinely reuses them for the layer integrity bars. A stale migration `0003` comment claiming the breach resolver was "NOT implemented yet" was also corrected.

## 28. Deprecated old Apex work

Unchanged from the previous revision — still fully removed, still nothing to reuse:

1. **"Nexus Clash"** (1v1 realtime combat) — never merged into any UI; fully removed.
2. **"Apex as a separate application" + "Core Control"** (realtime arena, Pulse/Surge/Phase Shift/Core Guard, Nexus Nodes, Team Alpha/Omega) — `app/apex/**`, old `app/api/apex/**`, old `components/apex/**`, `lib/apex/core-control/**`, `lib/apex/server.ts`, `lib/apex/types.ts` all deleted. Confirmed this revision: no `app/apex` directory exists, no component/route references any of these names.
3. **Air Points** (`air_wallets`/`air_transactions`) — abandoned, replaced by Core Energy. Tables remain in migration `0002` (commented deprecated) rather than dropped; no active code reads or writes them.

## 29. How to run / validate

```
pnpm install
pnpm dev:http      # plain HTTP dev server
pnpm typecheck
pnpm lint
pnpm build          # required — typecheck alone misses server-only/client-bundle violations, see §27
pnpm test:apex       # breach formulas, anti-farm, sanitization boundary
pnpm test:atar       # pre-existing, unrelated — run to confirm no regression
```

Package manager: `pnpm` (see `packageManager` in `package.json`).

## 30. Required environment variables (names only)

```
API_URL
LOCAL_HTTPS
GROQ_API_KEY
GROQ_TTS_MODEL
GROQ_TTS_VOICE
AIRGPT_ADMIN_USERNAME
AIRGPT_ADMIN_PASSWORD_HASH
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # required for all /api/apex/* server authority; without it they 503
```

## 31. Database setup

1. Apply migrations in order against your Supabase project: `0001_student_memory.sql` → `0002_airnexus_social_economy.sql` → `0003_apex_nexus_vault.sql` → `0004_apex_breach_resolver.sql` (Supabase CLI `supabase db push`, or paste into the SQL editor — none of this could be applied from this development environment).
2. Set `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API → `service_role`). Never expose it to the client.
3. Restart the app. Until both are done, every `/api/apex/*` route returns a clear 503 rather than crashing, and the Apex home screen shows an honest "backend not configured" notice.

## 32. Verification performed this revision (honesty section)

**COMPLETED**: breach resolver schema + 4 SQL functions (migration `0004`); breach lifecycle API routes (start/state/action/history/activity/achievements); interactive `BreachShell` UI; breach history, defender activity, and achievements UI, all wired into a rewritten `ApexHome`; Manage Vault's install-owned-technology gap closed; `repairCostForPercent` UI/server mismatch fixed; dead Core Control CSS removed; stale migration comment corrected.

**TESTED** (`pnpm test:apex`, plain `tsc`+`node`, no test framework in this repo): `deriveApexRank` (unranked floor, threshold promotion, max-rank cap, negative-XP clamping), `repairCostForPercent` (exact and partial increments, zero/negative clamping), `antiFarmMultiplier`/`previewVictoryXp` (all four tiers, underdog bonus interaction with the multiplier), and `sanitizeLayerRow` — specifically asserting an unrevealed layer's `name` is `null` even when already broken, and that revealing a layer passes its real name through unmodified. `pnpm test:atar` (pre-existing suite) re-run to confirm no regression.

**MANUALLY VERIFIED** (static analysis, not runtime): `pnpm typecheck` clean, `pnpm lint` clean, **`pnpm build` clean** — including catching and fixing the `server-only`-into-client-bundle bug described in §27, which `typecheck` alone did not catch. Full manual read-through of both SQL migrations for RLS coverage, grant revocation, and row-lock correctness (§27). Grepped the entire `lib/apex`/`components/apex`/`app/api/apex` tree for `TODO`/`FIXME`/"not implemented"/`alert(`/`Math.random()` — none found in active code (one stale doc comment, since fixed). Confirmed no leftover references to any deprecated Core Control/Nexus Clash naming anywhere in `lib/`, `components/`, or `app/`.

**NOT VERIFIED**: end-to-end interactive browser click-through (signing in, installing a defence, starting a breach, playing it turn-by-turn to a result, checking the achievement/XP/history update). This requires a real authenticated session against an applied Supabase database with `SUPABASE_SERVICE_ROLE_KEY` set. Neither is available in this development environment — only `SUPABASE_URL`/`SUPABASE_ANON_KEY` are set locally, no service role key, and migration `0004` has not been applied to any live database. The browser-preview tooling itself was also attempted and did not come up in this session (server process did not register), consistent with earlier revisions of this same project. Treat every interactive flow described in §12–19 as **code-reviewed and statically verified, not runtime-verified** until someone applies migration `0004` to a real project, sets the service-role key, and plays a breach through the UI.

## 33. Next steps, in priority order

1. Apply `0004_apex_breach_resolver.sql` to a real Supabase project (after `0003`) and set `SUPABASE_SERVICE_ROLE_KEY`, then do the one missing verification step: play a full breach through the UI as two real accounts and confirm the numbers match §14/§15.
2. Wire Auto-Repair's automatic reserve consumption to the Integrity-damage path (§11/§24) — the last real feature gap from the original spec.
3. Consider a scheduled economy resolver if presence/notification timing ever needs fresher `last_economy_resolved_at` values than lazy resolution provides (§24) — not a correctness requirement today.
4. Design Nexus Conditions once the core loop has real usage data to balance against (§24).
5. A server-side Nexus Points ledger, if that cross-cutting platform work is ever greenlit (§20/§24) — not Apex-specific, don't scope it into Apex work alone.
