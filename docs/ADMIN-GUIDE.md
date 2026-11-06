# Counting Day — Admin & Operator Guide

> Admin login now requires the fixed username and password supplied by the
> project owner. The existing **Lock** button signs out. Any password-token
> unlock steps below describe the old flow; see [ADMIN-AUTH.md](./ADMIN-AUTH.md).

Parvathipuram Manyam · ZPTC and MPTC · **7 Nov 2026**

This guide is for the person entering results on counting day. Give this file to your hall admin / desk operator.

---

## What this app does

There are **two screens**:

| Screen | URL | Who uses it |
| --- | --- | --- |
| **Public board** | `/` (e.g. `http://localhost:3000` or your live domain) | Everyone — candidates, booth teams, public |
| **Admin console** | `/admin` | Only counting officials |

When you **save** a seat on Admin, the public board updates **live** (within about **2 seconds**). You do not refresh the public page by hand.

The public board has **no Counter**. All vote entry happens only on `/admin`.

---

## Admin password

Ask your tech lead for the current password. Default for local setup:

```text
admincounting123
```

**How to unlock**

1. Open `/admin`
2. Enter the password in **Admin password**
3. Tap **Unlock**

Or open once:

```text
/admin?token=admincounting123
```

(Replace with the real password if it was changed.)

You will see **Unlocked** in the top bar. Use **Lock** when you leave the desk so others cannot write.

---

## Top bar (Admin)

| Control | Meaning |
| --- | --- |
| **Live** | Connection to the server is OK |
| **Unlocked / Locked** | Whether this browser can save results |
| **Operator** | Your name (shown on recent saves / logs). Set it before you start. |
| **Public board** | Opens the viewer in a new tab so you can check what people see |
| **Lock** | Locks admin on this browser until password is entered again |

---

## Overview numbers (Seat control)

At the top of Admin you see:

- **Started** — seats with counting or declared data / total seats  
- **Pending** — still “Yet to count”  
- **Kurupam ahead / behind** — Kurupam named seats that are winning or trailing  
- **ZP majority** — ZPTC seats ahead toward the majority need (**8**)

**Open next pending** jumps straight to the next seat that still needs a result.

---

## Finding a seat

Use the toolbar:

1. **Search** — type seat name, candidate, or mandal  
2. **Constituency** dropdown — Kurupam, Palakonda, Parvathipuram, Salur, or all  
3. **Mandal** dropdown — narrows further  
4. **Status** dropdown — All / Pending / Counting / Declared / Leading / Trailing  

Then use the **dropdown lists**:

- Tap a **constituency** row to expand it  
- Tap a **mandal** row to expand seats  
- Each mandal shows how many are **waiting** and **started**

Tap a **seat row** to open the entry popup.

---

## Entering a result (popup)

1. Set status:
   - **Yet to count** — empty / not started  
   - **Counting** — rounds in progress (numbers can change)  
   - **Declared** — final for that seat  
2. Enter **Our votes** (NDA / your candidate).  
3. Add **Rivals** — name, party (dropdown), votes. Use **+ Add rival** for more.  
4. Optional: **NOTA**, and a **round / source note** (e.g. “Round 3, Table 2”).  
5. Check the preview line (Winning / Trailing / etc.).  
6. Tap **Save result**.

While the popup is open, the page behind it does not scroll. **Cancel** or tap outside / Esc to close without saving.

### Placeholder seats (other mandals)

Some seats say **NDA candidate TBD**. In the popup you can fill:

- Seat name (when official name is known)  
- NDA candidate name + party  

Then save votes as usual.

### If someone else saved the same seat

You may see a conflict message:

- **Save anyway** — overwrite with your numbers  
- **Load theirs** — discard your draft and show what is on the server  

Talk to the other desk before overwriting.

---

## Public board (what viewers see)

URL: `/`

Tabs:

- **PPM Zilla Parishad** — district majority, Kurupam ZPTC hero, other ZPTCs, Kurupam MPTCs  
- **MPTC** — all mandals by constituency; tap a mandal for seat cards  

Empty seats show **Yet to count** until you save. After you save on Admin, this board updates live.

---

## Rehearsal tools (Admin only — right side)

Use **before** counting day for practice. Do **not** leave sample data live on the real day.

| Button | What it does |
| --- | --- |
| **Fill sample** | Fills fake results (marked as sample; public board shows a warning) |
| **Clear sample** | Removes only sample rows |
| **Clear all results** | Wipes counting numbers (tap twice to confirm). Keeps candidate names you entered on editable seats |

**Recent saves** shows the latest actions and operator names.

---

## Counting-day checklist

1. [ ] Open `/admin`, unlock with password, set **Operator** name  
2. [ ] Open **Public board** in a second tab or screen for the hall  
3. [ ] Confirm no sample banner on the public board (clear sample if needed)  
4. [ ] Enter seats as rounds come in → **Save result** each time  
5. [ ] For close seats, re-open and update votes → Save again  
6. [ ] When final, set status to **Declared** and Save  
7. [ ] **Lock** admin when the desk is unattended  

---

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Admin says Locked / cannot save | Enter the password again; check you are on `/admin` |
| Public board not updating | Wait ~2 seconds; check **Live** on admin; reload public tab |
| “That did not save” | Password / connection issue — unlock again, check network |
| Wrong numbers saved | Open the seat again, correct, **Save result** |
| Conflict message | Coordinate with other operators; Save anyway or Load theirs |
| Lost password | Ask the tech lead — password is in `.env.local` as `COUNTING_WRITE_TOKEN` |

---

## For the tech lead (short)

- Env: `COUNTING_WRITE_TOKEN` = admin password; optional `COUNTING_DB_PATH` for SQLite file  
- Data lives in SQLite (`data/counting.db` by default) — needs a **writable disk** in production  
- Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md) (Vercel UI + Render API/disk)  
- APIs: `GET/POST /api/results`, `GET/POST /api/log` (POST needs password)  
- Full API notes: [API.md](./API.md)  
- App README: [../README.md](../README.md)  

---

## Quick reference

```text
Public:   /
Admin:    /admin
Password: admincounting123   (change for production)
Flow:     Admin save → database → Public board (~2s)
```

If anything is unclear on counting day, call the tech contact before changing passwords or clearing all results.
