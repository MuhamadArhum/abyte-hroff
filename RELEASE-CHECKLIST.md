# Abyte-EMS Release Checklist (Local LAN Client Delivery)

Use this checklist before handing over the system to a client.

## 1. Clean & prepare package
- [ ] Work from a clean copy of the source (not the live/working data folder).
- [ ] Remove or exclude sensitive/runtime data:
  - [ ] `server/.env` (keep `server/.env.example`)
  - [ ] `server/prisma/*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`
  - [ ] `storage/` contents (uploads, documents, backups, config) unless intentionally shipping sample data
  - [ ] `logs/`, temp files, local caches
- [ ] Do **not** include `node_modules` unless you are delivering a pre-bundled offline package intentionally.
- [ ] Ensure `.gitignore` rules are in place (root and server).

## 2. Configure target environment
- [ ] Copy `server/.env.example` to `server/.env` on the target machine.
- [ ] Set required values:
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` = strong unique random value
  - [ ] `DATABASE_URL="file:./dev.db"` (relative to `server/prisma/schema.prisma`; do NOT use `file:./prisma/dev.db`)
  - [ ] `STORAGE_PATH` and `BACKUP_PATH` (writable locations)
  - [ ] `CLIENT_URL` includes the actual LAN URL(s), e.g. `http://192.168.x.x:4000`
- [ ] **Required in production on a fresh DB:** set `ADMIN_BOOTSTRAP_PASSWORD` (12+ chars: upper, lower, digit, symbol). If omitted, a random password is printed once in dev only; production refuses to start.
- [ ] Confirm server PC clock/timezone is correct (affects timestamps/scheduled backups).

## 3. Install & build
- [ ] `cd server && npm install`
- [ ] `cd client && npm install`
- [ ] `cd server && npm run prisma:generate`
- [ ] `cd server && npm run prisma:push` (fresh DB)
- [ ] `cd client && npm run build`
- [ ] `cd server && npm run build`
- [ ] Verify `client/dist/index.html` and `server/dist/index.js` exist.

## 4. Start & network access
- [ ] Start in production mode (`start-prod.bat` or `cd server && set NODE_ENV=production && node dist/index.js`).
- [ ] Verify local access: `http://localhost:4000`
- [ ] Verify LAN access from another PC: `http://<server-ip>:4000`
- [ ] Configure Windows Firewall inbound rule for the app port (LAN profile as appropriate).
- [ ] (Optional) Configure auto-start/restart via Task Scheduler, NSSM, or PM2.

## 5. Security & admin setup
- [ ] First login uses the credentials you configured (or the random password printed once at startup).
- [ ] The app forces a password change on first login for generated/admin-created accounts. Verify this flow.
- [ ] Password policy: 12+ characters with upper and lower case, a digit and a symbol.
- [ ] Create required users/roles (ADMIN/MANAGER/VIEWER) and verify permissions.
- [ ] Confirm no default/placeholder secrets remain in `server/.env`.

## 6. Functional smoke test
- [ ] Login/logout, `/api/health` reachable, cookie-based session refresh and expiry behavior acceptable
- [ ] Confirm no JWT appears in browser URLs, server logs, or `localStorage`
- [ ] Employees: create, edit, view, search/filter/pagination, activate/deactivate, delete
- [ ] Uploads: profile, CNIC front/back, father/other images, documents (upload/replace/delete/view)
- [ ] Departments & designations: create/edit/delete/list and linkage to employees
- [ ] Users: list/create/edit/activate-deactivate/delete, role enforcement
- [ ] Dashboard and reports/exports (view, filters, export/print as applicable)
- [ ] Data persistence after server restart

## 7. Backup & recovery (must test on copy)
- [ ] Create a manual backup from the app.
- [ ] Verify automatic backup setting/schedule (if enabled) creates backups as expected.
- [ ] Perform a **restore test on a copy environment** (DB + storage/images/documents).
- [ ] Confirm restore completes, restart server, and validate restored data/files.
- [ ] Document backup location and recovery steps for the client.

## 8. Handoff package
- [ ] Provide: app files/builds, `server/.env.example`, `README.md`, `RELEASE-CHECKLIST.md`, and startup instructions.
- [ ] Provide admin credentials/setup steps securely (not in plain shared notes/logs).
- [ ] Record installed version/date, server IP/port, storage/backup paths, and support contacts.
- [ ] Keep a verified clean backup of the delivered baseline (without client-sensitive live data unless required).
