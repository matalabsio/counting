# Counting Day — API & data

Live board: `/` · Viewer polls every **2s** · Counter writes with token · empty seats = **○ Yet to count**

## Required

| Need | How |
| --- | --- |
| App | `npm install && npm run dev` |
| SQLite | Auto-created at `data/counting.db` (or `COUNTING_DB_PATH`) |
| Write token | `COUNTING_WRITE_TOKEN` in `.env.local` (required in production) |

```bash
COUNTING_WRITE_TOKEN=your-secret
```

- **GET** — public  
- **POST** — `Authorization: Bearer <token>` or `?token=`  
- Local without token: writes allowed. Production without token: `401`.

## Gov data → UI

```text
Counting hall → Counter or POST script → counting.db → / (poll 2s)
```

| Feed | How |
| --- | --- |
| Counter | `/?token=…` → enter seat → Save |
| CSV / sheet | Map to `seatId` → `POST /api/results` |

## APIs

### `GET /api/results`

`{ "results": { "zptc": { … } }, "writeRequired": true }`

### `POST /api/results` (writers)

```json
{
  "seatId": "zptc",
  "force": false,
  "expectedUpdatedAt": null,
  "result": {
    "status": "counting",
    "ours": 100,
    "rivals": [{ "name": "R", "party": "YSRCP", "votes": 80 }],
    "nota": null,
    "note": "",
    "sample": false
  }
}
```

Delete: `{ "seatId": "zptc", "delete": true }`

| Status | Meaning |
| --- | --- |
| `200` | Saved |
| `400` | Bad body / unknown seat |
| `401` | Auth failed |
| `409` | Conflict (`force: true` to overwrite) |

### `GET /api/log` · `POST /api/log`

Log GET returns newest 40. POST body: `{ "seat", "action", "by" }` (writers).

## Checklist

1. `/` loads  
2. `GET /api/results` and `GET /api/log` OK  
3. Production token set  
4. Unlock Counter, save seat → Viewer updates ~2s  
5. `data/counting.db` persists after restart  
