# Abyte-EMS — Full System Audit Report

| Field | Value |
|---|---|
| **System** | Abyte-EMS (Local LAN Employee Management System) |
| **Repository** | `D:\abyte-hroff` |
| **Stack** | React 19 + Vite (client) · Node/Express + Prisma/SQLite (server) |
| **Audit date** | 2026-11-17 |
| **Method** | Static, read-only review of all application source, configuration, build/release scripts, docs, git tracking state, and repository layout. No live exploitation or penetration testing was performed. |
| **Scope** | `client/src`, `server/src`, `client`/`server` build config, `scripts/`, root docs/scripts, gitignore, dependency manifests. The `ui-kit/` vendor theme dump was assessed only for layout/duplication. |

---

## 1. Executive Summary

The application is **functional and reasonably well-structured** — Prisma is used safely (no raw SQL injection), RBAC is genuinely enforced on the server, passwords are bcrypt-hashed, and there is working backup/restore, rate limiting, and path-traversal protection. However, the audit found **three critical issues that must be fixed before this system is handed to any client or exposed on a LAN**, plus a cluster of high-severity defaults and reliability problems.

The single most urgent finding is that **the release packaging script silently ships the real 15.6 MB production database** (employee PII + password hashes) despite documentation claiming it is excluded. Alongside that, the JWT signing secret falls back to a publicly known constant, and the login UI ships with hardcoded admin credentials.

### Findings by severity

| Severity | Count | Headline |
|---|---:|---|
| **CRITICAL** | 3 | Real DB leaked in release zip · foruable JWT secret · shipped admin credentials |
| **HIGH** | 5 | No source control · seed creates thousands of known-password admins · unsafe DB restore · Prisma wrong dependency class · tokens in localStorage/URLs |
| **MEDIUM** | 18 | Over-broad CORS · PII exposed to Viewer · IDOR image overwrite · 7-day non-revocable tokens · info leakage · broken builds/config |
| **LOW** | 22 | Weak password policy · minor traversal/DoS edges · React/UX cleanup |
| **INFO** | 3 | Inventory and positive observations |

### Top 5 actions (do these first)

1. Fix `scripts/package-release.ps1` so no `*.db`, `.env`, or real storage data ever enters a release — add a post-build assertion that fails the script.
2. Generate a strong per-install `JWT_SECRET`; remove all hardcoded fallbacks; fail closed in every environment.
3. Remove hardcoded admin credentials from `ensureAdmin()` and from `Login.tsx`; require a bootstrap password and force rotation on first login.
4. Commit the actual source to git (currently only `README.md` is tracked) — after scrubbing data files.
5. Fix the DB restore path (disconnect Prisma, snapshot, validate, atomic swap) and move `@prisma/client` to `dependencies`.

---

## 1.1 Remediation Status — 2026-11-17

All P0/P1 items and the large majority of P2 items were fixed in the same session. Both apps build cleanly (`tsc`/`vite build`), the Prisma schema was pushed, and an end-to-end test on a disposable database confirmed: random admin bootstrap → login → HttpOnly cookie session → forced password change → normal API access.

