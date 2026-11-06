"use client";

import {
  ALL_MPTC,
  BY_ID,
  CONS,
  DERIVE_ORDER,
  KURUPAM_SEATS,
  MN,
  PARTIES,
  ROSTER,
  STATUS_GLYPH,
  STATUS_LABEL,
  SHOW,
  ZP_MAJORITY_NEED,
  ZP_SEATS,
  derive,
  effectiveSeat,
  fmt,
  marginText,
  num,
  type CountingResult,
  type CountingSeat,
  type DerivedKey,
  type DerivedResult,
  type ResultStatus,
} from "@/lib/roster";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Tab = "viewer" | "mptc" | "counter";
type LogEntry = { at: string; by: string | null; seat: string; action: string };

const TOKEN_KEY = "counting_write_token";
const POLL_MS = 2000;

function fmtTime(iso: string | null | undefined): string {
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

function initials(seat: CountingSeat): string {
  const src = (seat.name || seat.seat || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function Chip({ k }: { k: DerivedKey }) {
  return (
    <span className={`chip k-${k}`}>
      <span aria-hidden>{STATUS_GLYPH[k]}</span> {STATUS_LABEL[k]}
    </span>
  );
}

function PartyBadge({ party }: { party: string }) {
  const cls = ["TDP", "JSP", "BJP", "YSRCP", "INC"].includes(party)
    ? `party p-${party}`
    : "party";
  return <span className={cls}>{party || "—"}</span>;
}

function Avatar({ seat, dKey }: { seat: CountingSeat; dKey: DerivedKey }) {
  return (
    <div className={`avatar ini k-${dKey}`} aria-hidden>
      {initials(seat)}
    </div>
  );
}

function VoteBar({ ours, rival }: { ours: number; rival: number }) {
  const total = ours + rival;
  const pct = total > 0 ? (ours / total) * 100 : 50;
  return (
    <div className="bar" aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

type SheetState = {
  id: string;
  base: string | null;
  force: boolean;
  status: ResultStatus;
  ours: string;
  nota: string;
  note: string;
  rivals: { name: string; party: string; votes: string }[];
  cname: string;
  cparty: string;
  sname: string;
};

export function CountingDayApp() {
  const [tab, setTab] = useState<Tab>("viewer");
  const [results, setResults] = useState<Record<string, CountingResult>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [writeRequired, setWriteRequired] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [mptcMandal, setMptcMandal] = useState<string | null>(null);
  const [viewerFilter, setViewerFilter] = useState<"all" | "lead" | "trail" | "wait">("all");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetMsg, setSheetMsg] = useState<ReactNode>(null);
  const [saving, setSaving] = useState(false);
  const [toolMsg, setToolMsg] = useState("");
  const [clearArmed, setClearArmed] = useState(false);

  const canWrite = !writeRequired || Boolean(token);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("token");
      if (q) {
        sessionStorage.setItem(TOKEN_KEY, q);
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState(null, "", url.pathname + url.hash);
        setToken(q);
      } else {
        setToken(sessionStorage.getItem(TOKEN_KEY));
      }
      const hash = window.location.hash.slice(1) as Tab;
      if (hash === "viewer" || hash === "mptc" || hash === "counter") setTab(hash);
    } catch {
      /* ignore */
    }
  }, []);

  const goTab = useCallback(
    (t: Tab) => {
      if (t === "counter" && !canWrite) return;
      setTab(t);
      try {
        history.replaceState(null, "", `#${t}`);
      } catch {
        /* ignore */
      }
    },
    [canWrite]
  );

  const refresh = useCallback(async () => {
    try {
      const [rRes, lRes] = await Promise.all([
        fetch("/api/results", { cache: "no-store" }),
        fetch("/api/log", { cache: "no-store" }),
      ]);
      if (!rRes.ok) throw new Error("results");
      const rJson = await rRes.json();
      setResults(rJson.results || {});
      setWriteRequired(Boolean(rJson.writeRequired));
      if (lRes.ok) {
        const lJson = await lRes.json();
        setLogs(lJson.logs || []);
      }
      setLive(true);
      setErr(null);
    } catch {
      setLive(false);
      setErr("Live updates stopped. Reload the page to reconnect.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const lastUpdate = useMemo(() => {
    const times = Object.values(results)
      .map((r) => r.updatedAt)
      .filter(Boolean) as string[];
    times.sort();
    return times.at(-1) ?? null;
  }, [results]);

  const hasSample = useMemo(
    () => Object.values(results).some((r) => r.sample),
    [results]
  );

  const D = useMemo(() => {
    const out: Record<string, DerivedResult> = {};
    for (const s of ROSTER) out[s.id] = derive(results[s.id]);
    return out;
  }, [results]);

  async function postLog(seat: string, action: string) {
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ seat, action, by: "counter" }),
      });
    } catch {
      /* ignore */
    }
  }

  function openSheet(id: string) {
    const seat = effectiveSeat(BY_ID[id], results[id]);
    const r = results[id];
    setSheetMsg(null);
    setSheet({
      id,
      base: r?.updatedAt ?? null,
      force: false,
      status: r?.status || "pending",
      ours: r?.ours != null && r.ours !== 0 ? String(r.ours) : r?.ours === 0 && r?.status !== "pending" ? "0" : "",
      nota: r?.nota == null ? "" : String(r.nota),
      note: r?.note || "",
      rivals:
        r?.rivals?.length
          ? r.rivals.map((x) => ({
              name: x.name || "",
              party: x.party || "",
              votes: x.votes === 0 || x.votes ? String(x.votes) : "",
            }))
          : [{ name: "", party: "", votes: "" }],
      cname: seat.name || "",
      cparty: seat.party || "TDP",
      sname: seat.seat,
    });
  }

  function draftFromSheet(ed: SheetState): CountingResult {
    return {
      status: ed.status,
      ours: num(ed.ours),
      nota: ed.nota === "" ? null : num(ed.nota),
      note: ed.note.trim(),
      rivals: ed.rivals
        .filter((x) => x.name.trim() || x.votes !== "")
        .map((x) => ({ name: x.name.trim(), party: x.party, votes: num(x.votes) })),
      sample: false,
      updatedAt: null,
      updatedBy: "counter",
      cand: BY_ID[ed.id]?.editable
        ? { name: ed.cname.trim(), party: ed.cparty, seat: ed.sname.trim() }
        : undefined,
    };
  }

  function bumpSheet(ed: SheetState): SheetState {
    if (
      ed.status === "pending" &&
      (num(ed.ours) > 0 || ed.rivals.some((x) => num(x.votes) > 0))
    ) {
      return { ...ed, status: "counting" };
    }
    return ed;
  }

  async function saveSheet(force = false) {
    if (!sheet || !canWrite) return;
    setSaving(true);
    setSheetMsg(null);
    const body = draftFromSheet(sheet);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          seatId: sheet.id,
          result: body,
          force: force || sheet.force,
          expectedUpdatedAt: sheet.base,
        }),
      });
      if (res.status === 409) {
        const j = await res.json();
        const when = fmtTime(j.current?.updatedAt);
        setSheetMsg(
          <div className="notice err">
            Someone saved this seat at {when || "another time"}. Saving now replaces their entry.{" "}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSheet((s) => (s ? { ...s, force: true } : s));
                void saveSheet(true);
              }}
            >
              Save anyway
            </button>{" "}
            <button
              type="button"
              className="btn"
              onClick={() => {
                void refresh().then(() => openSheet(sheet.id));
              }}
            >
              Load theirs
            </button>
          </div>
        );
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setSheetMsg(
          <div className="notice err">
            That did not save. Check the write token and connection, then try again.
          </div>
        );
        setSaving(false);
        return;
      }
      const v = derive(body);
      await postLog(
        BY_ID[sheet.id].seat,
        `saved · ${STATUS_LABEL[v.key]}${v.key === "pending" ? "" : ` · ${marginText(v)}`}`
      );
      setSheet(null);
      await refresh();
    } catch {
      setSheetMsg(<div className="notice err">That did not save. Check the connection and try again.</div>);
    } finally {
      setSaving(false);
    }
  }

  async function fillSample() {
    if (!canWrite) return;
    setToolMsg("Filling…");
    const P: [ResultStatus, number?, number?][] = [
      ["declared", 1450, 1102],
      ["counting", 612, 780],
      ["counting", 905, 744],
      ["pending"],
      ["declared", 988, 1210],
      ["counting", 410, 410],
      ["counting", 1320, 801],
    ];
    try {
      for (let i = 0; i < ROSTER.length; i++) {
        const s = ROSTER[i];
        const p =
          s.id === "zptc"
            ? (["counting", 8420, 7915] as [ResultStatus, number, number])
            : s.kind === "ZPTC"
              ? P[(i + 2) % P.length]
              : P[(i - 1 + P.length) % P.length];
        const result: CountingResult =
          p[0] === "pending"
            ? {
                status: "pending",
                ours: 0,
                rivals: [],
                nota: null,
                note: "",
                sample: true,
                updatedAt: null,
                updatedBy: "counter",
              }
            : {
                status: p[0],
                ours: (p[1] ?? 0) + i * 7,
                rivals: [
                  { name: "Sample rival A", party: "YSRCP", votes: (p[2] ?? 0) + i * 5 },
                  { name: "Sample rival B", party: "IND", votes: 120 + i * 3 },
                ],
                nota: 14 + i,
                note: "Sample",
                sample: true,
                updatedAt: null,
                updatedBy: "counter",
              };
        if (s.editable) {
          result.cand = { name: `Sample candidate ${i - 14}`, party: "TDP", seat: s.seat };
        }
        await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ seatId: s.id, result, force: true }),
        });
      }
      await postLog("", "sample results filled");
      setToolMsg("Sample results filled.");
      await refresh();
    } catch {
      setToolMsg("Sample fill failed.");
    }
  }

  async function clearSample() {
    if (!canWrite) return;
    const hit = ROSTER.filter((s) => results[s.id]?.sample);
    for (const s of hit) {
      await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ seatId: s.id, delete: true }),
      });
    }
    await postLog("", "sample results cleared");
    setToolMsg(`Cleared ${hit.length} sample results.`);
    await refresh();
  }

  async function clearAll() {
    if (!canWrite) return;
    if (!clearArmed) {
      setClearArmed(true);
      window.setTimeout(() => setClearArmed(false), 5000);
      return;
    }
    const hit = ROSTER.filter((s) => results[s.id]);
    for (const s of hit) {
      const c =
        s.editable && results[s.id]?.cand && !results[s.id]?.sample
          ? results[s.id].cand
          : null;
      if (c) {
        await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({
            seatId: s.id,
            force: true,
            result: {
              status: "pending",
              ours: 0,
              rivals: [],
              nota: null,
              note: "",
              sample: false,
              cand: c,
              updatedAt: null,
              updatedBy: "counter",
            },
          }),
        });
      } else {
        await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ seatId: s.id, delete: true }),
        });
      }
    }
    await postLog("", "all results cleared");
    setToolMsg(`Cleared ${hit.length} results.`);
    setClearArmed(false);
    await refresh();
  }

  function unlockWithToken(value: string) {
    const t = value.trim();
    if (!t) return;
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    goTab("counter");
  }

  /* ---- Viewer pieces ---- */
  function heroCard(s0: CountingSeat) {
    const s = effectiveSeat(s0, results[s0.id]);
    const d = D[s0.id];
    return (
      <article key={s0.id} className={`panel hero k-${d.key}`}>
        <Avatar seat={s} dKey={d.key} />
        <div>
          <div className="kind">{s.kind}</div>
          <h3>{s.name || s.seat}</h3>
          {s.te ? <div className="sub te">{s.te}</div> : null}
          <div className="meta">
            <PartyBadge party={s.party} />
            {s.no != null ? <span className="chip">Ballot {s.no}</span> : null}
            <Chip k={d.key} />
          </div>
        </div>
        <div className="big">
          <div className="word">
            <span aria-hidden>{STATUS_GLYPH[d.key]}</span> {STATUS_LABEL[d.key]}
          </div>
          <div className="by">{marginText(d)}</div>
          {d.key !== "pending" && d.key !== "counting" ? (
            <div className="vs">
              {fmt(d.ours)} vs {fmt(d.rv)}
              {d.top?.name ? ` · ${d.top.name}` : ""}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function mptcCard(s0: CountingSeat) {
    const s = effectiveSeat(s0, results[s0.id]);
    const d = D[s0.id];
    return (
      <li key={s0.id} className={`panel card k-${d.key}`}>
        <div className="row1">
          <Avatar seat={s} dKey={d.key} />
          <div className="who">
            <div className="seat">{s.seat}</div>
            <div className="name">{s.name || "NDA candidate TBD"}</div>
            {s.te ? <div className="tel te">{s.te}</div> : null}
            <div className="tags">
              <PartyBadge party={s.party} />
              <Chip k={d.key} />
            </div>
          </div>
        </div>
        {d.key === "pending" || d.key === "counting" ? (
          <div className="idle">{marginText(d)}</div>
        ) : (
          <>
            <div className="votes">
              <div>
                <small>NDA</small>
                <b>{fmt(d.ours)}</b>
              </div>
              <div className="lead">
                <small>{d.top?.name || "Top rival"}</small>
                <b>{fmt(d.rv)}</b>
              </div>
            </div>
            <VoteBar ours={d.ours} rival={d.rv} />
            <div className="margin">
              <span>{marginText(d)}</span>
              <span>{fmt(d.total)} total</span>
            </div>
          </>
        )}
      </li>
    );
  }

  function renderDistrictMajority() {
    const won = ZP_SEATS.filter((s) => D[s.id].key === "won").length;
    const winning = ZP_SEATS.filter((s) => D[s.id].key === "winning").length;
    const ahead = won + winning;
    const trailing = ZP_SEATS.filter((s) => D[s.id].key === "trailing").length;
    const lost = ZP_SEATS.filter((s) => D[s.id].key === "lost").length;
    const tied = ZP_SEATS.filter((s) => D[s.id].key === "tied").length;
    const key: DerivedKey =
      won >= ZP_MAJORITY_NEED
        ? "won"
        : lost > ZP_SEATS.length - ZP_MAJORITY_NEED
          ? "lost"
          : ahead >= ZP_MAJORITY_NEED
            ? "winning"
            : ahead + trailing + lost + tied > 0
              ? "trailing"
              : "pending";
    const head =
      won >= ZP_MAJORITY_NEED
        ? "NDA has won the Zilla Parishad"
        : lost > ZP_SEATS.length - ZP_MAJORITY_NEED
          ? "Majority is out of reach"
          : ahead >= ZP_MAJORITY_NEED
            ? "On course for a majority"
            : ahead + trailing + lost + tied > 0
              ? "Short of a majority so far"
              : "Counting has not started";

    return (
      <div className={`panel maj k-${key}`}>
        <div className="n">
          {ahead}
          <small> / {ZP_MAJORITY_NEED}</small>
        </div>
        <div>
          <div className="hd">{head}</div>
          <div className="sb">
            {ZP_MAJORITY_NEED} of {ZP_SEATS.length} ZPTC seats decide the Chairperson. NDA has won{" "}
            {won} and is winning in {winning}.
          </div>
        </div>
        <div className="segs" aria-hidden>
          {[...ZP_SEATS]
            .sort((a, b) => DERIVE_ORDER.indexOf(D[a.id].key) - DERIVE_ORDER.indexOf(D[b.id].key))
            .map((s) => (
              <i key={s.id} className={`k-${D[s.id].key}`} />
            ))}
        </div>
        <div className="mark">
          <span>Won or winning</span>
          <span>Needs {ZP_MAJORITY_NEED}</span>
        </div>
      </div>
    );
  }

  const kurupamMptc = KURUPAM_SEATS.filter((s) => s.kind === "MPTC");
  const groups = {
    all: kurupamMptc,
    lead: kurupamMptc.filter((s) => ["won", "winning"].includes(D[s.id].key)),
    trail: kurupamMptc.filter((s) => ["lost", "trailing"].includes(D[s.id].key)),
    wait: kurupamMptc.filter((s) =>
      ["pending", "counting", "tied"].includes(D[s.id].key)
    ),
  };

  const sheetDerived = sheet ? derive(draftFromSheet(sheet)) : null;
  const sheetSeat = sheet ? effectiveSeat(BY_ID[sheet.id], results[sheet.id]) : null;
  const sheetWarnings = sheet
    ? (() => {
        const d = draftFromSheet(sheet);
        const v = derive(d);
        const w: string[] = [];
        if (d.status !== "pending" && v.ours === 0 && v.rv === 0) w.push("No votes entered yet.");
        if (d.status === "declared" && v.rv === 0 && v.ours > 0)
          w.push("Declared with no rival votes. Add the rival and their count.");
        if (d.status === "declared" && v.lead === 0 && v.ours > 0)
          w.push("Votes are level. Check the counts before declaring.");
        if (d.rivals.some((x) => x.votes > 0 && !x.name))
          w.push("A rival has votes but no name.");
        const nm = d.rivals.map((x) => x.name.toLowerCase()).filter(Boolean);
        if (new Set(nm).size < nm.length) w.push("Two rivals have the same name.");
        return w;
      })()
    : [];

  return (
    <div className="counting-day" data-theme="light">
      <header className="top">
        <div className="wrap">
          <div>
            <div className="eyebrow">
              Parvathipuram Manyam · ZPTC and MPTC · Counting 7 Nov 2026
            </div>
            <h1>Counting Day</h1>
          </div>
          <div className={`live${live ? " on" : ""}`} id="live">
            <i />
            <span id="liveTxt">
              {live
                ? `Live${lastUpdate ? ` · last update ${fmtTime(lastUpdate)} IST` : " · waiting for first result"}`
                : "Offline"}
            </span>
          </div>
          <nav className="tabs" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "viewer"}
              onClick={() => goTab("viewer")}
            >
              PPM Zilla Parishad
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "mptc"}
              onClick={() => goTab("mptc")}
            >
              MPTC
            </button>
            {canWrite ? (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "counter"}
                onClick={() => goTab("counter")}
              >
                Counter
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ paddingBlock: "18px 40px" }}>
        <div id="msg">
          {err ? <div className="notice err">{err}</div> : null}
          {hasSample ? (
            <div className="notice">Sample / rehearsal results are showing. Clear them before counting day.</div>
          ) : null}
          {!canWrite && writeRequired ? (
            <div className="notice">
              Viewer is public. To enter results, open this page with{" "}
              <code>?token=…</code> once (stored for this browser session), or paste the write
              token below.
              <form
                className="btns"
                style={{ marginTop: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  unlockWithToken(String(fd.get("token") || ""));
                }}
              >
                <input
                  className="inp"
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder="COUNTING_WRITE_TOKEN"
                  style={{ maxWidth: 280 }}
                />
                <button type="submit" className="btn primary">
                  Unlock Counter
                </button>
              </form>
            </div>
          ) : null}
        </div>

        {tab === "viewer" ? (
          <section aria-label="Viewer">
            {renderDistrictMajority()}
            <h2>Kurupam ZPTC</h2>
            {heroCard(BY_ID.zptc)}
            <h2 className="cons">Other mandals · ZPTC</h2>
            <ul className="grid">
              {ZP_SEATS.filter((s) => s.id !== "zptc").map((s) => mptcCard(s))}
            </ul>
            <h2 className="cons">
              Kurupam MPTCs · {kurupamMptc.length} NDA candidates
            </h2>
            <div className="tally">
              {(
                [
                  ["won", "Won"],
                  ["winning", "Winning"],
                  ["trailing", "Trailing"],
                  ["lost", "Lost"],
                  ["pending", "Pending"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className={`tile k-${k}`}>
                  <b>{kurupamMptc.filter((s) => D[s.id].key === k).length}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="segs" aria-hidden>
              {[...kurupamMptc]
                .sort(
                  (a, b) =>
                    DERIVE_ORDER.indexOf(D[a.id].key) - DERIVE_ORDER.indexOf(D[b.id].key)
                )
                .map((s) => (
                  <i key={s.id} className={`k-${D[s.id].key}`} />
                ))}
            </div>
            <div className="filters">
              {(
                [
                  ["all", "All"],
                  ["lead", "Leading"],
                  ["trail", "Trailing"],
                  ["wait", "Waiting"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={viewerFilter === k}
                  onClick={() => setViewerFilter(k)}
                >
                  {label}
                  <small>{groups[k].length}</small>
                </button>
              ))}
            </div>
            {groups[viewerFilter].length === 0 ? (
              <div className="panel empty">No seats in this filter.</div>
            ) : (
              <ul className="grid">{groups[viewerFilter].map(mptcCard)}</ul>
            )}
          </section>
        ) : null}

        {tab === "mptc" ? (
          <section aria-label="MPTC">
            {!mptcMandal ? (
              <>
                <h2>
                  MPTC seats · {ALL_MPTC.length} across {MN.length} mandals
                </h2>
                {SHOW.map((cons) => (
                  <div key={cons}>
                    <h2 className="cons">{cons}</h2>
                    <ul className="grid">
                      {MN.filter(([, , ci]) => CONS[ci] === cons).map(([m, n]) => {
                        const list = ALL_MPTC.filter((s) => s.mandal === m);
                        const won = list.filter((s) =>
                          ["won", "winning"].includes(D[s.id].key)
                        ).length;
                        const lost = list.filter((s) =>
                          ["lost", "trailing"].includes(D[s.id].key)
                        ).length;
                        return (
                          <li key={m}>
                            <button
                              type="button"
                              className="mcard"
                              onClick={() => setMptcMandal(m)}
                            >
                              <div className="mtop">
                                <b>{m}</b>
                                <small>{n} seats</small>
                              </div>
                              <div className="segs" aria-hidden>
                                {list.map((s) => (
                                  <i key={s.id} className={`k-${D[s.id].key}`} />
                                ))}
                              </div>
                              <div className="cnt">
                                <span className="k-won">{won} ahead</span>
                                <span className="k-lost">{lost} behind</span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              <>
                <button type="button" className="btn back" onClick={() => setMptcMandal(null)}>
                  ← All mandals
                </button>
                <h2>
                  {mptcMandal} mandal ·{" "}
                  {ALL_MPTC.filter((s) => s.mandal === mptcMandal).length} MPTC seats
                </h2>
                <ul className="grid">
                  {ALL_MPTC.filter((s) => s.mandal === mptcMandal).map(mptcCard)}
                </ul>
              </>
            )}
          </section>
        ) : null}

        {tab === "counter" && canWrite ? (
          <section aria-label="Counter">
            <p className="hint" style={{ color: "var(--muted)" }}>
              Tap a seat to enter the running totals for each round. The Viewer tab updates for
              everyone as soon as you save.
            </p>
            <h2>Kurupam · ZPTC and 14 MPTC</h2>
            <ul className="list">
              {KURUPAM_SEATS.map((s0) => {
                const s = effectiveSeat(s0, results[s0.id]);
                const d = D[s0.id];
                return (
                  <li key={s0.id}>
                    <button
                      type="button"
                      className={`rowbtn k-${d.key}`}
                      onClick={() => openSheet(s0.id)}
                    >
                      <Avatar seat={s} dKey={d.key} />
                      <div className="mid">
                        <div className="t1">
                          {s.kind} · {s.seat}
                          {results[s0.id]?.sample ? <span className="tag">sample</span> : null}
                        </div>
                        <div className="t2">
                          {s.name || "Name TBD"} · {STATUS_LABEL[d.key]}
                          {d.key !== "pending" && d.key !== "counting"
                            ? ` · ${fmt(d.ours)}–${fmt(d.rv)}`
                            : ""}
                        </div>
                      </div>
                      <Chip k={d.key} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <h2 className="cons">Other mandals · ZPTC</h2>
            <ul className="list">
              {ROSTER.filter((s) => s.editable && s.kind === "ZPTC").map((s0) => {
                const s = effectiveSeat(s0, results[s0.id]);
                const d = D[s0.id];
                return (
                  <li key={s0.id}>
                    <button
                      type="button"
                      className={`rowbtn k-${d.key}`}
                      onClick={() => openSheet(s0.id)}
                    >
                      <Avatar seat={s} dKey={d.key} />
                      <div className="mid">
                        <div className="t1">
                          {s.seat}
                          {results[s0.id]?.sample ? <span className="tag">sample</span> : null}
                        </div>
                        <div className="t2">
                          {s.name || "NDA candidate TBD"} · {STATUS_LABEL[d.key]}
                        </div>
                      </div>
                      <Chip k={d.key} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <h2 className="cons">
              Other mandals · MPTC (placeholder seat names, rename in each seat)
            </h2>
            {MN.filter(([m]) => m !== "Kurupam").map(([m]) => {
              const rows = ROSTER.filter((s) => s.kind === "MPTC" && s.mandal === m);
              const started = rows.filter(
                (s) => results[s.id] && results[s.id].status !== "pending"
              ).length;
              return (
                <details key={m} className="mdet">
                  <summary>
                    {m} · {started}/{rows.length} started
                  </summary>
                  <ul className="list">
                    {rows.map((s0) => {
                      const s = effectiveSeat(s0, results[s0.id]);
                      const d = D[s0.id];
                      return (
                        <li key={s0.id}>
                          <button
                            type="button"
                            className={`rowbtn k-${d.key}`}
                            onClick={() => openSheet(s0.id)}
                          >
                            <Avatar seat={s} dKey={d.key} />
                            <div className="mid">
                              <div className="t1">{s.seat}</div>
                              <div className="t2">
                                {s.name || "NDA candidate TBD"} · {STATUS_LABEL[d.key]}
                              </div>
                            </div>
                            <Chip k={d.key} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}

            <div className="two">
              <div className="panel box">
                <h2>Rehearsal tools</h2>
                <p className="hint" style={{ color: "var(--muted)" }}>
                  For rehearsing today. Sample results are flagged so the Viewer shows a test
                  banner. Clear them before counting day.
                </p>
                <div className="btns">
                  <button type="button" className="btn" onClick={() => void fillSample()}>
                    Fill sample results
                  </button>
                  <button type="button" className="btn" onClick={() => void clearSample()}>
                    Clear sample
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => void clearAll()}
                  >
                    {clearArmed
                      ? "Tap again to clear every result (candidate names stay)"
                      : "Clear all results"}
                  </button>
                </div>
                {toolMsg ? <p style={{ marginTop: 10 }}>{toolMsg}</p> : null}
              </div>
              <div className="panel box">
                <h2>Recent saves</h2>
                <ul className="log">
                  {logs.length === 0 ? (
                    <li>Nothing saved yet.</li>
                  ) : (
                    logs.slice(0, 12).map((l, i) => (
                      <li key={`${l.at}-${i}`}>
                        <span>
                          {l.seat ? `${l.seat}: ` : ""}
                          {l.action}
                          {l.by ? ` · ${l.by}` : ""}
                        </span>
                        <time>{fmtTime(l.at)}</time>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {sheet && sheetSeat && sheetDerived ? (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSheet(null);
          }}
        >
          <form
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Enter result for ${sheetSeat.seat}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (canWrite) void saveSheet();
            }}
          >
            <div className="sh-head">
              <Avatar seat={sheetSeat} dKey={sheetDerived.key} />
              <div>
                <b>
                  {sheetSeat.kind} · {sheetSeat.seat}
                </b>
                <span>
                  {BY_ID[sheet.id].editable
                    ? `NDA candidate for ${sheetSeat.mandal}`
                    : `${sheetSeat.name} · ${sheetSeat.party} · Ballot no. ${sheetSeat.no}`}
                </span>
              </div>
            </div>

            {!canWrite ? (
              <div className="notice">View only. Unlock Counter with the write token to enter results.</div>
            ) : null}

            <div className="seg" role="radiogroup" aria-label="Counting status">
              {(
                [
                  ["pending", "Yet to count"],
                  ["counting", "Counting"],
                  ["declared", "Declared"],
                ] as const
              ).map(([v, label]) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="st"
                    value={v}
                    checked={sheet.status === v}
                    disabled={!canWrite}
                    onChange={() => setSheet({ ...sheet, status: v })}
                  />
                  {label}
                </label>
              ))}
            </div>

            {BY_ID[sheet.id].editable && BY_ID[sheet.id].kind === "MPTC" ? (
              <div className="field">
                <label htmlFor="f-sname">Seat name (use the official name once known)</label>
                <input
                  className="inp"
                  id="f-sname"
                  value={sheet.sname}
                  disabled={!canWrite}
                  onChange={(e) => setSheet({ ...sheet, sname: e.target.value })}
                />
              </div>
            ) : null}

            {BY_ID[sheet.id].editable ? (
              <div className="field">
                <label htmlFor="f-cname">NDA candidate</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 6 }}>
                  <input
                    className="inp"
                    id="f-cname"
                    placeholder="NDA candidate name"
                    value={sheet.cname}
                    disabled={!canWrite}
                    onChange={(e) => setSheet({ ...sheet, cname: e.target.value })}
                  />
                  <select
                    className="inp"
                    id="f-cparty"
                    aria-label="NDA candidate party"
                    value={sheet.cparty}
                    disabled={!canWrite}
                    onChange={(e) => setSheet({ ...sheet, cparty: e.target.value })}
                  >
                    {["TDP", "JSP", "BJP"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="f-ours">
                {BY_ID[sheet.id].editable
                  ? "NDA votes"
                  : `Our votes · ${sheetSeat.name} (${sheetSeat.party})`}
              </label>
              <input
                className="inp num"
                id="f-ours"
                inputMode="numeric"
                autoComplete="off"
                value={sheet.ours}
                disabled={!canWrite}
                onChange={(e) =>
                  setSheet(bumpSheet({ ...sheet, ours: e.target.value }))
                }
              />
            </div>

            <div className="field">
              <span className="lbl">Rivals</span>
              <div id="rivals">
                {sheet.rivals.map((x, i) => (
                  <div className="rival" key={i}>
                    <input
                      className="inp nm"
                      placeholder="Rival name"
                      aria-label={`Rival ${i + 1} name`}
                      value={x.name}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const rivals = sheet.rivals.slice();
                        rivals[i] = { ...rivals[i], name: e.target.value };
                        setSheet({ ...sheet, rivals });
                      }}
                    />
                    <select
                      className="inp pt"
                      aria-label={`Rival ${i + 1} party`}
                      value={x.party}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const rivals = sheet.rivals.slice();
                        rivals[i] = { ...rivals[i], party: e.target.value };
                        setSheet({ ...sheet, rivals });
                      }}
                    >
                      <option value="">Party</option>
                      {PARTIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      className="inp vt"
                      inputMode="numeric"
                      placeholder="Votes"
                      aria-label={`Rival ${i + 1} votes`}
                      value={x.votes}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const rivals = sheet.rivals.slice();
                        rivals[i] = { ...rivals[i], votes: e.target.value };
                        setSheet(bumpSheet({ ...sheet, rivals }));
                      }}
                    />
                    <button
                      type="button"
                      className="x"
                      aria-label={`Remove rival ${i + 1}`}
                      disabled={!canWrite || sheet.rivals.length === 1}
                      onClick={() => {
                        const rivals = sheet.rivals.filter((_, j) => j !== i);
                        setSheet({ ...sheet, rivals });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  className="btn"
                  disabled={!canWrite}
                  onClick={() =>
                    setSheet({
                      ...sheet,
                      rivals: [...sheet.rivals, { name: "", party: "", votes: "" }],
                    })
                  }
                >
                  + Add rival
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-nota">NOTA (optional)</label>
              <input
                className="inp"
                id="f-nota"
                inputMode="numeric"
                value={sheet.nota}
                disabled={!canWrite}
                onChange={(e) => setSheet({ ...sheet, nota: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-note">Round or source note (optional)</label>
              <input
                className="inp"
                id="f-note"
                placeholder="e.g. Round 3, Table 2"
                value={sheet.note}
                disabled={!canWrite}
                onChange={(e) => setSheet({ ...sheet, note: e.target.value })}
              />
            </div>

            <div className={`preview k-${sheetDerived.key}`}>
              <span>
                {STATUS_GLYPH[sheetDerived.key]} {STATUS_LABEL[sheetDerived.key]}
              </span>
              <span>{sheetDerived.key === "pending" ? "" : marginText(sheetDerived)}</span>
            </div>
            {sheetWarnings.length ? (
              <ul className="checks">
                {sheetWarnings.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {sheetMsg}

            <div className="btns" style={{ marginTop: 0 }}>
              <button type="submit" className="btn primary" disabled={!canWrite || saving}>
                Save result
              </button>
              <button type="button" className="btn" onClick={() => setSheet(null)}>
                {canWrite ? "Cancel" : "Close"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
