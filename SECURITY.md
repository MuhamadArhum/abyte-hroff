# Security Policy

Abyte-EMS is designed for trusted local/LAN deployments. Report suspected vulnerabilities privately to the maintainer rather than opening a public issue.

## Supported versions

Use the latest delivered build. Security fixes are applied to the main branch.

## Deployment requirements

- Set a unique, random `JWT_SECRET` (32+ characters) in `server/.env`. The server refuses to start with short or example values.
- Set `ADMIN_BOOTSTRAP_PASSWORD` in production on a fresh database (12+ characters, upper/lower/digit/symbol). Generated and admin-created accounts must change their password on first login.
- Set `CLIENT_URL` to the exact origins clients use. Do not expose the service to the public internet; use a reverse proxy with HTTPS if remote access is required.
- Keep `server/.env`, `server/prisma/*.db`, and `storage/` out of source control and out of handoff packages. Use `scripts/package-release.ps1` to build a verified clean package.
- Restrict network access with firewall rules and keep the host patched.

## Reporting

Include affected version/file, reproduction steps, and impact. Please do not include real employee data in reports.