| Area | Status | What changed |
|---|---|---|
| Release packaging (C-01, M-10) | **Fixed** | `scripts/package-release.ps1` now copies only `schema.prisma` (no DB/seed), recursively removes secrets/logs/junk, and aborts if any forbidden or non-empty storage file remains. Verified: 0 DB files, 0 `.env`, 0 storage files in generated package. |
| JWT secret (C-02) | **Fixed** | No fallback. Weak/short secrets fail startup in every environment. Strong per-install secret generated in `server/.env`; example placeholder is blocklisted. |
| Admin credentials (C-03, H-02) | **Fixed** | No hardcoded password, no login hint/prefill. Production requires `ADMIN_BOOTSTRAP_PASSWORD`; otherwise a random password is printed once in dev. Forced password change via `mustChangePassword`; seed no longer creates known-password admins. |
| Session handling (H-05, M-05, M-08) | **Fixed** | 15-minute access + 7-day refresh tokens in HttpOnly cookies, `tokenVersion` revocation, no tokens in URLs or `localStorage`, strict CORS allowlist, CSP enabled, Morgan redacts `token`. |
| Backup/restore (H-03, M-09, L-06) | **Fixed** | `VACUUM INTO` snapshot before archiving, SQLite-header validation, Prisma disconnect, staging files, rollback on failure, zip entry/total size limits. |
| Authorization (M-02, M-03, M-04) | **Fixed** | Reports: exports restricted to privileged roles, preview fields reduced for Viewers, status filters reconciled. Image `replaceId` scoped to employee+category. Settings details admin-only. |
| Errors/UX (M-06, M-07, M-12–M-18) | **Fixed** | Generic 500 messages, 403 toast instead of `alert`, error boundary, double-submit guard, load error handling, SPA navigation, dev server bound to localhost, hardened start scripts, catch-all route. |
| Config/deps (H-01, H-04, M-11, L-09, L-11) | **Fixed** | `@prisma/client` moved to `dependencies`; lockfile updated; invalid `prisma.config.ts` removed; DB path derived from `DATABASE_URL`; `.env.example`/docs corrected; `TRUST_PROXY` parsed safely. See note below for git. |
| Hygiene (L-12–L-24) | **Mostly fixed** | Duplicate ~35 MB vendor kit and dead pages removed, labels on key forms, magic-byte upload validation, `SearchSelect` hook cleanup, timer/confirm cleanup, asset paths fixed, CI + `SECURITY.md` added. |
| Remaining low-priority items | **Open** | Form labels are not associated on every legacy field; no focus trap in the confirm dialog; no global upload concurrency cap; no automated tests/process-manager config; admin-created password reset relies on `mustChangePassword` rather than a per-user expiry notice. These are hardening/UX items, not exploitable critical paths. |

> **Git (H-01):** the working tree now contains the complete application. Commit it as the baseline after confirming `git status` shows no `.env`, `*.db`, `storage/`, `dist/`, or `node_modules/` paths.

---

## 2. Detailed Findings

### CRITICAL

#### C-01 — Release package ships the real production database (PII + password hashes)
- **Location:** `scripts/package-release.ps1:57-62`; `server/prisma/dev.db` (15,634,432 bytes); `README.md:82`, `RELEASE-CHECKLIST.md:8-9`
- **Issue:** The script copies the entire `server/prisma` directory (including the live `dev.db`) into the release, then tries to delete DB files. The cleanup at line 62 uses `-Include` on a plain (non-wildcard) directory path **without `-Recurse`**, so in PowerShell it matches nothing and silently does nothing.
- **Evidence:**
  ```powershell
  Get-ChildItem (Join-Path $dest "server\prisma") -File -Include *.db,... | Remove-Item
  ```
  Reproduced in a temp directory: `dev.db` remained afterward. The DB is a valid SQLite database with real records and bcrypt hashes. `storage/backups/*.zip` (8.7 MB) and real JPGs also exist on disk.
- **Impact:** Every release zip leaks real employee PII, password hashes and backup metadata — a privacy/legal breach on client handoff, and a direct contradiction of the documented "DB and storage excluded" claim.
- **Fix:** Whitelist only `schema.prisma` (and `seed.ts` from a controlled, scrubbed source) instead of copying the whole directory. Add a release-time check that aborts if any `*.db`, `.env`, or non-empty `storage/` file exists in the output. The current "Excluded: .env, SQLite DB files, existing storage data/logs" message must be made truthful.

