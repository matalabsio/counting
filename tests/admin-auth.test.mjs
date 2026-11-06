import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { createAdminAuthStore } from "../src/lib/admin-auth-store.ts";

const password = process.env.COUNTING_TEST_ADMIN_PASSWORD;
assert.ok(password, "Set COUNTING_TEST_ADMIN_PASSWORD to the fixed admin password before running auth tests.");

function setup() {
  return createAdminAuthStore(new Database(":memory:"));
}

test("rejects invalid credentials and accepts the configured admin", () => {
  const auth = setup();
  assert.equal(auth.login("other", password).status, 401);
  assert.equal(auth.login("admin", "wrong").status, 401);
  const result = auth.login("admin", password);
  assert.equal(result.status, 200);
  assert.equal(auth.verify(result.token), true);
});

test("sessions cannot be forged, expire, and are revoked on logout", () => {
  const auth = setup();
  const result = auth.login("admin", password, 1000);
  assert.equal(auth.verify(undefined, 1001), false);
  assert.equal(auth.verify("forged", 1001), false);
  assert.equal(auth.verify(result.token + "a", 1001), false);
  assert.equal(auth.verify(result.token, result.expiresAt), false);
  assert.equal(auth.verify(result.token, 1001), true);
  auth.logout(result.token);
  assert.equal(auth.verify(result.token, 1001), false);
});

test("only token hashes are stored and sessions survive store recreation", () => {
  const db = new Database(":memory:");
  const auth = createAdminAuthStore(db);
  const result = auth.login("admin", password);
  const row = db.prepare("SELECT token_hash FROM admin_sessions").get();
  assert.notEqual(row.token_hash, result.token);
  assert.equal(createAdminAuthStore(db).verify(result.token), true);
});

test("login throttling persists and recovers after its window", () => {
  const db = new Database(":memory:");
  const auth = createAdminAuthStore(db);
  for (let i = 0; i < 10; i++) assert.equal(auth.login("admin", "wrong", 1000).status, 401);
  assert.equal(createAdminAuthStore(db).login("admin", password, 1001).status, 429);
  assert.equal(auth.login("admin", password, 1000 + 15 * 60 * 1000).status, 200);
});
