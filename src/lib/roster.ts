export type SeatKind = "ZPTC" | "MPTC";

export type CountingSeat = {
  id: string;
  kind: SeatKind;
  seat: string;
  seatTe?: string;
  name: string;
  te?: string;
  party: string;
  no: number | null;
  mandal: string;
  cons: string;
  /** Placeholder seats: name/seat editable from Counter. */
  editable?: boolean;
};

/** Mandal name, MPTC seat count, constituency index into CONS. */
export type MandalSpec = [mandal: string, mptcCount: number, consIndex: number];

export const CONS = ["Palakonda", "Kurupam", "Parvathipuram", "Salur"] as const;
export const SHOW = ["Kurupam", "Palakonda", "Parvathipuram", "Salur"] as const;

export const MN: MandalSpec[] = [
  ["Palakonda", 12, 0],
  ["Seethampeta", 16, 0],
  ["Veeraghattam", 19, 0],
  ["Bhamini", 13, 0],
  ["Kurupam", 14, 1],
  ["Komarada", 15, 1],
  ["Gummalakshmipuram", 14, 1],
  ["Jiyyammavalasa", 15, 1],
  ["Garugubilli", 13, 1],
  ["Parvathipuram", 17, 2],
  ["Seethanagaram", 17, 2],
  ["Balijipeta", 17, 2],
  ["Salur", 16, 3],
  ["Pachipenta", 14, 3],
  ["Makkuva", 14, 3],
];