#### C-02 — Hardcoded / forgeable JWT secret allows full authentication bypass
- **Location:** `server/src/config/index.ts:9-24`, `server/.env:3`, `server/.env.example:2,6`
- **Issue:** Empty/blocklisted secrets are silently replaced with the source-visible constant `dev-only-insecure-secret-change-me`. The shipped `server/.env` contains exactly a blocklisted value. Meanwhile `.env.example` ships `NODE_ENV=production` with `JWT_SECRET=replace-with-a-long-random-secret`, which is **not** blocklisted — so copy-and-deploy yields a publicly known production secret.
- **Evidence:**
  ```ts
  const weakSecrets = new Set(['', 'dev-secret', 'change-this-secret-in-production-local-ems-2026']);
  jwtSecret: weakSecrets.has(jwtSecret) ? 'dev-only-insecure-secret-change-me' : jwtSecret,
  ```
- **Impact:** Anyone who has read the source can mint a token `{id:1, username:'admin', role:'ADMIN'}` and obtain full admin access. The server binds `0.0.0.0`, so this is network-reachable, not merely local. Also: with the current `.env`, `start-prod.bat` sets `NODE_ENV=production` and the server **throws on startup** — production cannot start as delivered.
- **Fix:** Delete the hardcoded fallback entirely. Fail closed in every environment when the secret is missing/weak. Add the example placeholder to the denylist. Generate a cryptographically random secret per install, store it outside source control, rotate it, and invalidate all outstanding tokens. Keep `.env` and `.env.example` structurally identical.

#### C-03 — Shipped/default admin credentials (server constant + login UI prefill)
- **Location:** `server/src/controllers/authController.ts:18-29`; `client/src/pages/Login.tsx:7-8,102-105`; `server/.env.example:10`; `server/prisma/seed.ts:97`
- **Issue:** On a fresh DB the admin account is created with the fixed constant `ChangeMe@12345` when `ADMIN_BOOTSTRAP_PASSWORD` is absent, with no forced rotation. Separately, the login form is pre-filled with `admin` / `admin123` and shows that pair as a visible hint. These two values **do not match**, which is itself a sign of stale, unsafe credential handling.
- **Evidence:**
  ```ts
  const password = bootstrapPassword && isStrongPassword(bootstrapPassword)
    ? bootstrapPassword : 'ChangeMe@12345';
  ```
  ```tsx
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  ... <strong>Default admin:</strong> <code>admin</code> / <code>admin123</code>
  ```
- **Impact:** A default deployment has a publicly known admin credential → complete system compromise. The UI hint additionally advertises credentials to whoever can reach the login page.
- **Fix:** Require `ADMIN_BOOTSTRAP_PASSWORD` in production (or generate a random password); add a `mustChangePassword` flag and force rotation at first login; remove the prefill and hint from production builds; remove/parameterize the seed password; correct README's inaccurate "temporary password printed once" wording.

---

### HIGH

#### H-01 — Effectively no source control: only `README.md` is tracked
- **Location:** repo root. `git ls-files` → `README.md` only; `git status` shows `client/`, `server/`, `scripts/`, `ui-kit/`, `storage/`, `start.bat`, `start-prod.bat`, `.gitignore`, `RELEASE-CHECKLIST.md` all untracked. The tracked `README.md` in HEAD is just `# abyte-hroff`; the 98-line documentation is an unstaged working-tree change.
- **Impact:** No versioning, rollback or audit trail; a fresh clone yields no runnable app; a single disk loss destroys the project.
- **Fix:** After confirming `.gitignore` excludes `.env`, `*.db*`, `storage/`, `dist/`, `node_modules/`, commit all intended source/config/docs in one baseline commit.

#### H-02 — Seed creates ~10,000 users with the known password `password123`, including ADMIN roles
- **Location:** `server/prisma/seed.ts:24,93-109`
- **Issue:** All seeded users share one bcrypt hash of `password123` and `roles` includes `ADMIN`, so roughly 2,000 seeded accounts are admins with a single known password. The `ALLOW_LARGE_SEED` gate lowers likelihood but not impact.
- **Fix:** Never assign `ADMIN` in demo data; generate unique random passwords; hard-block seeding when `NODE_ENV=production`; remove `seed.ts` from release packages or replace it with a scrubbed version.

