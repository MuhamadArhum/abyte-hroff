# Abyte-EMS (Local LAN)

Abyte-EMS is a local employee management system (React + Vite client, Node/Express + Prisma/SQLite server) designed for **local LAN use**.

## What is included
- Employee records (profiles, departments, designations, status, documents/images)
- Departments & designations management
- Users & roles (Admin/Manager/Viewer)
- Dashboard and reports/exports
- Local file storage for uploads
- Manual and automatic backups, backup restore

## Requirements
- Node.js (LTS recommended)
- npm
- Windows PC/server on the same LAN (recommended for included `.bat` scripts)

## First-time setup (clean install)
1. **Install dependencies**
   - `cd server && npm install`
   - `cd client && npm install`
2. **Configure server environment**
   - Copy `server/.env.example` to `server/.env`
   - Set a strong, random `JWT_SECRET` of at least 32 characters (required). Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. The server refuses to start with a short or example value.
   - Set `NODE_ENV=production`
   - Set `CLIENT_URL` to the URLs clients will use (e.g. `http://<server-ip>:4000`)
   - **Required in production on a fresh database:** set `ADMIN_BOOTSTRAP_PASSWORD` (12+ chars with upper, lower, digit and symbol) before first start
3. **Initialize database**
   - `cd server`
   - `npm run prisma:generate`
   - `npm run prisma:push`
4. **Build for production/LAN**
   - `cd client && npm run build`
   - `cd server && npm run build`

## Run (Production/LAN)
### Recommended (Windows)
- Run `start-prod.bat` from the project root.
- Open:
  - Local: `http://localhost:4000`
  - LAN: `http://<server-pc-ip>:4000`
- Ensure Windows Firewall allows inbound access to the chosen port on the LAN profile.

### Manual
- `cd server`
- `set NODE_ENV=production` (PowerShell: `$env:NODE_ENV="production"`)
- `node dist/index.js`

> The server serves the built client (`client/dist`) automatically when present.

## Development mode (for maintenance)
- `start.bat` runs dev servers (Vite + `tsx watch`).
- Dev URLs (default): client `http://localhost:3001`, API server `http://localhost:4000`.
- Use dev mode only for development/maintenance, not for client delivery.

## Initial admin account
- On a **fresh database** (no users), the server creates an initial `admin` user.
- In production, `ADMIN_BOOTSTRAP_PASSWORD` must be set (12+ chars with upper, lower, digit and symbol); the server will refuse to start without it.
- In development only, if it is omitted, a **cryptographically random temporary password** is printed once in the server console.
- Generated and admin-created accounts are forced to change their password on first login. There are **no** shipped/default credentials.
- Do not ship a database with known/default credentials.

## Security notes (LAN)
- Use a **strong unique `JWT_SECRET`** per installation.
- Change the admin password immediately and enforce strong passwords for all users.
- Keep the app on a **trusted LAN**. Use firewall rules to restrict access.
- Login and password endpoints include rate limiting, but you should still protect the host machine and network.
- Sessions use short-lived access tokens in `HttpOnly` cookies with a rotating 7-day refresh token; password changes revoke existing sessions.
- Stored images/documents are served from the same origin and authenticated by the session cookie — **no JWT in URLs or `localStorage`**.
- `CLIENT_URL` is a strict origin allowlist; add every URL clients actually open (e.g. `http://<server-ip>:4000`). Set `TRUST_PROXY=true` only behind one trusted reverse proxy.
- A restrictive Content-Security-Policy is applied by the server in packaged mode.

## Data storage & backups
- **Database:** SQLite (`server/prisma/dev.db` by default)
- **Uploads/storage:** `storage/` (profile/CNIC/father/other images, documents)
- **Backups:** `storage/backups/`
- **App settings:** `storage/config/app-settings.json`

### Backup/restore
- Use the in-app **Backup & Restore** (Admin) to create backups and restore.
- A pre-restore safety backup is attempted automatically before restore.
- **Restore requires server restart** to fully reload data.
- Perform periodic backup/restore drills on a copy.

## Client delivery checklist (recommended)
- [ ] Build the package with `powershell -File scripts\package-release.ps1` — it copies only `schema.prisma` (no DB/seed) and aborts if any `.env`, `*.db`, log, or storage data remains. Verify its "created and verified clean" message.
- [ ] Keep `.env.example` files; set fresh secrets/config on client site
- [ ] Build client and server (`npm run build`)
- [ ] Verify LAN access, firewall, and file permissions for `storage/` and DB
- [ ] Create/change admin password and test user roles
- [ ] Test backup + restore on a copy

## Troubleshooting
- **Cannot access from LAN:** check server IP, port, firewall inbound rule, and that server is listening (`0.0.0.0`).
- **401/403 issues:** re-login (token expiry/role), verify user is active and has permission.
- **Uploads fail:** verify file size/type limits and writable `storage/` path.
- **Database/storage locked or restore issues:** stop server, restore from backup, restart server.
- **Blank page in production:** ensure `client/dist` exists and was built with the current code.

## Notes
- This system is intended for **local/LAN deployments**. For internet/public exposure, add HTTPS/reverse proxy, stronger hardening, monitoring, and a full security review.
- Bulk seed scripts (if present in dev tools) should not be run on client/production databases unless explicitly intended.
