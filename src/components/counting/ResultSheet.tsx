"use client";

import {
  BY_ID,
  PARTIES,
  STATUS_GLYPH,
  STATUS_LABEL,
  derive,
  effectiveSeat,
  marginText,
  num,
  type CountingResult,
  type ResultStatus,
} from "@/lib/roster";
import {
  useEffect,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Avatar } from "./shared";

export type SheetState = {
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

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function partyClass(party: string): string {
  if (!party) return "";
  const safe = party.replace(/[^A-Za-z0-9]+/g, "");
  return ` party-select p-${safe}`;
}

export function sheetFromResult(
  id: string,
  results: Record<string, CountingResult>
): SheetState {
  const seat = effectiveSeat(BY_ID[id], results[id]);
  const r = results[id];
  return {
    id,
    base: r?.updatedAt ?? null,
    force: false,
    status: r?.status || "pending",
    ours:
      r?.ours != null && r.ours !== 0
        ? String(r.ours)
        : r?.ours === 0 && r?.status !== "pending"
          ? "0"
          : "",
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
  };
}

export function draftFromSheet(ed: SheetState, operator: string): CountingResult {
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
    updatedBy: operator || "admin",
    cand: BY_ID[ed.id]?.editable
      ? { name: ed.cname.trim(), party: ed.cparty, seat: ed.sname.trim() }
      : undefined,
  };
}

export function bumpSheet(ed: SheetState): SheetState {
  if (
    ed.status === "pending" &&
    (num(ed.ours) > 0 || ed.rivals.some((x) => num(x.votes) > 0))
  ) {
    return { ...ed, status: "counting" };
  }
  return ed;
}

type Props = {
  sheet: SheetState;
  setSheet: Dispatch<SetStateAction<SheetState | null>>;
  results: Record<string, CountingResult>;
  operator: string;
  sheetMsg: ReactNode;
  saving: boolean;
  onSave: (force?: boolean) => void;
};

