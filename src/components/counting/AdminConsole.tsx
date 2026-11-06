"use client";

import {
  BY_ID,
  CONS,
  KURUPAM_SEATS,
  MN,
  ROSTER,
  STATUS_LABEL,
  SHOW,
  ZP_MAJORITY_NEED,
  ZP_SEATS,
  derive,
  effectiveSeat,
  fmt,
  marginText,
  type CountingResult,
  type CountingSeat,
  type DerivedResult,
  type ResultStatus,
} from "@/lib/roster";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ConflictNotice,
  ResultSheet,
  draftFromSheet,
  sheetFromResult,
  type SheetState,
} from "./ResultSheet";
import {
  Avatar,
  Chip,
  OPERATOR_KEY,
  POLL_MS,
  TOKEN_KEY,
  authHeaders,
  fmtTime,
  lastResultUpdate,
  type LogEntry,
} from "./shared";

type SeatFilter =
  | "all"
  | "pending"
  | "counting"
  | "declared"
  | "lead"
  | "trail";

function matchesFilter(
  seat: CountingSeat,
  filter: SeatFilter,
  results: Record<string, CountingResult>,
  D: Record<string, DerivedResult>
): boolean {
  const r = results[seat.id];
  const key = D[seat.id].key;
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return !r || r.status === "pending";
    case "counting":
      return r?.status === "counting";
    case "declared":
      return r?.status === "declared";
    case "lead":
      return key === "won" || key === "winning";
    case "trail":
      return key === "lost" || key === "trailing";
    default:
      return true;
  }
}

function matchesSearch(seat: CountingSeat, q: string, results: Record<string, CountingResult>): boolean {
  if (!q) return true;
  const eff = effectiveSeat(seat, results[seat.id]);
  const hay = `${eff.seat} ${eff.name} ${eff.mandal} ${eff.cons} ${eff.kind}`.toLowerCase();
  return hay.includes(q);
}