/** Named Kurupam NDA roster (ZPTC + 14 MPTC). */
const KURUPAM_NAMED: CountingSeat[] = [
  {
    id: "zptc",
    kind: "ZPTC",
    seat: "Kurupam ZPTC",
    seatTe: "కురుపాం ZPTC",
    name: "Vyricherla Viresh Chandra Dev",
    te: "వైరిచర్ల వీరేష్ చంద్రదేవ్",
    party: "TDP",
    no: 5,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "kurupam-1",
    kind: "MPTC",
    seat: "Kurupam-1",
    seatTe: "కురుపాం–1",
    name: "Gembali Nithya",
    te: "గెంబలి నిత్య",
    party: "BJP",
    no: 1,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "kurupam-2",
    kind: "MPTC",
    seat: "Kurupam-2",
    seatTe: "కురుపాం–2",
    name: "Tekkali Durgarao",
    te: "టెక్కలి దుర్గారావు",
    party: "TDP",
    no: 1,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "kurupam-3",
    kind: "MPTC",
    seat: "Kurupam-3",
    seatTe: "కురుపాం–3",
    name: "Dugga Simhachalamma",
    te: "దుగ్గ సింహాచలమ్మ",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "neelakantapuram-1",
    kind: "MPTC",
    seat: "Neelakantapuram-1",
    seatTe: "నీలకంఠాపురం–1",
    name: "Biddika Venkatalakshmi",
    te: "బిడ్డిక వెంకటలక్ష్మి",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "neelakantapuram-2",
    kind: "MPTC",
    seat: "Neelakantapuram-2",
    seatTe: "నీలకంఠాపురం–2",
    name: "Vooyaka Masi",
    te: "శ్రీమతి వూయక మాసి",
    party: "TDP",
    no: 1,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "kichhada",
    kind: "MPTC",
    seat: "Kichhada",
    seatTe: "కిచ్చాడ",
    name: "Maseda Sanyasi Rao",
    te: "మసేడ సన్యాసి రావు",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "mondenkhallu",
    kind: "MPTC",
    seat: "Mondenkhallu",
    seatTe: "మొండెంఖల్లు",
    name: "Gudari Lakshmi",
    te: "గుడారి లక్ష్మి",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "valasaballeru",
    kind: "MPTC",
    seat: "Valasaballeru",
    seatTe: "వలసబల్లేరు",
    name: "Nimmala Pooja",
    te: "నిమ్మల పూజ",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "vobhangi",
    kind: "MPTC",
    seat: "Vobhangi",
    seatTe: "వోభంగి",
    name: "Kondagorri Annaji Rao",
    te: "కొండగొర్రి అన్నాజీ రావు",
    party: "JSP",
    no: 1,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "podi",
    kind: "MPTC",
    seat: "Podi",
    seatTe: "పోడి",
    name: "Pattika Satyam",
    te: "పత్తిక సత్యం",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "uridi",
    kind: "MPTC",
    seat: "Uridi",
    seatTe: "ఉరిడి",
    name: "Biddika Manjuvani",
    te: "బిడ్డిక మంజువాణి",
    party: "TDP",
    no: 3,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "yegulavada",
    kind: "MPTC",
    seat: "Yegulavada",
    seatTe: "యేగులవాడ",
    name: "Pattika Manjulavani",
    te: "పత్తిక మంజులవాణి",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "tittiri",
    kind: "MPTC",
    seat: "Tittiri",
    seatTe: "తిత్తిరి",
    name: "Biddika Addayi",
    te: "బిడ్డిక అడ్డాయి",
    party: "JSP",
    no: 1,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
  {
    id: "sivada",
    kind: "MPTC",
    seat: "G. Sivada",
    seatTe: "జి. శివాడ",
    name: "Himarika Subbalakshmi",
    te: "హిమారిక సుబ్బలక్ష్మి",
    party: "TDP",
    no: 2,
    mandal: "Kurupam",
    cons: "Kurupam",
  },
];

const OTHER_ZPTC_SPECS: [slug: string, mandal: string, consIndex: number][] = [
  ["palakonda", "Palakonda", 0],
  ["seethampeta", "Seethampeta", 0],
  ["veeraghattam", "Veeraghattam", 0],
  ["bhamini", "Bhamini", 0],
  ["komarada", "Komarada", 1],
  ["gummalakshmipuram", "Gummalakshmipuram", 1],
  ["jiyyammavalasa", "Jiyyammavalasa", 1],
  ["garugubilli", "Garugubilli", 1],
  ["parvathipuram", "Parvathipuram", 2],
  ["seethanagaram", "Seethanagaram", 2],
  ["balijipeta", "Balijipeta", 2],
  ["salur", "Salur", 3],
  ["pachipenta", "Pachipenta", 3],
  ["makkuva", "Makkuva", 3],
];

function buildRoster(): CountingSeat[] {
  const roster: CountingSeat[] = KURUPAM_NAMED.map((s) => ({ ...s }));

  for (const [slug, mandal, c] of OTHER_ZPTC_SPECS) {
    roster.push({
      id: `zptc-${slug}`,
      kind: "ZPTC",
      seat: `${mandal} ZPTC`,
      name: "",
      te: "",
      party: "TDP",
      no: null,
      mandal,
      cons: CONS[c],
      editable: true,
    });
  }

  for (const [mandal, n, c] of MN) {
    if (mandal === "Kurupam") continue;
    for (let i = 1; i <= n; i++) {
      roster.push({
        id: `mptc-${mandal.toLowerCase()}-${String(i).padStart(2, "0")}`,
        kind: "MPTC",
        seat: `${mandal} ${i}`,
        name: "",
        te: "",
        party: "TDP",
        no: null,
        mandal,
        cons: CONS[c],
        editable: true,
      });
    }
  }

  return roster;
}

export const ROSTER: CountingSeat[] = buildRoster();
export const BY_ID: Record<string, CountingSeat> = Object.fromEntries(
  ROSTER.map((s) => [s.id, s])
);

/** Kurupam named seats (ZPTC + MPTCs) — Counter “Kurupam” block / Viewer hero list. */
export const KURUPAM_SEATS = ROSTER.filter(
  (s) => s.mandal === "Kurupam" && !s.editable
);

export const ZP_SEATS = ROSTER.filter((s) => s.kind === "ZPTC");
export const MPTC_NAMED = ROSTER.filter((s) => s.kind === "MPTC" && !s.editable);
export const ALL_MPTC = ROSTER.filter((s) => s.kind === "MPTC");

/** Seats needed for ZP Chairperson majority. */
export const ZP_MAJORITY_NEED = 8;

export const PARTIES = [
  "TDP",
  "JSP",
  "BJP",
  "YSRCP",
  "INC",
  "CPI(M)",
  "CPI",
  "IND",
  "Other",
] as const;

export const STATUS_LABEL = {
  pending: "Yet to count",
  counting: "Counting",
  winning: "Winning",
  trailing: "Trailing",
  tied: "Tied",
  won: "Won",
  lost: "Lost",
} as const;

export const STATUS_GLYPH = {
  pending: "○",
  counting: "◔",
  winning: "▲",
  trailing: "▼",
  tied: "＝",
  won: "✓",
  lost: "✕",
} as const;

export type ResultStatus = "pending" | "counting" | "declared";

export type RivalVotes = { name: string; party: string; votes: number };

export type CountingResult = {
  status: ResultStatus;
  ours: number;
  rivals: RivalVotes[];
  nota: number | null;
  note: string;
  sample?: boolean;
  cand?: { name: string; party: string; seat: string };
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DerivedKey =
  | "pending"
  | "counting"
  | "winning"
  | "trailing"
  | "tied"
  | "won"
  | "lost";

export type DerivedResult = {
  status: ResultStatus;
  key: DerivedKey;
  ours: number;
  top: RivalVotes | null;
  rv: number;
  lead: number;
  others: number;
  total: number;
  rivals: RivalVotes[];
  sample: boolean;
};

export function num(v: unknown): number {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

export function derive(r: Partial<CountingResult> | null | undefined): DerivedResult {
  const status: ResultStatus = r?.status ?? "pending";
  const ours = num(r?.ours);
  const rivals = (r?.rivals ?? []).map((x) => ({
    name: x.name || "",
    party: x.party || "",
    votes: num(x.votes),
  }));
  const top = rivals.reduce<RivalVotes | null>(
    (a, b) => (!a || b.votes > a.votes ? b : a),
    null
  );
  const rv = top ? top.votes : 0;
  const lead = ours - rv;
  const others = rivals.reduce((a, b) => a + b.votes, 0);
  let key: DerivedKey;
  if (status === "pending") key = "pending";
  else if (status === "declared") key = lead > 0 ? "won" : lead < 0 ? "lost" : "tied";
  else key = lead > 0 ? "winning" : lead < 0 ? "trailing" : ours > 0 ? "tied" : "counting";

  return {
    status,
    key,
    ours,
    top,
    rv,
    lead,
    others,
    total: ours + others + num(r?.nota),
    rivals,
    sample: Boolean(r?.sample),
  };
}

export function marginText(d: DerivedResult): string {
  if (d.key === "pending") return "Counting not started";
  if (d.key === "counting") return "No votes entered yet";
  if (d.lead === 0) return `Level on ${fmt(d.ours)}`;
  return `${d.lead > 0 ? "Ahead by" : "Behind by"} ${fmt(Math.abs(d.lead))}`;
}

export function effectiveSeat(
  seat: CountingSeat,
  result?: Partial<CountingResult> | null
): CountingSeat {
  if (!seat.editable || !result?.cand) return seat;
  return {
    ...seat,
    name: result.cand.name || seat.name,
    party: result.cand.party || seat.party,
    seat: result.cand.seat || seat.seat,
  };
}

export const DERIVE_ORDER: DerivedKey[] = [
  "won",
  "winning",
  "tied",
  "counting",
  "pending",
  "trailing",
  "lost",
];
