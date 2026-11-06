import { NextRequest, NextResponse } from "next/server";
import { hasCountingApiUpstream, proxyCountingApi } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/log");

  const { listLogs } = await import("@/lib/db");
  return NextResponse.json({ logs: listLogs(40) });
}

export async function POST(req: NextRequest) {
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/log");

  const { addLog, assertCountingWriteAuth } = await import("@/lib/db");

  const auth = assertCountingWriteAuth(
    req.headers.get("authorization"),
    req.nextUrl.searchParams.get("token")
  );
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
