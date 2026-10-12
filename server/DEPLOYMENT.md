# Optional team server

Implemented and API-tested, **not deployed or security-audited**. Use fictitious data until release checks pass. Hosting/domain, persistent storage, backup policy, email relay, and operational ownership need configuration outside this repository.

## Architecture

One team per installation, one Node.js 24+ process, one SQLite database, same-origin frontend/API. Do not use multiple replicas sharing a SQLite file. GitHub Pages cannot run this service. Serve at the domain root, not a subpath. Put a supported HTTPS proxy/platform in front of the private Node port.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PUBLIC_URL` | Exact origin, e.g. `https://schedule.example.org`, no path or trailing slash. Hosted service requires HTTPS. |
| `PORT` | Internal port; default 3000. |
| `HOST` | Default 127.0.0.1; use 0.0.0.0 only when required by protected container networking. |
| `CARE_TIME_ZONE` | IANA care-location zone such as America/Chicago; default UTC. |
| `CURAVELA_DATA_DIR` | Private persistent directory for database and WAL files, not an ephemeral deployment disk. |
| `BOOTSTRAP_EMAIL` | First manager's email; prints a private one-use invitation when no manager exists. Remove after setup. |
| `EMAIL_RELAY_URL` | Optional HTTPS notification endpoint. |
| `EMAIL_RELAY_TOKEN` | Optional relay bearer token; use the host's secret manager, never Git. |

Run `npm test`, `npm run check`, then `npm start`. No package install/build is required. For **local fictitious-data testing**:

```sh
BOOTSTRAP_EMAIL=manager@example.test CARE_TIME_ZONE=America/Chicago npm start
```

Open the private invitation printed in the terminal. No invitation email is sent. Do not share logs containing invitation links. Create a manager password, add fictitious caregivers, then Team → Sync draft. Use another browser profile to accept a caregiver invitation. Publish selected dates and verify My shifts.

## Accounts and recovery

Passwords are salted scrypt hashes; tokens are stored hashed. Sessions expire after 12 hours and use HttpOnly/SameSite=Strict cookies (Secure on HTTPS). Writes require the configured Origin and custom request header. Do not disable these controls to work around hosting errors.

Invitations expire after 72 hours and are single-use. A manager can issue a new invitation to an existing email for manual password recovery. Acceptance changes credentials and revokes previous sessions. A caregiver profile cannot link to multiple accounts. Keep at least one manager.

There is no MFA, SSO, self-service reset email, member-deactivation UI, or multi-tenant isolation layer. The sign-in rate limiter is in-memory and keyed by connecting IP; proxied users may share a limit. Establish reviewed offboarding/recovery and operational procedures before real use.

## Email relay

HTTPS POST JSON `{to, subject, text, id}` with `Authorization: Bearer …` and `Idempotency-Key`. The relay must authenticate, enforce sender/domain policy, and deduplicate IDs. A 2xx response becomes `accepted`, not `delivered`. Failures retry up to three attempts. No delivery/bounce webhooks are implemented. Preferences default off; in-app notifications work without email configuration.

The running server checks one-hour reminders every minute. Downtime can miss reminders. DST-ambiguous/nonexistent times use Node's local-time interpretation: test the care location's zone across transitions. No SMS/push is provided; urgent coverage requires an independent coordination method.

## Data protection and backups

- Use restrictive filesystem access, encrypted persistent storage/backups, HTTPS, least-privilege operator access, and organization-approved retention. The app does not encrypt SQLite itself.
- Full backups must include accounts, publications, requests, and history, not just the manager's exported draft. Use a SQLite-consistent backup or stop the service before copying. Never copy only the main database while WAL writes are active.
- Test restoration to a separate isolated instance. Never commit database files, backups, `.env`, or invitation links.
- Internal recent draft snapshots exist, but there is no manager-facing server-snapshot restoration screen. Restoring a JSON draft does not publish it automatically.
- Avoid collecting request bodies/credentials in logs. Treat bootstrap logs as secrets.
- These controls do not establish regulatory compliance. Independent security/privacy review, appropriate hosting agreements, accessibility testing, and organizational processes are separate release requirements.

## Acceptance before deployment

Complete [REVIEW_CHECKLIST.md](../REVIEW_CHECKLIST.md), verify HTTPS cookies and role restrictions, reject stale edits from two manager sessions, verify persistence after restart/deploy, perform a backup/restore drill, and test email opt-out/idempotency/reminder timing. Maintain a rollback build and backup. Do not move a real caregiving workflow until the owner approves release.
