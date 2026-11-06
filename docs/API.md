# Counting Day — API & data

> Authentication update: POST `/api/results` and `/api/log` now require the
> `HttpOnly` session cookie from POST `/api/auth` (JSON username/password).
> GET `/api/auth` checks the session; DELETE `/api/auth` revokes it. Bearer and
> URL write tokens no longer grant access, including in development. Public
> GET routes are unchanged. The token section below is historical.

Public board: `/` · polls every **2s** · Admin: `/admin` · writers use `COUNTING_WRITE_TOKEN`

## Auth (write token)

There are no external API keys. Writers authenticate with the env secret:

```bash
COUNTING_WRITE_TOKEN=admincounting123
```

Send it as:

- `Authorization: Bearer <token>`, or  
- `?token=<token>` on the URL

| Environment | Behaviour |
| --- | --- |
| Dev, token unset | Writes allowed (open) |
| Dev/prod, token set | Writes need the token (`writeRequired: true` on GET `/api/results`) |
| Production, token unset | Writes return `401` |

## Data flow

```text
Counting hall → /admin (or POST script) → counting.db → / (poll 2s)
```

## APIs

### `GET /api/results`

```json
{ "results": { "zptc": { "…" } }, "writeRequired": true }
```

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
    "sample": false,
    "updatedBy": "hall-desk-1"
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

1. Copy `.env.example` → `.env.local`, restart `npm run dev`  
2. `/` loads Viewer / MPTC only  
3. `/admin` shows Unlock when token is set; unlock with token  
4. Save a seat on `/admin` → public `/` Live pill updates within ~2s  
5. Unauthorized POST without token returns `401`  
6. `data/counting.db` persists after restart  
