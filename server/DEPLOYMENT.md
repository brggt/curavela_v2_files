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

The running server checks one-hour reminders every minute. Downtime can miss reminders. Calendar feeds and reminders use the configured care-location zone: fall-back ambiguity selects the first occurrence; spring-forward gaps use the pre-transition offset. Test the care location across transitions. No SMS/push is provided; urgent coverage requires an independent coordination method.

## Data protection and backups

- Use restrictive filesystem access, encrypted persistent storage/backups, HTTPS, least-privilege operator access, and organization-approved retention. The app does not encrypt SQLite itself.
- Full backups must include accounts, publications, requests, and history, not just the manager's exported draft. Use a SQLite-consistent backup or stop the service before copying. Never copy only the main database while WAL writes are active.
- Test restoration to a separate isolated instance. Never commit database files, backups, `.env`, or invitation links.
- Team → Restore a saved team draft previews changes and restores one of up to 100 retained revisions as a new draft. Both preview and restore reject stale revisions. Restoration does not publish automatically.
- Avoid collecting request bodies/credentials in logs. Treat bootstrap logs as secrets.
- These controls do not establish regulatory compliance. Independent security/privacy review, appropriate hosting agreements, accessibility testing, and organizational processes are separate release requirements.

## Acceptance before deployment

Complete [REVIEW_CHECKLIST.md](../REVIEW_CHECKLIST.md), verify HTTPS cookies and role restrictions, reject stale edits from two manager sessions, verify persistence after restart/deploy, perform a backup/restore drill, and test email opt-out/idempotency/reminder timing. Maintain a rollback build and backup. Do not move a real caregiving workflow until the owner approves release.

## Container deployment package

`Dockerfile` runs as the unprivileged Node user and stores data at `/var/lib/curavela`. No hosting account or deployment is provisioned by this branch. Build and run on the chosen container host:

```sh
docker build -t curavela:3.1.0 .
docker volume create curavela-data
docker run --name curavela --restart unless-stopped --init \
  -p 127.0.0.1:3000:3000 \
  --env-file /private/curavela.env \
  -v curavela-data:/var/lib/curavela curavela:3.1.0
```

The private environment file needs `PUBLIC_URL=https://your-domain.example`, `CARE_TIME_ZONE=America/Chicago` (replace with the actual care location), and `BOOTSTRAP_EMAIL` for the first start. Add relay secrets only when email is configured. Put HTTPS in front of the private port; retain the named volume during updates. The container build itself still needs validation on the selected hosting platform.

## Consistent database backups

Run `node server/backup.js /private/backups/curavela-YYYY-MM-DD.sqlite` with `CURAVELA_DATA_DIR` pointing at the active database directory. This uses Node's SQLite backup API, so active WAL contents are included. The script refuses to replace an existing file and uses owner-only permissions. Copy the result to encrypted off-host storage under your chosen retention policy.

To restore, stop an **isolated test instance**, preserve its existing data directory, put the backup at its `curavela.sqlite` path in a fresh private directory (without old WAL/SHM files), set ownership for the app user, and restart. Check accounts, requests, draft, published shifts, history and calendar revocation. A database restore can restore old sessions/tokens, so operational recovery must account for those credentials. A draft-only restore in Team is separate from a full database restore.

## Private calendar links and swaps

Calendar links contain a random bearer token; only its hash is stored. Link rotation, revocation, and re-accepting an account invitation invalidate the previous link. Configure the HTTPS proxy to **redact calendar URLs and invitation tokens** from access logs. Calendar clients fetch without a session using that token; feeds contain only the owner's published shifts and cancellations, without care notes. The app and service worker never cache feeds. A client can retain old downloads after revocation.

A swap is pending until its target caregiver accepts from their own signed-in account. A manager cannot substitute a confirmation flag. The server rechecks both publications, draft assignments, availability and membership at approval; publication remains a separate action. Declining closes the request.

## Private two-account beta acceptance plan (not a production launch)

Use **fictitious caregiver names, no patient identifiers, and no real care notes** for this exercise. The existing Vercel static site remains the production reference and must not be switched to this server during the test.

1. Provision a **single-instance**, non-serverless Node.js 24+ test host with a dedicated encrypted persistent volume. Confirm that the provider preserves this volume across deploys and restarts; a path alone is not evidence of persistence.
2. Provide the host with `NODE_ENV=production`, `PUBLIC_URL` (the exact HTTPS origin), `CURAVELA_DATA_DIR` (an absolute directory on that volume), `CARE_TIME_ZONE`, and private `BOOTSTRAP_EMAIL`. Ensure the HTTPS proxy terminates TLS and that browser requests and the API share the same origin.
3. Run the existing test suite and syntax check. Start the server and accept the bootstrap invitation privately in a fresh browser profile. Remove `BOOTSTRAP_EMAIL` after initial setup, secure the invitation logs, and verify the session cookie is Secure, HttpOnly, SameSite=Strict.
4. As manager, create two fictitious caregiver profiles, save a draft, then issue a caregiver invitation. From another browser/profile, accept that invitation and log in.
5. Publish a known test week. Verify the caregiver can see **only their own** published shifts, and cannot read or edit the manager draft or another caregiver's records. Verify an unauthenticated browser cannot fetch private endpoints.
6. Change the schedule from the manager account, publish again, and verify the caregiver sees the new assignment after refreshing. Also confirm manager revision conflicts are rejected instead of silently overwriting changes.
7. Restart the container and perform a new deployment with the volume retained. Recheck account login, saved draft revision, published shifts, requests, and audit history.
8. Create a consistent SQLite backup, copy it to an encrypted off-host location, and perform a full restore into **a separate test instance**. Verify the restored data, and assess restored sessions/tokens before allowing access.
9. Document outcomes, remaining security findings, account offboarding, support contact, and recovery ownership. Keep the beta private and unapproved until all gates pass.

**Stop conditions:** any public test data leak, broken role isolation, data loss across restart, failed restore, HTTP access to credentials, or unexpected production deployment. Do not enable real caregiver use or collect protected health information from this checklist alone.
