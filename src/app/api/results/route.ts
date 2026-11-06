import { NextRequest, NextResponse } from "next/server";
import { hasCountingApiUpstream, proxyCountingApi } from "@/lib/api-proxy";
import { BY_ID, type CountingResult } from "@/lib/roster";
import { ADMIN_COOKIE, hasAdminSession, isSameOriginMutation } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/results");

  const {
    listResults,
  } = await import("@/lib/db");

  return NextResponse.json({
    results: listResults(),
    writeRequired: true,
  });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (hasCountingApiUpstream()) return proxyCountingApi(req, "/api/results");

  if (!(await hasAdminSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    deleteResult,
    getResult,
    upsertResult,
  } = await import("@/lib/db");

  let body: {
    seatId?: string;
    result?: CountingResult;
    force?: boolean;
    expectedUpdatedAt?: string | null;
    delete?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const seatId = body.seatId;
  if (!seatId || !BY_ID[seatId]) {
    return NextResponse.json({ error: "Unknown seat" }, { status: 400 });
  }

  if (body.delete) {
    deleteResult(seatId);
    return NextResponse.json({ ok: true });
  }

  if (!body.result) {
    return NextResponse.json({ error: "Missing result" }, { status: 400 });
  }

  const result: CountingResult = {
    status: body.result.status || "pending",
    ours: Number(body.result.ours) || 0,
    rivals: Array.isArray(body.result.rivals) ? body.result.rivals : [],
    nota: body.result.nota ?? null,
    note: body.result.note || "",
    sample: Boolean(body.result.sample),
    cand: body.result.cand,
    updatedAt: new Date().toISOString(),
    updatedBy: body.result.updatedBy || "counter",
  };

  const saved = upsertResult(seatId, result, {
    force: Boolean(body.force),
    expectedUpdatedAt: body.expectedUpdatedAt ?? null,
  });

  if (!saved.ok) {
    return NextResponse.json(
      { error: "conflict", current: saved.current },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, result: getResult(seatId) });
}
