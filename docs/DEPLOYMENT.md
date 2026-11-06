# Counting Day — Deployment

**Recommended production shape**

| Piece | Host | Role |
| --- | --- | --- |
| **Frontend + domain** | **Vercel** | Public `/` and Admin `/admin` UI |
| **API + SQLite** | **Render** + persistent disk | Saves votes; source of truth |

Vercel alone cannot keep SQLite. The Vercel app proxies `/api/*` to Render when `COUNTING_API_UPSTREAM` is set.

```text
Users → counting.yourdomain.com (Vercel UI)
              │
              │  /api/results, /api/log  (proxied)
              ▼
         Render Web Service + disk → /var/data/counting.db
```

Repo: [https://github.com/matalabsio/counting](https://github.com/matalabsio/counting)

---

## 1. Push code

```bash
git push origin main
```

Never commit: `.env.local`, `data/counting.db*`.

---

## 2. Deploy API + DB on Render (first)

### Blueprint

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect **matalabsio/counting** → apply [render.yaml](../render.yaml)
3. Set **`COUNTING_WRITE_TOKEN`** to a strong production password
4. Deploy → note the URL, e.g. `https://counting-day.onrender.com`

### Manual (same settings)

| Field | Value |
| --- | --- |
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Disk mount | `/var/data` (1 GB) |
| `COUNTING_DB_PATH` | `/var/data/counting.db` |
| `COUNTING_WRITE_TOKEN` | production admin password |
| `NODE_VERSION` | `20` |
| Plan | **Starter+** for counting day (avoid free sleep) |

### Verify Render

```bash
curl -s https://counting-day.onrender.com/api/results
# writeRequired: true

curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://counting-day.onrender.com/api/results \
  -H "Content-Type: application/json" \
  -d '{"seatId":"zptc","delete":true}'
# 401 without password
```

---

## 3. Deploy frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import **matalabsio/counting**
2. Framework: **Next.js** (default)
3. **Environment variables** (Production + Preview if you want):

| Key | Value |
| --- | --- |
| `COUNTING_API_UPSTREAM` | `https://counting-day.onrender.com` (your Render URL, no trailing slash) |

4. Do **not** set `COUNTING_DB_PATH` or a local SQLite path on Vercel  
5. Deploy

The UI stays on Vercel; browser calls `/api/...` on the same domain; Vercel route handlers **proxy** to Render.

### Custom domain on Vercel

1. Project → **Settings** → **Domains** → add `counting.yourdomain.com`
2. Add the DNS records Vercel shows (usually CNAME / A)
3. Give the hall:
   - Public: `https://counting.yourdomain.com/`
   - Admin: `https://counting.yourdomain.com/admin`

---

## 4. End-to-end check

1. Open Vercel domain `/` — public board loads  
2. Open `/admin` — unlock with the **same** password as Render `COUNTING_WRITE_TOKEN`  
3. Save a seat → public board updates within ~2s  
4. Confirm data survives Render restart (disk)

---

## 5. Env cheat sheet

| Variable | Render | Vercel |
| --- | --- | --- |
| `COUNTING_WRITE_TOKEN` | Required (real password) | Not required (auth checked on Render) |
| `COUNTING_DB_PATH` | `/var/data/counting.db` | unset |
| `COUNTING_API_UPSTREAM` | unset | `https://<render-service>.onrender.com` |
| `NODE_ENV` | `production` | set by Vercel |

Local dev: leave `COUNTING_API_UPSTREAM` unset; use `.env.local` + `data/counting.db`.

---

## 6. Admin (hall operators)

See [ADMIN-GUIDE.md](./ADMIN-GUIDE.md).

- Unlock `/admin` with the production password  
- Set **Operator** name  
- Save seats → live public board  

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Vercel `/api` 500 / SQLite errors | Set `COUNTING_API_UPSTREAM` to the Render URL |
| Saves work on Render URL but not Vercel domain | Upstream env missing/wrong; redeploy Vercel |
| 401 on admin save | Password must match Render `COUNTING_WRITE_TOKEN` |
| Data lost after Render redeploy | Disk not mounted or wrong `COUNTING_DB_PATH` |
| Cold / sleeping API | Render free tier slept — use Starter+ on counting day |

API reference: [API.md](./API.md)
