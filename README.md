# Counting Day — Parvathipuram Manyam

Standalone Next.js app for live ZPTC / MPTC counting. Separate from the Constituency Explorer / ZP dashboard.

## Run

```bash
npm install
cp .env.example .env.local   # set COUNTING_WRITE_TOKEN for production
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

- **Viewer / MPTC** — public live board (polls every 2s)
- **Counter** — unlock with `?token=YOUR_TOKEN` (or unlock form)
- Empty seats show **○ Yet to count** until saved

## Env

| Variable | Purpose |
| --- | --- |
| `COUNTING_WRITE_TOKEN` | Bearer / `?token=` for Counter writes (required in production) |
| `COUNTING_DB_PATH` | SQLite path (default `data/counting.db`) |

Needs a **writable** disk on counting day (ephemeral hosts lose the DB).

## API

See [docs/API.md](docs/API.md).

| Method | Path |
| --- | --- |
| GET/POST | `/api/results` |
| GET/POST | `/api/log` |

## Stack

Next.js 16 · React 19 · better-sqlite3 · Node 20+