#### H-03 — Restore overwrites the live SQLite database while the server holds it open
- **Location:** `server/src/controllers/backupController.ts:98-124`; `server/src/config/index.ts:29`
- **Issue:** `restoreBackup` copies an archived DB directly over the live Prisma-managed file with `fs.copyFileSync`, then swaps storage folders, with no Prisma disconnect, no schema/integrity validation, no atomic swap and no rollback if a later step fails.
- **Impact:** On Windows this can fail with `EBUSY`, or succeed and leave a stale connection, inconsistent storage, and a half-restored state → silent data loss/corruption.
- **Fix:** Disconnect Prisma, restore to a staging path, validate schema/integrity, then atomically swap and restart. Use SQLite's online backup API / `VACUUM INTO`. Make the operation transactional with a verified rollback point. The documented "restore requires server restart" is a workaround, not a fix.

#### H-04 — `@prisma/client` is a devDependency → production installs break at runtime
- **Location:** `server/package.json:36-38`
- **Issue:** The generated Prisma client is imported at runtime (`server/src/config/prisma.ts`) but declared under `devDependencies`.
- **Impact:** `npm install --omit=dev` / `npm ci --omit=dev` (standard production install, and implied by "do not include node_modules") yields a server that crashes on first import; `prisma generate` is also unavailable in a prod-only install.
- **Fix:** Move `@prisma/client` to `dependencies`; run `prisma generate` as part of `build`/`postinstall`; use the committed lockfile with `npm ci`.

#### H-05 — JWT stored in `localStorage` and placed in every media URL
- **Location:** `client/src/lib/api.ts:8,17,32-36`; `client/src/contexts/AuthContext.tsx:23-33`; `server/src/middleware/auth.ts:21`; `server/src/app.ts:36,41-45`
- **Issue:** The 7-day bearer token is persisted in `localStorage` (XSS-exfiltratable, no `HttpOnly`/`Secure`/`SameSite`, axios not set to `withCredentials`) and appended as `?token=...` to every `<img src>`/`<a href>` via `storageUrl()`. The server accepts query tokens on all routes, and `morgan` logs the full URL including the query string.
- **Impact:** Any XSS can steal the token; every image request writes a valid admin-capable JWT to browser history, server/access logs and log backups. A log reader gains full API access. README's warning "avoid sharing URLs/logs containing tokens" does not mitigate the app's guaranteed token logging.
- **Fix:** Move auth to an `HttpOnly; Secure; SameSite` cookie and drop `?token=` entirely; or issue short-lived, narrowly scoped signed media URLs. Redact/strip the `token` parameter in Morgan regardless. Restrict query-token acceptance to `/storage` only; add refresh/rotation and shorter TTL.

---

### MEDIUM

