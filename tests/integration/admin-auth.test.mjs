import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const password = process.env.COUNTING_TEST_ADMIN_PASSWORD;
assert.ok(password, "Set COUNTING_TEST_ADMIN_PASSWORD to the fixed admin password before running auth tests.");

async function startServer(env) {
  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { env: { ...process.env, NODE_ENV: "production", COUNTING_API_UPSTREAM: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  const url = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(url)).ok) return { child, url };
      } catch { /* wait for server */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start: ${output}`);
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function stopServer(server) {
  if (server.child.exitCode === null) {
    const exited = once(server.child, "exit");
    server.child.kill();
    await exited;
  }
}

test("direct and proxied servers enforce the complete auth lifecycle", { timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "counting-auth-test-"));
  const env = { COUNTING_DB_PATH: path.join(dir, "counting.db"), COUNTING_WRITE_TOKEN: "legacy-test-token" };
  let backend;
  let frontend;
  try {
    backend = await startServer(env);
    frontend = await startServer({ ...env, COUNTING_API_UPSTREAM: backend.url, COUNTING_DB_PATH: path.join(dir, "must-not-be-used.db") });
    for (const base of [backend.url, frontend.url]) {
      assert.equal((await fetch(base + "/")).status, 200);
      const page = await (await fetch(base + "/admin")).text();
      assert.match(page, /Sign in to admin/);
      assert.doesNotMatch(page, /Seat control/);
      for (const route of ["results", "log"]) {
        const res = await fetch(`${base}/api/${route}?token=legacy-test-token`, {
          method: "POST", headers: { authorization: "Bearer legacy-test-token", "content-type": "application/json" }, body: "{}",
        });
        assert.equal(res.status, 401);
      }
      const login = (body, extra = {}) => fetch(base + "/api/auth", {
        method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(body),
      });
      assert.equal((await login({ username: "admin", password: "wrong" })).status, 401);
      assert.equal((await login({ username: "admin", password }, { origin: "https://untrusted.invalid" })).status, 403);
      const res = await login({ username: "admin", password });
      assert.equal(res.status, 200);
      const setCookie = res.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      assert.match(setCookie, /SameSite=lax/i);
      const cookie = setCookie.split(";")[0];
      const headers = { cookie, "content-type": "application/json" };
      assert.equal((await (await fetch(base + "/api/auth", { headers })).json()).authenticated, true);
      assert.match(await (await fetch(base + "/admin", { headers })).text(), /Seat control/);
      const seatId = Object.keys((await import("../../src/lib/roster.ts")).BY_ID)[0];
      const result = { seatId, result: { status: "counting", ours: 123, rivals: [], nota: null, note: "auth integration", sample: true }, force: true };
      assert.equal((await fetch(base + "/api/results", { method: "POST", headers: { ...headers, origin: "https://untrusted.invalid" }, body: JSON.stringify(result) })).status, 403);
      assert.equal((await fetch(base + "/api/results", { method: "POST", headers, body: JSON.stringify(result) })).status, 200);
      const results = await (await fetch(base + "/api/results")).json();
      assert.equal(results.results[seatId].ours, 123);
      assert.equal((await fetch(base + "/api/log", { method: "POST", headers, body: JSON.stringify({ action: "auth integration", seat: seatId }) })).status, 200);
      const logout = await fetch(base + "/api/auth", { method: "DELETE", headers });
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);
      assert.equal((await fetch(base + "/api/results", { method: "POST", headers, body: JSON.stringify(result) })).status, 401);
      assert.match(await (await fetch(base + "/admin", { headers })).text(), /Sign in to admin/);
    }
    const session = await fetch(backend.url + "/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password }) });
    const cookie = session.headers.get("set-cookie").split(";")[0];
    await stopServer(frontend);
    frontend = undefined;
    await stopServer(backend);
    backend = await startServer(env);
    assert.equal((await (await fetch(backend.url + "/api/auth", { headers: { cookie } })).json()).authenticated, true);
    const results = await (await fetch(backend.url + "/api/results")).json();
    assert.ok(Object.values(results.results).some((result) => result.ours === 123));
  } finally {
    if (frontend) await stopServer(frontend);
    if (backend) await stopServer(backend);
    await rm(dir, { recursive: true, force: true });
  }
});
