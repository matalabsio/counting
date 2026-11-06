# Counting Day — Deployment (Render)

Live app = **one Next.js service** on Render with a **persistent disk** for SQLite.  
Do **not** deploy this app to Vercel alone — the vote database will not survive.

Repo: [https://github.com/matalabsio/counting](https://github.com/matalabsio/counting)

```text
Public /  +  Admin /admin  →  Render Web Service  →  /var/data/counting.db
```

---

## 1. Push code

```bash
git push -u origin main
```

Remote should be `https://github.com/matalabsio/counting.git`.

Secrets stay local (never commit):

- `.env.local`
- `data/counting.db*`

---

## 2. Create the Render service

### Option A — Blueprint (recommended)

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect **matalabsio/counting**
3. Apply [render.yaml](../render.yaml)
4. When prompted, set **`COUNTING_WRITE_TOKEN`** to a strong production password (not the sample)
5. Deploy

### Option B — Manual Web Service

1. **New** → **Web Service** → repo `matalabsio/counting`
2. Settings:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Instance | **Starter** or higher for counting day (avoid free sleep) |

3. **Disk**

| Field | Value |
| --- | --- |
| Name | `counting-data` |
| Mount path | `/var/data` |
| Size | 1 GB |

4. **Environment**

| Key | Value |
| --- | --- |
| `NODE_VERSION` | `20` |
| `NODE_ENV` | `production` |
| `COUNTING_DB_PATH` | `/var/data/counting.db` |
| `COUNTING_WRITE_TOKEN` | *your production admin password* |

5. Deploy and wait until the service is **Live**

---

## 3. Verify

| URL | Expect |
| --- | --- |
| `https://<service>.onrender.com/` | Public Viewer / MPTC |
| `https://<service>.onrender.com/admin` | Unlock form |
| Unlock with production password | Seat control + KPIs |
| Save one seat | Public `/` updates within ~2s |

```bash
curl -s https://<service>.onrender.com/api/results | head
# writeRequired should be true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<service>.onrender.com/api/results \
  -H "Content-Type: application/json" \
  -d '{"seatId":"zptc","delete":true}'
# expect 401 without password

curl -s -X POST https://<service>.onrender.com/api/results \
  -H "Authorization: Bearer YOUR_PRODUCTION_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"seatId":"zptc","force":true,"result":{"status":"counting","ours":1,"rivals":[],"updatedBy":"deploy-check"}}'
# expect {"ok":true,...}
```

---

## 4. Custom domain (optional)

1. Render → your service → **Settings** → **Custom Domains** → add e.g. `counting.yourdomain.com`
2. DNS: **CNAME** `counting` → `<service>.onrender.com` (as shown in the dashboard)
3. Wait for TLS to become **Certificate Issued**
4. Give hall staff:
   - Public: `https://counting.yourdomain.com/`
   - Admin: `https://counting.yourdomain.com/admin`

---

## 5. Counting-day ops

1. Set a strong `COUNTING_WRITE_TOKEN` before the day; share only with desks that enter votes  
2. Prefer a **non-free** Render plan so the service does not sleep mid-count  
3. Give operators [ADMIN-GUIDE.md](./ADMIN-GUIDE.md)  
4. Open public board on display screens; keep `/admin` on desk laptops only  
5. After the day: **Lock** admin browsers; optionally rotate the password  

---

## 6. Local vs production

| | Local | Production (Render) |
| --- | --- | --- |
| Password | `.env.local` → `COUNTING_WRITE_TOKEN` | Render env → `COUNTING_WRITE_TOKEN` |
| Database | `data/counting.db` | `/var/data/counting.db` on disk |
| Public | `http://127.0.0.1:3000/` | `https://<host>/` |
| Admin | `http://127.0.0.1:3000/admin` | `https://<host>/admin` |

Default sample password in docs/local: `admincounting123` — **change it on Render**.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Saves lost after redeploy | Disk missing or wrong `COUNTING_DB_PATH` |
| 401 on every save | Wrong / unset `COUNTING_WRITE_TOKEN` |
| Site sleeps / slow first load | Free tier spun down — upgrade plan for counting day |
| Build fails on `better-sqlite3` | Ensure Node 20 native build on Linux (Render default OK) |
| Health check fails | Confirm `npm start` and `/` returns 200 |

More API detail: [API.md](./API.md)