#### Security & authorization
- **M-01 — Overly permissive CORS with credentials** (`server/src/app.ts:24-35`): any `localhost`/`127.0.0.1` port and any RFC1918 LAN origin is allowed with `credentials: true`, in addition to the configured allowlist. `CLIENT_URL` is effectively decorative; the real `.env` lists only `http://localhost:3001` while production is on `:4000`, and hostname-based URLs (e.g. `http://pc-name:4000`) are rejected. **Fix:** strict allowlist from `CLIENT_URL`, remove blanket LAN/localhost regex, set the real production origin.
- **M-02 — No per-record access control; PII over-exposed to Viewer** (`server/src/routes/reports.ts:6-10`, `employees.ts:12-14`, `app.ts:41-52`): all read endpoints require only authentication. A VIEWER can enumerate all employees, export reports containing CNIC/salary/addresses, and download any file via `/storage/<path>?token=<own token>`. **Fix:** field-level and row-level filtering; restrict exports/downloads by role.
- **M-03 — IDOR image overwrite via unvalidated `replaceId`** (`server/src/controllers/imageController.ts:11,28`, `services/imageService.ts:62-70,112-133`): `replaceId` is taken verbatim from `req.body` and used to update an `EmployeeImage` row and delete the old physical file, without verifying the image belongs to `employeeId` or the same category. A writer-role user can corrupt/delete another employee's images. **Fix:** scope the lookup to `employeeId` + category and reject mismatches.
- **M-04 — Internal system details exposed to every role** (`server/src/routes/settings.ts:6-7`, `controllers/settingsController.ts:8-29`): `GET /api/settings` has no `authorize()` guard, so VIEWERs receive absolute DB/storage/backup paths, hostname, Node version and platform. **Fix:** restrict to ADMIN; omit absolute paths/host details in production.
- **M-05 — 7-day tokens with no revocation or refresh** (`server/src/controllers/authController.ts:47,55-66`): no jti/version; changing a password does not invalidate tokens; on the client any 401 forces a hard `window.location.href='/login'`, losing form state. **Fix:** short-lived access + rotating refresh tokens, `tokenVersion` claim checked per request, SPA navigation with a session-expiry notice.
- **M-06 — Raw exception messages returned to clients** (`backupController.ts:83,127,139`; `documentController.ts:37,53`; `imageController.ts:34,45`; `departmentController.ts:69`; `employeeController.ts:200,292,314`): catch blocks echo `e.message`, leaking filesystem paths and Prisma/SQLite internals despite the safe global handler. **Fix:** generic client messages; log details server-side only.
- **M-07 — 403 handled with `alert()` and `console.warn`** (`client/src/lib/api.ts:19-27`): a blocking native alert, deduplicated via a mutable `window` property, bypasses the app's toast system, can stick in the "shown" state, and logs internal errors. **Fix:** emit a structured event consumed by `UIProvider`; remove globals and console logging.
- **M-08 — No CSP; external font CDN** (`client/index.html:10`; `server/src/app.ts:23`): Helmet is configured with `contentSecurityPolicy: false`, and `fonts.googleapis.com` is loaded. Combined with `localStorage` tokens, any injected script can exfiltrate credentials with no CSP barrier. **Fix:** enable a strict CSP (`script-src 'self'`, no `unsafe-inline`); self-host fonts; scope `crossOriginResourcePolicy` to what `/storage` needs.

#### Data, backup & restore
- **M-09 — Live-file backup can be inconsistent** (`server/src/controllers/backupController.ts:64`): `archive.file(config.dbPath, ...)` streams the live SQLite file with no checkpoint/quiesce, so a "successful" backup may be unusable and, when restored (H-03), may corrupt the DB. **Fix:** `VACUUM INTO` / SQLite online backup API before archiving.
- **M-10 — DB path inconsistency** (`server/.env.example:13`, `server/.env:1`, `config/index.ts:29`, `backupController.ts:104-108`): the example uses `file:./prisma/dev.db`, which Prisma resolves to the wrong location (`server/prisma/prisma/dev.db`) — installers copying it get an empty DB elsewhere. `config.dbPath` is hardcoded and restore ignores `DATABASE_URL`. **Fix:** use `file:./dev.db`; derive `dbPath` from `DATABASE_URL`.
- **M-11 — `prisma.config.ts` is invalid for installed Prisma** (`server/prisma.config.ts:1-7`; `prisma ^5.22.0`): imports `definePrismaConfig` from `prisma/config` and declares a fabricated `skills.agents` setting. Prisma 5.22 has no `config` export; the file is excluded from `tsc`, so it never compiles. A future upgrade that auto-loads it will break `prisma generate`/`db push`. **Fix:** delete or replace with a valid config; pin `@prisma/client` and `prisma` to the same exact version.

