# EC2 deployment (not yet deployed)

The backend already lives in this Next.js app: `/api/results`, `/api/log`, and
`/api/auth`. It uses `better-sqlite3`. Run one server process with a persistent
EBS volume; do not use an autoscaling fleet sharing a SQLite file.

We will create the instance together later. No AWS resources have been created.
The simplest setup hosts both the UI and backend on one EC2 instance. The
existing Vercel frontend can also point at this backend, as described below.

## 1. Create the instance

In your chosen AWS region, launch Ubuntu 24.04 LTS, x86_64, with at least 2 GiB
RAM, an encrypted EBS root volume, and an SSH key pair. Allow SSH (22) only from
your IP and allow HTTP/HTTPS (80/443). Keep port 3000 private. Allocate an Elastic
IP if the address must survive stop/start, then point a domain's A record to it.

## 2. Prepare the server

Connect with SSH as `ubuntu`. Install Git, Nginx, build tools, Python, Certbot
with its Nginx plugin, and a system-wide Node.js 24 LTS runtime (Node 22.18+ also
works). Confirm `node` is available at `/usr/bin/node`, or adjust `ExecStart` in
the service file to the actual absolute path.

```bash
sudo apt update
sudo apt install -y git nginx build-essential python3 certbot python3-certbot-nginx
sudo useradd --system --no-create-home --home-dir /var/lib/counting --shell /usr/sbin/nologin counting
sudo install -d -o counting -g counting -m 700 /var/lib/counting
sudo install -d -o counting -g counting -m 755 /opt/counting
sudo -u counting git clone https://github.com/matalabsio/counting.git /opt/counting
cd /opt/counting
sudo -u counting npm ci
# For tests only, enter the fixed admin password without saving it to a file.
read -s -p 'Admin password for tests: ' COUNTING_TEST_ADMIN_PASSWORD
export COUNTING_TEST_ADMIN_PASSWORD
sudo -u counting --preserve-env=COUNTING_TEST_ADMIN_PASSWORD npm test
sudo -u counting npm run build
```

Deploy the reviewed revision containing the auth changes. For a private repo,
use a read-only deploy key; never copy your AWS or personal Git credentials into
the application. The service user needs its home directory for npm's cache.

## 3. Configure persistent SQLite and start the service

Create `/etc/counting.env` with these values, owned by root and mode `600`:

```dotenv
NODE_ENV=production
COUNTING_DB_PATH=/var/lib/counting/counting.db
```

Leave `COUNTING_API_UPSTREAM` unset on EC2. The fixed admin account is verified
by this server; no password or write token needs to be added to the environment.
Vote tables are unchanged. Auth adds session and login-throttle tables to the
same SQLite database. If migrating existing votes, stop the old writer and use
SQLite's backup API or `.backup` command to transfer a consistent database;
copying only a live `.db` file can lose WAL data. Restore it at the path above,
owned by `counting:counting` with mode `600`, before starting the service.

```bash
sudo cp deploy/counting.service /etc/systemd/system/counting.service
sudo systemctl daemon-reload
sudo systemctl enable --now counting
sudo systemctl status counting
```

## 4. Configure the domain and HTTPS

Replace `counting.example.com` in `deploy/nginx.conf` with the real domain.
Copy it to `/etc/nginx/sites-available/counting`, enable it using a symlink in
`/etc/nginx/sites-enabled`, and disable the default Nginx site if necessary.

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d counting.example.com --redirect
sudo certbot renew --dry-run
```

Use HTTPS before testing login: production session cookies are `Secure` and
will not work over a plain HTTP connection to the instance IP. Nginx forwards
the original Host header, which the mutation origin checks require.

## 5. Optional: keep the frontend on Vercel

Deploy the same revision to Vercel and set `COUNTING_API_UPSTREAM` there to the
EC2 backend's HTTPS URL. Leave the SQLite path unset on Vercel. Login, session
validation, logout, and writes are verified on EC2. The proxy passes only the
admin session cookie and relays `Set-Cookie`; sessions never live in browser
storage. Do not point EC2 back at Vercel (that would create a proxy loop).

## 6. Verify and operate

- `/` remains public; `/admin` shows the new username/password login.
- Invalid credentials fail; valid credentials open the existing admin console.
- Saving a seat still updates the public board; verify on a disposable seat or
  staging database before using real counting data.
- The existing **Lock** button revokes the server session and returns to login.
- Direct POST requests to `/api/results` and `/api/log` without a valid session
  return `401`, even with a legacy bearer or URL token.
- Restart the service and verify votes and active sessions survive.
- Sessions expire after 12 hours. Ten attempts per 15-minute window trigger a
  shared account-wide login limit. Wait for the window to reset if locked out.

Use `sudo journalctl -u counting` for server logs. Back up SQLite using its
backup API, plus EBS snapshots, and test restoration. EBS storage survives a
service restart; deleting a volume or terminating with delete-on-termination
enabled can destroy data.

For updates, back up the database, fetch the reviewed revision, run `npm ci`,
`npm test`, and `npm run build`, then restart the service. Keep the previous
revision for rollback. Do not run `next dev` in production.
