import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
// Fixed account verifier; the password never enters the browser bundle or database.
const PASSWORD_HASH = Buffer.from(
  "b37c41caa7deff49cb38c3bd745436dbe0b80dbb4ff4130ce2c83ff5ddb5bad032e747fba48c92cbb49f58ee45966708bbe12c5deb0df87d2b06c48286275ccb",
  "hex"
);

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdminAuthStore(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_login_limit (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      attempts INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `);

  return {
    login(username: unknown, password: unknown, now = Date.now()):
      | { status: 200; token: string; expiresAt: number }
      | { status: 401 | 429; retryAfter?: number } {
      // A shared account-wide budget cannot be bypassed by spoofing IP headers.
      const reserveAttempt = db.transaction(() => {
        const limit = db.prepare("SELECT attempts, reset_at FROM admin_login_limit WHERE id = 1")
          .get() as { attempts: number; reset_at: number } | undefined;
        if (limit && limit.reset_at > now && limit.attempts >= 10) {
          return Math.ceil((limit.reset_at - now) / 1000);
        }
        db.prepare(`INSERT INTO admin_login_limit (id, attempts, reset_at) VALUES (1, 1, ?)
          ON CONFLICT(id) DO UPDATE SET
          attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
          reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END`)
          .run(now + WINDOW_MS, now, now);
        return 0;
      });
      const retryAfter = reserveAttempt.immediate();
      if (retryAfter) return { status: 429, retryAfter };

      if (typeof username !== "string" || typeof password !== "string" ||
          username.length > 128 || password.length > 256) return { status: 401 };
      const validPassword = timingSafeEqual(
        scryptSync(password, "counting-admin-v1", 64), PASSWORD_HASH
      );
      if (username !== "admin" || !validPassword) return { status: 401 };

      const token = randomBytes(32).toString("hex");
      const expiresAt = now + ADMIN_SESSION_SECONDS * 1000;
      db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
      db.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)")
        .run(tokenHash(token), expiresAt);
      db.prepare("DELETE FROM admin_login_limit WHERE id = 1").run();
      return { status: 200, token, expiresAt };
    },
    verify(token: string | undefined, now = Date.now()): boolean {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
      return Boolean(db.prepare("SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?")
        .get(tokenHash(token), now));
    },
    logout(token: string | undefined) {
      if (token) db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash(token));
    },
  };
}