#### Client correctness & UX
- **M-12 — No error boundary** (`client/src/main.tsx:6-10`, `App.tsx:31-57`): a single render error unmounts the whole app to a blank screen. **Fix:** top-level and per-route error boundaries with recovery UI.
- **M-13 — No double-submit protection** (`client/src/pages/EmployeeForm.tsx:51-65,148`): `submit()` never toggles a `saving` flag and the button is never disabled → double-click creates duplicates. **Fix:** guard with `saving` state and `disabled={saving}`.
- **M-14 — Unhandled promise rejections / stuck loading** (`Employees.tsx:40-48`, `EmployeeProfile.tsx:54-55,71,79`, `Settings.tsx:12`, `Backup.tsx:14-19`, `Reports.tsx:48-60`, `Organization.tsx:15,90`): many loaders/mutations have no `catch`; failures leave "Loading…" forever and produce unhandled rejections. **Fix:** catch → error state + error toast; render error states.
- **M-15 — Conflicting report filters silently win** (`client/src/pages/Reports.tsx:23,85-86`, `server/src/controllers/reportController.ts:26,34-35`): "Report Type" and "Status" both map to `employmentStatus`; setting Status=INACTIVE with Report Type=ACTIVE silently returns ACTIVE rows. **Fix:** make them mutually exclusive or remove the redundant filter.
- **M-16 — Vite dev server bound to all interfaces** (`client/vite.config.ts:6-10`): `host: true` → `0.0.0.0:3001`, exposing unminified source on the LAN. **Fix:** default to `localhost`; opt into LAN only via an explicit dev flag.
- **M-17 — Full-page navigations break SPA state** (`client/src/lib/api.ts:18`, `AuthContext.tsx:33`, `Layout.tsx:99,130`): logout, 401 redirect and header search use `window.location` instead of React Router. **Fix:** `useNavigate`/`<Navigate>`.
- **M-18 — Deployment scripts lack validation** (`start-prod.bat:5-15,23-25`, `start.bat:10-12`, config M-6/M-7): `start-prod.bat` rebuilds only when `dist` is missing (stale builds served), never checks `.env`/JWT strength, has no error handling around `node dist/index.js`; `start.bat` uses fragile nested quoting and no failure detection for the background API. **Fix:** preflight required env/DB, always rebuild or compare timestamps, wrap the node process, check exit codes with clear messages.

---

### LOW

