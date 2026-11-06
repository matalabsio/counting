import { NextRequest, NextResponse } from "next/server";
import { hasCountingApiUpstream, proxyCountingApi } from "@/lib/api-proxy";
import { ADMIN_COOKIE, hasAdminSession, isSameOriginMutation } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/log");

  const { listLogs } = await import("@/lib/db");
  return NextResponse.json({ logs: listLogs(40) });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/log");

  if (!(await hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { addLog } = await import("@/lib/db");

  let body: { seat?: string; action?: string; by?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  addLog({
    at: new Date().toISOString(),
    by: body.by || "counter",
    seat: body.seat || "",
    action: body.action,
  });

  return NextResponse.json({ ok: true });
}
