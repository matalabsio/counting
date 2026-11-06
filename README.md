# Counting Day — Parvathipuram Manyam

Standalone Next.js app for live ZPTC / MPTC counting.

## Complete setup

```bash
npm install
cp .env.example .env.local   # already has COUNTING_WRITE_TOKEN sample
npm run dev
```

| URL | Who | What |
| --- | --- | --- |
| [http://127.0.0.1:3000](http://127.0.0.1:3000) | Public | Live Viewer / MPTC board (polls every 2s) |
| [http://127.0.0.1:3000/admin](http://127.0.0.1:3000/admin) | Officials | Manual counting console |

### Admin password

Public `/` has **no Counter** — Viewer / MPTC only. All writes go through `/admin`.

| Variable | Purpose |
| --- | --- |
| `COUNTING_WRITE_TOKEN` | Admin password for `/admin` and `POST /api/*` |
| `COUNTING_DB_PATH` | Optional SQLite path (default `data/counting.db`) |

Default password:

```text
admincounting123
```

Unlock: open `/admin` and enter the password, or `/admin?token=admincounting123` once.

Set your **Operator** name in the top bar after unlock. Restart `npm run dev` after editing `.env.local`.

Production: **frontend on Vercel** (custom domain) + **API/DB on Render** (persistent disk). See deploy guide.

## Flow

```text
Vercel UI (/ and /admin) → /api/* proxy → Render SQLite → live poll ~2s
```

## Guides

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Vercel frontend + Render API/disk + domain
- **[docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)** — give this to the hall admin / operator
- [docs/API.md](docs/API.md) — API reference
- [render.yaml](render.yaml) — Render Blueprint (API + `/var/data` disk)
- [vercel.json](vercel.json) — Vercel project marker

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/results` | Public |
| POST | `/api/results` | Bearer token or `?token=` |
| GET | `/api/log` | Public |
| POST | `/api/log` | Bearer token or `?token=` |

Example write:

```bash
curl -X POST http://127.0.0.1:3000/api/results \
  -H "Authorization: Bearer admincounting123" \
  -H "Content-Type: application/json" \
  -d '{"seatId":"zptc","force":true,"result":{"status":"counting","ours":100,"rivals":[{"name":"Rival","party":"YSRCP","votes":80}],"updatedBy":"desk-1"}}'
```

## Stack

Next.js 16 · React 19 · better-sqlite3 · Node 20+