| ID | Finding | Location | Fix |
|---|---|---|---|
| L-01 | bcrypt cost 10; `isStrongPassword` only checks `length >= 8` | `authController.ts:14-16,23,63,98,122` | cost ≥12 or Argon2id; complexity + breached-password screening |
| L-02 | Username/state enumeration via distinct login errors and early return skipping `bcrypt.compare` | `authController.ts:42-45` | uniform message + dummy hash compare |
| L-03 | `full.startsWith(base)` path check allows a sibling dir with the same prefix; `decodeURIComponent` can throw | `app.ts:46-51` | use `path.relative(base, full)` and reject `..`/absolute; safe decode. `safeJoin()` exists but is unused |
| L-04 | Upload type validation is extension/client-MIME only; document MIME ignored | `utils/validation.ts:103-113`, `imageService.ts:8-13` | validate magic bytes; store outside webroot with `nosniff` |
| L-05 | `multer.memoryStorage()` (10 MB/file) + `express.json({limit:'5mb'})`, no global cap or upload rate limit → memory DoS | `routes/employees.ts:9`, `app.ts:37-38` | disk/streaming storage, total request cap, rate-limit uploads |
| L-06 | Zip extraction checks path containment but not entry/total size or compression ratio → zip bomb | `backupController.ts:20-41` | enforce per-entry and total extraction budgets |
| L-07 | Image renames run after the employee-update transaction commits; a failed rename leaves DB pointing at old names | `employeeController.ts:225-281` | compensating transaction with verification |
| L-08 | Employee-code generation is racy; unique constraint rejects one request (`P2002`) | `employeeCode.ts:3-19`, `employeeController.ts:137-140` | DB sequence/counter with locking |
| L-09 | No `app.set('trust proxy', ...)`; rate limits key on socket IP (behind a proxy all users share a bucket) | `routes/auth.ts:8-22` | set trusted proxy count/CIDR and a scoped key generator |
| L-10 | Release "cleanup" removes `.env`/logs that were never copied; `seed.ts` with `password123` and example bootstrap password are still shipped | `scripts/package-release.ps1:37,90-94` | replace denylist with allowlist + post-build secret scan |
| L-11 | Docs diverge from code: `CLIENT_URL`, "temporary password printed once", broken example DB path; auto-backup schedule undocumented | `README.md:26,46,59,97`, `RELEASE-CHECKLIST.md:20-22,49` | single source of truth reconciled with code; add ops runbook |
| L-12 | Unreferenced `Departments.tsx`/`Designations.tsx`; `/departments` routes to `<Organization/>` which duplicates them | `App.tsx:46-47` | delete dead files or route to them |
| L-13 | No catch-all `Route path="*"` → blank content for unknown URLs | `App.tsx:36-52` | add a NotFound page |
| L-14 | Component factories created inside render (`GaugeChart`, `I`/`D`/`T`) → remount on every render, lost focus/animation | `Dashboard.tsx:71-93`, `EmployeeForm.tsx:68-70` | hoist to module scope |
| L-15 | `UIProvider` never clears toast timeouts or resolves pending confirm on unmount | `UIContext.tsx:26-43` | store timer IDs in a ref; cleanup in effect |
| L-16 | Confirm dialog lacks Escape/focus trap, uses `role="dialog"` not `alertdialog`, overlay click cancels | `UIContext.tsx:58-71` | Escape handler, focus trap, `alertdialog`, explicit Cancel |
| L-17 | Native `confirm()` used for destructive actions instead of `useUI().confirm` | `EmployeeProfile.tsx:71,79`, `Backup.tsx:22-23` | use the app dialog consistently |
| L-18 | Labels not associated with inputs (no `htmlFor`/`id`/`aria-label`) across all forms | `Login.tsx:68,83`, `EmployeeForm.tsx`, `Users.tsx:175-199`, `Reports.tsx:85-91`, others | add `id`/`htmlFor` or wrap inputs |
| L-19 | Console logging of internal errors | `api.ts:22`, `SearchSelect.tsx:50` | remove/gate by environment |
| L-20 | Broken static asset references (favicon, logo, background) — files not present in `client/public/theme-assets/images` | `client/index.html:5-7`, `Layout.tsx:69`, `index.css:67` | add assets or fix paths to existing `favicon.svg` |
| L-21 | `SearchSelect` omits `fetchOptions` from deps; `timerRef` typed `any`; no `.oxlintrc.json` despite docs | `SearchSelect.tsx:25,42-63` | `useCallback` + correct deps; type ref; commit lint config |
| L-22 | ~35 MB duplicate vendor assets + macOS junk: all 1,925 files in `client/public/theme-assets/` are exact duplicates of `ui-kit/theme-assets/` (and CKEditor/TinyMCE samples incl. PHP files are shipped). `ui-kit` additionally carries `__MACOSX` metadata. | `ui-kit/`, `client/public/theme-assets/` | keep one copy; delete unused samples/`__MACOSX`; add to gitignore if not shipped |

---

### INFO

- **I-01 — Inventory:** `storage/` contains `backups/`, `cnic-*`, `documents`, `father-pictures`, `logs`, `other-pictures`, `profile-pictures`, `config/app-settings.json` (`autoBackupEnabled: true`, `autoBackupTime: "14:01"`) and a valid 8.7 MB backup ZIP. `server/prisma/dev.db` is 15.6 MB. All are correctly gitignored today.
- **I-02 — No third-party secrets:** only local settings (`DATABASE_URL`, `PORT`, `JWT_SECRET`, `STORAGE_PATH`, `BACKUP_PATH`, `CLIENT_URL`) were found; no cloud/API keys. Credential-like values are the local defaults documented above.
- **I-03 — Dependency/tooling notes:** no `test`/`audit`/typecheck-only scripts, no CI, no `engines.node`, no `SECURITY.md`/`LICENSE` for the app (the UI kit is Themeforest-licensed), no process-manager/HTTPS/log-rotation config. `unzipper ^0.12.5` (used on the restore path) has had no release since 2022. Caret ranges everywhere make builds non-reproducible despite lockfiles.

---

## 3. What Is Done Well

