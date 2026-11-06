import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminAuthStore, hasAdminSession, isSameOriginMutation } from "@/lib/admin-auth";
import { ADMIN_SESSION_SECONDS } from "@/lib/admin-auth-store";
import { hasCountingApiUpstream, proxyCountingApi } from "@/lib/api-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/auth");
  return json({ authenticated: await hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value) });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return json({ error: "Forbidden" }, 403);
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "JSON required" }, 415);
  }
  if (Number(req.headers.get("content-length")) > 4096) return json({ error: "Request too large" }, 413);
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/auth");

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const store = await adminAuthStore();
  const result = store.login(body?.username, body?.password);
  if (result.status !== 200) {
    const res = json({ error: result.status === 429
      ? "Too many login attempts. Try again in 15 minutes."
      : "Invalid username or password." }, result.status);
    if (result.retryAfter) res.headers.set("Retry-After", String(result.retryAfter));
    return res;
  }

  // Rotate the browser's previous session after a successful login.
  store.logout(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = json({ authenticated: true });
  res.cookies.set(ADMIN_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginMutation(req)) return json({ error: "Forbidden" }, 403);
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/auth");
  (await adminAuthStore()).logout(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = json({ authenticated: false });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0,
  });
  return res;
}
