"use client";

import {
  ALL_MPTC,
  BY_ID,
  CONS,
  DERIVE_ORDER,
  KURUPAM_SEATS,
  MN,
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
  type CountingResult,
  type CountingSeat,
  type DerivedKey,
  type DerivedResult,
} from "@/lib/roster";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Chip,
  POLL_MS,
  PartyBadge,
  VoteBar,
  fmtTime,
  lastResultUpdate,
} from "./counting/shared";

type Tab = "viewer" | "mptc";

export function CountingDayApp() {
  const [tab, setTab] = useState<Tab>("viewer");
  const [results, setResults] = useState<Record<string, CountingResult>>({});
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mptcMandal, setMptcMandal] = useState<string | null>(null);
  const [viewerFilter, setViewerFilter] = useState<"all" | "lead" | "trail" | "wait">("all");

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1) as Tab;
      if (hash === "viewer" || hash === "mptc") setTab(hash);
    } catch {
      /* ignore */
    }
  }, []);

  const goTab = useCallback((t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const rRes = await fetch("/api/results", { cache: "no-store" });
      if (!rRes.ok) throw new Error("results");
      const rJson = await rRes.json();
      setResults(rJson.results || {});
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

  const hasSample = useMemo(
    () => Object.values(results).some((r) => r.sample),
    [results]
  );

  const D = useMemo(() => {
    const out: Record<string, DerivedResult> = {};
    for (const s of ROSTER) out[s.id] = derive(results[s.id]);
    return out;
  }, [results]);

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
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ paddingBlock: "18px 40px" }}>
        <div id="msg">
          {err ? <div className="notice err">{err}</div> : null}
          {hasSample ? (
            <div className="notice">
              Sample / rehearsal results are showing. Clear them before counting day.
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
      </main>
    </div>
  );
}
