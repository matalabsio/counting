# Admin authentication

Open `/admin` and enter the fixed username and password supplied by the project
owner. Verification happens on the server against a scrypt password verifier;
the password is not included in the client bundle. The logged-in admin UI and
the public board reuse their existing components and styles.

Successful login issues an opaque, 12-hour `HttpOnly`, `SameSite=Lax` cookie
(`Secure` in production). Only a SHA-256 hash of the random session token is
stored in SQLite. **Lock** revokes that session and clears its cookie. Multiple
operators can have separate sessions for the shared account. Expired sessions
cannot write; reload `/admin` to sign in again.

Both write routes require this session in development and production. Legacy
`COUNTING_WRITE_TOKEN`, bearer-token, and URL-token access no longer authorizes
writes. Existing public GET routes remain public. There is no registration,
password reset, or additional user management.

The login attempt budget is shared in SQLite, so restarting the app or changing
an IP header cannot reset it. Ten attempts in 15 minutes temporarily block new
logins for the remainder of that window. Existing sessions continue working.
This account-wide limit deliberately also applies across operators.

If `COUNTING_API_UPSTREAM` is configured, all login and session operations go to
that backend, which also validates writes. Deploy the auth revision on both
hosts. In production, both hosts must use HTTPS.

See [EC2-DEPLOYMENT.md](./EC2-DEPLOYMENT.md) for the new EC2 deployment path. Older
Render/write-token instructions describe the previous authentication behavior.

Validation uses Node 22.18+ or Node 24. Set `COUNTING_TEST_ADMIN_PASSWORD` to the
fixed password in your local shell (never commit it), then run `npm test`,
`npm run build`, and `npm run lint`. The integration checks require a completed
production build: `npm run test:integration`. They use disposable databases.