- **No SQL/NoSQL injection:** all DB access goes through Prisma; no `$queryRaw*`/`$executeRaw*`, `child_process`, `exec` or `eval` in `server/src`.
- **Real server-side authorization:** `authMiddleware` is on every API router, `authorize()` gates writes/admin operations, the effective role is re-read from the DB per request, and inactive users are rejected per request. Client-side gating mirrors real permissions.
- **Self-protection guards:** cannot deactivate/delete yourself, demote your own admin role, or delete the last active admin.
- **Path handling on restore:** `safeBackupFilename()` and `extractZipSafe()` correctly use `basename`, strict regexes and separator-aware containment — sound zip-slip protection.
- **Passwords are bcrypt-hashed with per-password salts**; no plaintext/MD5/SHA; sanitizing helpers never return hashes.
- **Baseline hardening:** Helmet, `x-powered-by` disabled, explicit (if over-broad) CORS callback, login/password rate limits, global error handler that masks 500 details in production, `0.0.0.0` binding intentionally chosen for LAN, `/api/health` endpoint, backup scheduler with de-duplication, best-effort pre-restore safety backup.
- **No dangerous HTML injection on the client:** no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; all user-controlled values are React-escaped; media URLs `encodeURIComponent` the token.
- **Good effect hygiene:** most fetch effects use `mounted`/`cancelled` flags and clean up timers/listeners; UI state is centralized with `useCallback`/`useMemo`, `aria-live` regions and `autoFocus`.
- **Sensible documentation intent:** README and RELEASE-CHECKLIST are unusually thorough for a LAN app; the release script deliberately creates an empty `storage/` skeleton and copies `.env.example` while excluding `.env` — the intent is right, the DB-removal implementation (C-01) is what fails.
- **Lockfiles exist** for both client and server.

---

## 4. Prioritized Remediation Roadmap

**P0 — before any client handoff or LAN deployment**
1. C-01: rewrite release packaging as an allowlist + post-build assertion (no DB/env/storage data).
2. C-02: strong per-install `JWT_SECRET`, remove fallbacks, fail closed, rotate tokens.
3. C-03: remove hardcoded admin credentials and the login hint; require bootstrap password + forced rotation.
4. H-01: commit the real source after verifying ignore rules.
5. H-04: move `@prisma/client` to `dependencies`; verify a clean `npm ci --omit=dev` production build.

**P1 — before going live on a shared LAN**
6. H-03 + M-09: safe snapshot/restore with Prisma disconnect and atomic swap.
7. H-05 + M-01 + M-08: cookie-based auth (or scoped media tokens), redact token logs, strict CORS allowlist, enable CSP.
8. M-02 + M-03 + M-04: least-privilege data access, scoped image replacement, admin-only settings.
9. H-02: scrub/remove seed data from release; never seed ADMIN or known passwords.
10. M-10 + M-11 + M-18: fix `.env.example`, delete invalid `prisma.config.ts`, harden start scripts.

**P2 — quality & hardening**
11. M-05..M-17: token refresh, error boundary, double-submit guard, error handling, filter conflict, dev-server binding, SPA navigation.
12. L-01..L-21: password policy, upload/zip limits, a11y, dead code, asset paths, lint config.
13. L-22: remove the ~35 MB duplicate vendor assets and `__MACOSX` junk.
14. Add CI (`npm ci`, typecheck, `npm audit --audit-level=high`), smoke tests for `/api/health`/login/packaging, `SECURITY.md`, `LICENSE`, process-manager + HTTPS + log-rotation guidance.

---

## 5. Scope & Limitations

This was a static code review. No running instance was exploited, no credentials were tested against a live server, and dependency CVEs were not looked up in a vulnerability database (versions are noted for follow-up). Binary database/backup contents were not inspected beyond file headers and metadata. The `ui-kit/` theme dump was treated as third-party vendor assets and was not line-by-line reviewed. Findings should be re-validated after the P0/P1 fixes and followed by a dynamic security test on a staging copy.

---

*End of report — generated 2026-11-17.*