export function AdminConsole({ authenticated = false }: { authenticated?: boolean }) {
  const [results, setResults] = useState<Record<string, CountingResult>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [writeRequired, setWriteRequired] = useState(authenticated);
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState("admin");
  const [filter, setFilter] = useState<SeatFilter>("all");
  const [consScope, setConsScope] = useState<string>("all");
  const [mandalScope, setMandalScope] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetMsg, setSheetMsg] = useState<ReactNode>(null);
  const [saving, setSaving] = useState(false);
  const [toolMsg, setToolMsg] = useState("");
  const [clearArmed, setClearArmed] = useState(false);

  const canWrite = authenticated || !writeRequired || Boolean(token);

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
      setOperator(sessionStorage.getItem(OPERATOR_KEY) || "admin");
    } catch {
      /* ignore */
    }
  }, []);

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

  const lastUpdate = useMemo(() => lastResultUpdate(results), [results]);

  const D = useMemo(() => {
    const out: Record<string, DerivedResult> = {};
    for (const s of ROSTER) out[s.id] = derive(results[s.id]);
    return out;
  }, [results]);

  const stats = useMemo(() => {
    const started = ROSTER.filter(
      (s) => results[s.id] && results[s.id].status !== "pending"
    ).length;
    const pending = ROSTER.length - started;
    const kurupam = KURUPAM_SEATS;
    const ahead = kurupam.filter((s) =>
      ["won", "winning"].includes(D[s.id].key)
    ).length;
    const behind = kurupam.filter((s) =>
      ["lost", "trailing"].includes(D[s.id].key)
    ).length;
    const zpWon = ZP_SEATS.filter((s) => D[s.id].key === "won").length;
    const zpWinning = ZP_SEATS.filter((s) => D[s.id].key === "winning").length;
    const zpAhead = zpWon + zpWinning;
    return { started, pending, ahead, behind, zpAhead };
  }, [results, D]);

  const nextPending = useMemo(
    () => ROSTER.find((s) => !results[s.id] || results[s.id].status === "pending") ?? null,
    [results]
  );

  const mandalOptions = useMemo(() => {
    if (consScope === "all") return MN.map(([m]) => m);
    return MN.filter(([, , ci]) => CONS[ci] === consScope).map(([m]) => m);
  }, [consScope]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ROSTER.filter((s) => {
      if (consScope !== "all" && s.cons !== consScope) return false;
      if (mandalScope !== "all" && s.mandal !== mandalScope) return false;
      return matchesFilter(s, filter, results, D) && matchesSearch(s, q, results);
    });
  }, [filter, search, results, D, consScope, mandalScope]);

  async function postLog(seat: string, action: string) {
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ seat, action, by: operator || "admin" }),
      });
    } catch {
      /* ignore */
    }
  }

  function openSheet(id: string) {
    setSheetMsg(null);
    setSheet(sheetFromResult(id, results));
  }

  async function saveSheet(force = false) {
    if (!sheet || !canWrite) return;
    setSaving(true);
    setSheetMsg(null);
    const body = draftFromSheet(sheet, operator || "admin");
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
          <ConflictNotice
            when={when}
            onForce={() => {
              setSheet((s) => (s ? { ...s, force: true } : s));
              void saveSheet(true);
            }}
            onLoad={() => {
              void refresh().then(() => openSheet(sheet.id));
            }}
          />
        );
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setSheetMsg(
          <div className="notice err">
            That did not save. Check the admin password and connection, then try again.
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
      setSheetMsg(
        <div className="notice err">That did not save. Check the connection and try again.</div>
      );
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
                updatedBy: operator || "admin",
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
                updatedBy: operator || "admin",
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
              updatedBy: operator || "admin",
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
  }

  function persistOperator(value: string) {
    const v = value.trim() || "admin";
    setOperator(v);
    try {
      sessionStorage.setItem(OPERATOR_KEY, v);
    } catch {
      /* ignore */
    }
  }

  function renderSeatRow(s0: CountingSeat) {
    const s = effectiveSeat(s0, results[s0.id]);
    const d = D[s0.id];
    const score =
      d.key !== "pending" && d.key !== "counting" ? `${fmt(d.ours)}–${fmt(d.rv)}` : null;
    return (
      <li key={s0.id}>
        <button type="button" className={`rowbtn k-${d.key}`} onClick={() => openSheet(s0.id)}>
          <Avatar seat={s} dKey={d.key} />
          <div className="mid">
            <div className="t1">
              <span className="kind-tag">{s.kind}</span>
              {s.seat}
              {results[s0.id]?.sample ? <span className="tag">sample</span> : null}
            </div>
            <div className="t2">
              <span className="cand-name">{s.name || "NDA candidate TBD"}</span>
              {score ? <span className="score">{score}</span> : null}
            </div>
          </div>
          <Chip k={d.key} />
        </button>
      </li>
    );
  }

  const grouped = useMemo(() => {
    const byCons: Record<string, CountingSeat[]> = {};
    for (const cons of SHOW) byCons[cons] = [];
    for (const s of filtered) {
      const c = s.cons in byCons ? s.cons : SHOW[0];
      byCons[c].push(s);
    }
    return byCons;
  }, [filtered]);

  const openCons = consScope !== "all" ? consScope : SHOW.find((c) => (grouped[c] || []).length) || "";
  const openMandal =
    mandalScope !== "all"
      ? mandalScope
      : nextPending?.mandal || "";

  return (
    <div className="counting-day counting-admin" data-theme="light">
      <div className="admin-frame">
        <header className="admin-top">
          <div className="admin-brand">
            <span className="admin-mark" aria-hidden>
              CD
            </span>
            <div>
              <div className="eyebrow">Parvathipuram Manyam · 7 Nov 2026</div>
              <h1>Counting Day · Admin</h1>
            </div>
          </div>
          <div className="admin-top-meta">
            <div className={`live${live ? " on" : ""}`}>
              <i />
              <span>
                {live
                  ? `Live${lastUpdate ? ` · ${fmtTime(lastUpdate)} IST` : ""}`
                  : "Offline"}
              </span>
            </div>
            <span
              className={`admin-auth${canWrite ? " on" : ""}`}
              title={
                writeRequired
                  ? canWrite
                    ? "Admin unlocked for this browser"
                    : "Admin password required"
                  : "No password configured (open writes)"
              }
            >
              {canWrite ? (writeRequired ? "Unlocked" : "Open writes") : "Locked"}
            </span>
            {canWrite ? (
              <label className="admin-op">
                <span>Operator</span>
                <input
                  className="inp"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  onBlur={(e) => persistOperator(e.target.value)}
                  aria-label="Operator name"
                />
              </label>
            ) : null}
            <a className="btn admin-link" href="/" target="_blank" rel="noreferrer">
              Public board
            </a>
            {canWrite && writeRequired ? (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  if (authenticated) {
                    try {
                      const res = await fetch("/api/auth", { method: "DELETE" });
                      if (!res.ok) throw new Error("logout");
                      window.location.replace("/admin");
                    } catch {
                      setErr("Unable to lock admin. Check your connection and try again.");
                    }
                    return;
                  }
                  try {
                    sessionStorage.removeItem(TOKEN_KEY);
                  } catch {
                    /* ignore */
                  }
                  setToken(null);
                  setSheet(null);
                }}
              >
                Lock
              </button>
            ) : null}
          </div>
        </header>

        <div className="admin-sheet">
          {err ? <div className="notice err">{err}</div> : null}

          {!canWrite ? (
            <section className="admin-gate" aria-label="Unlock admin">
              <h2>Unlock admin</h2>
              <p className="hint">
                Enter the admin password to manage counting. The public board at <code>/</code> has
                no counter — viewers only see live results.
              </p>
              <form
                className="admin-gate-form"
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
                  autoComplete="current-password"
                  placeholder="Admin password"
                  aria-label="Admin password"
                />
                <button type="submit" className="btn primary">
                  Unlock
                </button>
              </form>
            </section>
          ) : (
            <>
              <div className="admin-title-row">
                <div>
                  <h2 className="admin-title">Seat control</h2>
                  <p className="hint">
                    {stats.pending === 0
                      ? "Every seat has a result. Open any row to correct counts."
                      : `${stats.pending} seats still waiting — open the next one and save.`}
                  </p>
                </div>
                {nextPending ? (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => openSheet(nextPending.id)}
                  >
                    Open next pending
                  </button>
                ) : null}
              </div>

              <div className="admin-kpis" role="group" aria-label="Counting overview">
                <div>
                  <span>Started</span>
                  <b>
                    {stats.started}
                    <small> / {ROSTER.length}</small>
                  </b>
                </div>
                <div>
                  <span>Pending</span>
                  <b className="k-pending">{stats.pending}</b>
                </div>
                <div>
                  <span>Kurupam ahead</span>
                  <b className="k-won">{stats.ahead}</b>
                </div>
                <div>
                  <span>Kurupam behind</span>
                  <b className="k-lost">{stats.behind}</b>
                </div>
                <div>
                  <span>ZP majority</span>
                  <b className={stats.zpAhead >= ZP_MAJORITY_NEED ? "k-won" : "k-pending"}>
                    {stats.zpAhead}
                    <small> / {ZP_MAJORITY_NEED}</small>
                  </b>
                </div>
              </div>

              <div className="admin-layout">
                <div className="admin-main">
                  <div className="admin-toolbar">
                    <input
                      className="inp admin-search"
                      type="search"
                      placeholder="Search seat, candidate, mandal…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search seats"
                    />
                    <label className="admin-select-wrap">
                      <span className="sr-only">Constituency</span>
                      <select
                        className="inp select"
                        value={consScope}
                        aria-label="Constituency"
                        onChange={(e) => {
                          setConsScope(e.target.value);
                          setMandalScope("all");
                        }}
                      >
                        <option value="all">All constituencies</option>
                        {SHOW.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-select-wrap">
                      <span className="sr-only">Mandal</span>
                      <select
                        className="inp select"
                        value={mandalScope}
                        aria-label="Mandal"
                        onChange={(e) => setMandalScope(e.target.value)}
                      >
                        <option value="all">All mandals</option>
                        {mandalOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-select-wrap">
                      <span className="sr-only">Status</span>
                      <select
                        className="inp select"
                        value={filter}
                        aria-label="Status filter"
                        onChange={(e) => setFilter(e.target.value as SeatFilter)}
                      >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="counting">Counting</option>
                        <option value="declared">Declared</option>
                        <option value="lead">Leading</option>
                        <option value="trail">Trailing</option>
                      </select>
                    </label>
                    <span className="admin-count">{filtered.length} seats</span>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="panel empty">No seats match this filter.</div>
                  ) : (
                    <div className="admin-accords">
                      {SHOW.map((cons) => {
                        const seats = grouped[cons] || [];
                        if (!seats.length) return null;
                        const byMandal = MN.filter(([, , ci]) => CONS[ci] === cons).map(([m]) => m);
                        const mandals =
                          byMandal.length > 0
                            ? byMandal
                            : [...new Set(seats.map((s) => s.mandal))];
                        const consStarted = seats.filter(
                          (s) => results[s.id] && results[s.id].status !== "pending"
                        ).length;
                        return (
                          <details
                            key={`cons-${cons}-${consScope}-${filter}-${search}-${cons === openCons || consScope === cons ? "open" : "shut"}`}
                            className="admin-cons-drop"
                            open={cons === openCons || consScope === cons || undefined}
                          >
                            <summary>
                              <span className="drop-title">{cons}</span>
                              <span className="drop-meta">
                                {consStarted}/{seats.length} started
                              </span>
                            </summary>
                            <div className="admin-cons-body">
                              {mandals.map((m) => {
                                const rows = seats.filter((s) => s.mandal === m);
                                if (!rows.length) return null;
                                const started = rows.filter(
                                  (s) => results[s.id] && results[s.id].status !== "pending"
                                ).length;
                                const pending = rows.length - started;
                                return (
                                  <details
                                    key={`m-${cons}-${m}-${consScope}-${mandalScope}-${filter}-${m === openMandal || mandalScope === m ? "open" : "shut"}`}
                                    className="admin-mandal-drop"
                                    open={m === openMandal || mandalScope === m || undefined}
                                  >
                                    <summary>
                                      <span className="drop-title">{m}</span>
                                      <span className="drop-meta">
                                        <span className="drop-pending">{pending} waiting</span>
                                        <span>
                                          {started}/{rows.length}
                                        </span>
                                      </span>
                                    </summary>
                                    <ul className="list seat-list">{rows.map(renderSeatRow)}</ul>
                                  </details>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>

                <aside className="admin-rail">
                  <div className="panel box">
                    <h2>Recent saves</h2>
                    <ul className="log">
                      {logs.length === 0 ? (
                        <li>Nothing saved yet.</li>
                      ) : (
                        logs.slice(0, 14).map((l, i) => (
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
                  <div className="panel box">
                    <h2>Rehearsal tools</h2>
                    <p className="hint">
                      Sample results are flagged on the public board. Clear them before counting
                      day.
                    </p>
                    <div className="btns">
                      <button type="button" className="btn" onClick={() => void fillSample()}>
                        Fill sample
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
                          ? "Tap again to clear every result"
                          : "Clear all results"}
                      </button>
                    </div>
                    {toolMsg ? <p className="hint" style={{ marginTop: 10 }}>{toolMsg}</p> : null}
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {sheet ? (
        <ResultSheet
          sheet={sheet}
          setSheet={setSheet}
          results={results}
          operator={operator || "admin"}
          sheetMsg={sheetMsg}
          saving={saving}
          onSave={(force) => void saveSheet(force)}
        />
      ) : null}
    </div>
  );
}
