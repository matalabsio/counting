import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { CountingResult, RivalVotes } from "@/lib/roster";

const DEFAULT_DIR = path.join(process.cwd(), "data");
const DEFAULT_DB = path.join(DEFAULT_DIR, "counting.db");

export function countingDbFile(): string {
  if (process.env.COUNTING_DB_PATH) return process.env.COUNTING_DB_PATH;
  return DEFAULT_DB;
}

export function countingWriteToken(): string | null {
  return process.env.COUNTING_WRITE_TOKEN?.trim() || null;
}

export function assertCountingWriteAuth(header: string | null, queryToken: string | null): boolean {
  const expected = countingWriteToken();
  if (!expected) {
    // Dev convenience: allow writes when no token configured (local only).
    return process.env.NODE_ENV !== "production";
  }
  if (queryToken && queryToken === expected) return true;
  if (!header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(m && m[1] === expected);
}

let cached: Database.Database | null = null;

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS counting_results (
      seat_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      ours INTEGER NOT NULL DEFAULT 0,
      rivals_json TEXT NOT NULL DEFAULT '[]',
      nota INTEGER,
      note TEXT NOT NULL DEFAULT '',
      sample INTEGER NOT NULL DEFAULT 0,
      cand_json TEXT,
      updated_at TEXT,
      updated_by TEXT
    );
    CREATE TABLE IF NOT EXISTS counting_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      by_user TEXT,
      seat TEXT,
      action TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_counting_log_at ON counting_log(at DESC);
  `);
}

export function getCountingDb(): Database.Database {
  const file = countingDbFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) {
    fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  }
  if (!cached) {
    cached = new Database(file);
    cached.pragma("journal_mode = WAL");
    cached.pragma("foreign_keys = ON");
    ensureSchema(cached);
  }
  return cached;
}

type ResultRow = {
  seat_id: string;
  status: string;
  ours: number;
  rivals_json: string;
  nota: number | null;
  note: string;
  sample: number;
  cand_json: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export function rowToResult(row: ResultRow): CountingResult {
  let rivals: RivalVotes[] = [];
  try {
    rivals = JSON.parse(row.rivals_json || "[]");
  } catch {
    rivals = [];
  }
  let cand: CountingResult["cand"];
  if (row.cand_json) {
    try {
      cand = JSON.parse(row.cand_json);
    } catch {
      cand = undefined;
    }
  }
  return {
    status: (row.status as CountingResult["status"]) || "pending",
    ours: row.ours ?? 0,
    rivals,
    nota: row.nota,
    note: row.note || "",
    sample: Boolean(row.sample),
    cand,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function listResults(): Record<string, CountingResult> {
  const db = getCountingDb();
  const rows = db.prepare("SELECT * FROM counting_results").all() as ResultRow[];
  const out: Record<string, CountingResult> = {};
  for (const row of rows) out[row.seat_id] = rowToResult(row);
  return out;
}

export function getResult(seatId: string): CountingResult | null {
  const db = getCountingDb();
  const row = db.prepare("SELECT * FROM counting_results WHERE seat_id = ?").get(seatId) as
    | ResultRow
    | undefined;
  return row ? rowToResult(row) : null;
}

export function upsertResult(
  seatId: string,
  body: CountingResult,
  opts?: { force?: boolean; expectedUpdatedAt?: string | null }
): { ok: true } | { ok: false; conflict: true; current: CountingResult } {
  const db = getCountingDb();
  const existing = getResult(seatId);
  if (
    !opts?.force &&
    existing &&
    (existing.updatedAt || null) !== (opts?.expectedUpdatedAt ?? null)
  ) {
    return { ok: false, conflict: true, current: existing };
  }

  db.prepare(
    `INSERT INTO counting_results (
      seat_id, status, ours, rivals_json, nota, note, sample, cand_json, updated_at, updated_by
    ) VALUES (
      @seat_id, @status, @ours, @rivals_json, @nota, @note, @sample, @cand_json, @updated_at, @updated_by
    )
    ON CONFLICT(seat_id) DO UPDATE SET
      status = excluded.status,
      ours = excluded.ours,
      rivals_json = excluded.rivals_json,
      nota = excluded.nota,
      note = excluded.note,
      sample = excluded.sample,
      cand_json = excluded.cand_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`
  ).run({
    seat_id: seatId,
    status: body.status,
    ours: body.ours,
    rivals_json: JSON.stringify(body.rivals ?? []),
    nota: body.nota,
    note: body.note ?? "",
    sample: body.sample ? 1 : 0,
    cand_json: body.cand ? JSON.stringify(body.cand) : null,
    updated_at: body.updatedAt,
    updated_by: body.updatedBy,
  });
  return { ok: true };
}

export function deleteResult(seatId: string) {
  getCountingDb().prepare("DELETE FROM counting_results WHERE seat_id = ?").run(seatId);
}

export function addLog(entry: { at: string; by: string | null; seat: string; action: string }) {
  getCountingDb()
    .prepare(
      `INSERT INTO counting_log (at, by_user, seat, action) VALUES (@at, @by_user, @seat, @action)`
    )
    .run({
      at: entry.at,
      by_user: entry.by,
      seat: entry.seat,
      action: entry.action,
    });
}

export function listLogs(limit = 40): { at: string; by: string | null; seat: string; action: string }[] {
  const rows = getCountingDb()
    .prepare(
      `SELECT at, by_user, seat, action FROM counting_log ORDER BY at DESC LIMIT ?`
    )
    .all(limit) as { at: string; by_user: string | null; seat: string; action: string }[];
  return rows.map((r) => ({ at: r.at, by: r.by_user, seat: r.seat, action: r.action }));
}
