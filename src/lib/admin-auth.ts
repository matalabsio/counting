import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { countingApiUpstream } from "@/lib/api-proxy";
import { createAdminAuthStore } from "@/lib/admin-auth-store";

export const ADMIN_COOKIE = "counting_admin_session";

export async function adminAuthStore() {
  const { getCountingDb } = await import("@/lib/db");
  return createAdminAuthStore(getCountingDb());
}

export function isSameOriginMutation(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // Non-browser clients and the server-to-server proxy.
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function hasAdminSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const upstream = countingApiUpstream();
  if (upstream) {
    try {
      const res = await fetch(new URL("/api/auth", upstream), {
        headers: { cookie: `${ADMIN_COOKIE}=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!res.ok) return false;
      return (await res.json()).authenticated === true;
    } catch {
      return false;
    }
  }
  return (await adminAuthStore()).verify(token);
}

export async function isAdminAuthenticated() {
  return hasAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}