export function ResultSheet({
  sheet,
  setSheet,
  results,
  operator,
  sheetMsg,
  saving,
  onSave,
}: Props) {
  const draft = useMemo(() => draftFromSheet(sheet, operator), [sheet, operator]);
  const derived = derive(draft);
  const seat = effectiveSeat(BY_ID[sheet.id], results[sheet.id]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    html.classList.add("sheet-open");
    body.classList.add("sheet-open");
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.paddingRight = prevPad;
      html.classList.remove("sheet-open");
      body.classList.remove("sheet-open");
    };
  }, []);

  const warnings = useMemo(() => {
    const v = derive(draft);
    const w: string[] = [];
    if (draft.status !== "pending" && v.ours === 0 && v.rv === 0) w.push("No votes entered yet.");
    if (draft.status === "declared" && v.rv === 0 && v.ours > 0)
      w.push("Declared with no rival votes. Add the rival and their count.");
    if (draft.status === "declared" && v.lead === 0 && v.ours > 0)
      w.push("Votes are level. Check the counts before declaring.");
    if (draft.rivals.some((x) => x.votes > 0 && !x.name))
      w.push("A rival has votes but no name.");
    const nm = draft.rivals.map((x) => x.name.toLowerCase()).filter(Boolean);
    if (new Set(nm).size < nm.length) w.push("Two rivals have the same name.");
    return w;
  }, [draft]);

  return (
    <div
      className="scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSheet(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setSheet(null);
      }}
      onWheel={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <form
        className="sheet sheet-admin"
        role="dialog"
        aria-modal="true"
        aria-label={`Enter result for ${seat.seat}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <div className="sheet-scroll">
          <div className="sh-head">
            <Avatar seat={seat} dKey={derived.key} />
            <div>
              <b>
                {seat.kind} · {seat.seat}
              </b>
              <span>
                {BY_ID[sheet.id].editable
                  ? `NDA candidate for ${seat.mandal}`
                  : `${seat.name} · ${seat.party} · Ballot no. ${seat.no}`}
              </span>
            </div>
          </div>

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
                  onChange={() => setSheet({ ...sheet, status: v })}
                />
                {label}
              </label>
            ))}
          </div>

          {BY_ID[sheet.id].editable && BY_ID[sheet.id].kind === "MPTC" ? (
            <div className="field">
              <label htmlFor="f-sname">Seat name</label>
              <input
                className="inp"
                id="f-sname"
                value={sheet.sname}
                onChange={(e) => setSheet({ ...sheet, sname: e.target.value })}
              />
            </div>
          ) : null}

          {BY_ID[sheet.id].editable ? (
            <div className="field">
              <label htmlFor="f-cname">NDA candidate</label>
              <div className="cand-row">
                <input
                  className="inp"
                  id="f-cname"
                  placeholder="Candidate name"
                  value={sheet.cname}
                  onChange={(e) => setSheet({ ...sheet, cname: e.target.value })}
                />
                <select
                  className={`inp select${partyClass(sheet.cparty || "TDP")}`}
                  id="f-cparty"
                  aria-label="NDA candidate party"
                  value={sheet.cparty}
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

          <div className="vote-grid">
            <div className="field">
              <label htmlFor="f-ours">
                {BY_ID[sheet.id].editable
                  ? "NDA votes"
                  : `Our votes · ${seat.party}`}
              </label>
              <input
                className="inp num"
                id="f-ours"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={sheet.ours}
                onChange={(e) =>
                  setSheet(bumpSheet({ ...sheet, ours: digitsOnly(e.target.value) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="f-nota">NOTA</label>
              <input
                className="inp num"
                id="f-nota"
                inputMode="numeric"
                placeholder="—"
                value={sheet.nota}
                onChange={(e) => setSheet({ ...sheet, nota: digitsOnly(e.target.value) })}
              />
            </div>
          </div>

          <div className="field">
            <div className="lbl-row">
              <span className="lbl">Rivals</span>
              <button
                type="button"
                className="btn btn-quiet"
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
            <div className="rival-head" aria-hidden>
              <span>Name</span>
              <span>Party</span>
              <span>Votes</span>
              <span />
            </div>
            <div id="rivals">
              {sheet.rivals.map((x, i) => (
                <div className="rival" key={i}>
                  <input
                    className="inp nm"
                    placeholder="Rival name"
                    aria-label={`Rival ${i + 1} name`}
                    value={x.name}
                    onChange={(e) => {
                      const rivals = sheet.rivals.slice();
                      rivals[i] = { ...rivals[i], name: e.target.value };
                      setSheet({ ...sheet, rivals });
                    }}
                  />
                  <select
                    className={`inp select pt${partyClass(x.party)}`}
                    aria-label={`Rival ${i + 1} party`}
                    value={x.party}
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
                    className="inp vt num"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Rival ${i + 1} votes`}
                    value={x.votes}
                    onChange={(e) => {
                      const rivals = sheet.rivals.slice();
                      rivals[i] = { ...rivals[i], votes: digitsOnly(e.target.value) };
                      setSheet(bumpSheet({ ...sheet, rivals }));
                    }}
                  />
                  <button
                    type="button"
                    className="x"
                    aria-label={`Remove rival ${i + 1}`}
                    disabled={sheet.rivals.length === 1}
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
          </div>

          <div className="field">
            <label htmlFor="f-note">Round or source note</label>
            <input
              className="inp"
              id="f-note"
              placeholder="e.g. Round 3, Table 2"
              value={sheet.note}
              onChange={(e) => setSheet({ ...sheet, note: e.target.value })}
            />
          </div>

          <div className={`preview k-${derived.key}`}>
            <span>
              {STATUS_GLYPH[derived.key]} {STATUS_LABEL[derived.key]}
            </span>
            <span>{derived.key === "pending" ? "" : marginText(derived)}</span>
          </div>
          {warnings.length ? (
            <ul className="checks">
              {warnings.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
          {sheetMsg}
        </div>

        <div className="sheet-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : "Save result"}
          </button>
          <button type="button" className="btn" onClick={() => setSheet(null)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function ConflictNotice({
  when,
  onForce,
  onLoad,
}: {
  when: string;
  onForce: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="notice err">
      Someone saved this seat at {when || "another time"}. Saving now replaces their entry.{" "}
      <button type="button" className="btn" onClick={onForce}>
        Save anyway
      </button>{" "}
      <button type="button" className="btn" onClick={onLoad}>
        Load theirs
      </button>
    </div>
  );
}
