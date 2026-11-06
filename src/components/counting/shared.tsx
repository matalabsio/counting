"use client";

import {
  STATUS_GLYPH,
  STATUS_LABEL,
  type CountingSeat,
  type DerivedKey,
} from "@/lib/roster";

export type LogEntry = { at: string; by: string | null; seat: string; action: string };

export const TOKEN_KEY = "counting_write_token";
export const OPERATOR_KEY = "counting_operator";
export const POLL_MS = 2000;

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function initials(seat: CountingSeat): string {
  const src = (seat.name || seat.seat || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function Chip({ k }: { k: DerivedKey }) {
  return (
    <span className={`chip k-${k}`}>
      <span aria-hidden>{STATUS_GLYPH[k]}</span> {STATUS_LABEL[k]}
    </span>
  );
}

export function PartyBadge({ party }: { party: string }) {
  const cls = ["TDP", "JSP", "BJP", "YSRCP", "INC"].includes(party)
    ? `party p-${party}`
    : "party";
  return <span className={cls}>{party || "—"}</span>;
}

export function Avatar({ seat, dKey }: { seat: CountingSeat; dKey: DerivedKey }) {
  return (
    <div className={`avatar ini k-${dKey}`} aria-hidden>
      {initials(seat)}
    </div>
  );
}

export function VoteBar({ ours, rival }: { ours: number; rival: number }) {
  const total = ours + rival;
  const pct = total > 0 ? (ours / total) * 100 : 50;
  return (
    <div className="bar" aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function lastResultUpdate(results: Record<string, { updatedAt?: string | null }>): string | null {
  const times = Object.values(results)
    .map((r) => r.updatedAt)
    .filter(Boolean) as string[];
  times.sort();
  return times.at(-1) ?? null;
}
