import { NextRequest, NextResponse } from "next/server";

/** When set (Vercel frontend), /api/* proxies to the Render app that holds SQLite. */
export function countingApiUpstream(): string | null {
  const raw = process.env.COUNTING_API_UPSTREAM?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function hasCountingApiUpstream(): boolean {
  return Boolean(countingApiUpstream());
}

export async function proxyCountingApi(
  req: NextRequest,
  apiPath: "/api/results" | "/api/log"
): Promise<NextResponse> {
  const base = countingApiUpstream();
  if (!base) {
    return NextResponse.json({ error: "Upstream not configured" }, { status: 500 });
  }

  const url = new URL(apiPath + req.nextUrl.search, base);
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(url, init);
  const body = await upstream.text();
  const out = new NextResponse(body, { status: upstream.status });
  const ct = upstream.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  return out;
}
