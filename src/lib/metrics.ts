export const PERIODS = [
  { id: "7", label: "7 d", long: "7 dagen", days: 7, parts: 7 },
  { id: "30", label: "30 d", long: "30 dagen", days: 30, parts: 30 },
  { id: "90", label: "90 d", long: "90 dagen", days: 90, parts: 13 },
  { id: "365", label: "Jaar", long: "365 dagen", days: 365, parts: 12 },
] as const;

export const LENSES = [
  { id: "alles", label: "Alles", ticket: 36, share: 1 },
  { id: "rit", label: "Rit", ticket: 18.4, share: 0.46 },
  { id: "vracht", label: "Vracht", ticket: 71, share: 0.38 },
  { id: "plek", label: "Plek", ticket: 240, share: 0.16 },
] as const;

export const CITIES = [
  { id: "rotterdam", name: "Rotterdam", weight: 0.34, trend: 0.04, util: 0.15 },
  { id: "amsterdam", name: "Amsterdam", weight: 0.27, trend: 0.09, util: 0.02 },
  { id: "utrecht", name: "Utrecht", weight: 0.14, trend: 0.01, util: 0 },
  { id: "den-haag", name: "Den Haag", weight: 0.12, trend: 0.16, util: 0.03 },
  { id: "eindhoven", name: "Eindhoven", weight: 0.08, trend: -0.14, util: -0.12 },
  { id: "groningen", name: "Groningen", weight: 0.05, trend: 0.22, util: -0.04 },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];
export type LensId = (typeof LENSES)[number]["id"];
export type CityId = (typeof CITIES)[number]["id"];
export type InsightKind = "kans" | "risico" | "signaal";

export type Point = {
  label: string;
  omzet: number;
  volume: number;
  vorig: number;
  vorigVolume: number;
};

export type Kpi = {
  key: "omzet" | "volume" | "util" | "repeat";
  label: string;
  value: number;
  delta: number;
  deltaMode: "rel" | "pt";
  spark: number[];
};

export type Slice = {
  id: string;
  name: string;
  hint: string;
  value: number;
  share: number;
  delta: number;
};

export type CityRow = {
  id: CityId;
  name: string;
  omzet: number;
  delta: number;
  share: number;
  util: number;
};

export type Insight = {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  chip: string;
};

export type Goal = {
  id: string;
  name: string;
  detail: string;
  current: number;
  target: number;
  format: "eur" | "pct" | "count";
};

export type Snapshot = {
  period: PeriodId;
  lens: LensId;
  city: CityId | null;
  kpis: Kpi[];
  series: Point[];
  mix: Slice[];
  cities: CityRow[];
  hours: { hour: string; drukte: number }[];
  insights: Insight[];
  goals: Goal[];
  lede: string;
  rotterdam: { omzet: number; util: number };
  weekendLift: number;
};

const ANCHOR = Date.UTC(2026, 9, 17);
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS_LONG = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];
const WEEKDAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

const BASE_DAILY = 42800;

export function periodById(id: PeriodId) {
  return PERIODS.find((p) => p.id === id) ?? PERIODS[1];
}

export function lensById(id: LensId) {
  return LENSES.find((l) => l.id === id) ?? LENSES[0];
}

export function cityById(id: CityId) {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

export function formatEur(n: number): string {
  const sign = n < 0 ? "−" : "";
  const v = Math.round(Math.abs(n));
  return `${sign}€\u00a0${group(v)}`;
}

export function formatEurCompact(n: number): string {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(n);
  if (v >= 1_000_000) {
    const mln = v / 1_000_000;
    return `${sign}€\u00a0${mln.toFixed(2).replace(".", ",")} mln`;
  }
  return formatEur(n);
}

export function formatInt(n: number): string {
  return group(Math.round(Math.abs(n)));
}

export function formatPct(ratio: number, digits = 1): string {
  const sign = ratio > 0.0005 ? "+" : ratio < -0.0005 ? "−" : "";
  return `${sign}${absPct(Math.abs(ratio), digits)}`;
}

export function formatPctAbs(ratio: number, digits = 1): string {
  return absPct(Math.abs(ratio), digits);
}

export function formatPt(delta: number): string {
  const sign = delta > 0.00005 ? "+" : delta < -0.00005 ? "−" : "";
  const pts = Math.abs(delta * 100);
  return `${sign}${pts.toFixed(1).replace(".", ",")} pt`;
}

export function todayLabel(): string {
  const d = new Date(ANCHOR);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function buildSnapshot(period: PeriodId, lens: LensId, city: CityId | null): Snapshot {
  const spec = periodById(period);
  const current = dailyWindow(spec.days, 0, lens, city);
  const previous = dailyWindow(spec.days, spec.days, lens, city);
  const series = zipSeries(current, previous, spec.parts);
  const kpis = buildKpis(lens, current, previous, series);
  const mix = buildMix(spec.days, lens, city);
  const cities = buildCities(spec.days, lens);
  const hours = buildHours(lens);
  const weekendLift =
    lens === "rit" || lens === "alles"
      ? weekendLiftOf(lens === "rit" ? current : dailyWindow(spec.days, 0, "rit", city))
      : weekendLiftOf(current);
  const util = avg(current.map((d) => d.util));
  const repeat = avg(current.map((d) => d.repeat));
  const repeatPrev = avg(previous.map((d) => d.repeat));
  const rotterdam = cities.find((c) => c.id === "rotterdam") ?? cities[0];
  const insights = buildInsights({
    lens,
    city,
    mix,
    cities,
    util,
    repeat,
    repeatDelta: repeat - repeatPrev,
    weekendLift,
  });
  const goals = buildGoals(kpis, cities, lens, city, spec.days);
  const lede = insights[0]?.body ?? "Geen uitschieter in deze selectie.";

  return {
    period,
    lens,
    city,
    kpis,
    series,
    mix,
    cities,
    hours,
    insights,
    goals,
    lede,
    rotterdam: { omzet: rotterdam.omzet, util: rotterdam.util },
    weekendLift,
  };
}

export function shiftLift(omzet: number, util: number, extra: number): { euro: number; capture: number } {
  const capture = util >= 0.84 ? 0.62 : util >= 0.75 ? 0.38 : 0.14;
  return { euro: omzet * extra * capture, capture };
}

export const LOGBOOK = [
  {
    date: "17 okt",
    title: "Hub Feijenoord, eerste week",
    body: "1.840 zendingen. Donderdag liep de kade vol, vrijdag niet.",
  },
  {
    date: "16 okt",
    title: "Coolblue verlengt vracht",
    body: "Achttien maanden, zelfde vensters. Den Haag pakt een deel van Rotterdam over.",
  },
  {
    date: "15 okt",
    title: "Nachtrit Amsterdam",
    body: "Pilot na 23:00 doet +11% ritten, zonder daling van de ritprijs.",
  },
  {
    date: "14 okt",
    title: "Eindhoven, kraan 2",
    body: "Veertien late docks. De daling in de stad begon hier, niet bij de vraag.",
  },
  {
    date: "12 okt",
    title: "Wachtlijst Plek, Den Haag",
    body: "Binckhorst staat open. Geen extra vloot nodig om dit te innen.",
  },
  {
    date: "9 okt",
    title: "Avondprijs Rit",
    body: "Nieuwe prijs na 22:00. Volume bleef liggen, marge niet.",
  },
] as const;

type Daily = { offset: number; omzet: number; volume: number; util: number; repeat: number };

function dailyWindow(days: number, shift: number, lens: LensId, city: CityId | null): Daily[] {
  const out: Daily[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const offset = -(i + shift);
    const omzet = dailyOmzet(offset, lens, city);
    const ticket = lensById(lens).ticket;
    out.push({
      offset,
      omzet,
      volume: omzet / ticket,
      util: dailyUtil(offset, lens, city),
      repeat: dailyRepeat(offset, lens, city),
    });
  }
  return out;
}

function dailyOmzet(offset: number, lens: LensId, city: CityId | null): number {
  const date = new Date(ANCHOR + offset * 86_400_000);
  const dow = date.getUTCDay();
  const lensShare = lensById(lens).share;
  const cityMeta = city ? cityById(city) : null;
  const cityShare = cityMeta ? cityMeta.weight : 1;
  const bend = cityMeta ? cityMeta.trend : 0.06;
  const trend = trendFactor(offset, bend);
  let season = 1;
  if (lens === "rit" || lens === "alles") {
    const w = lens === "rit" ? 1 : 0.46;
    if (dow === 5 || dow === 6) season += 0.28 * w;
    if (dow === 0) season -= 0.06 * w;
  }
  if (lens === "vracht" || lens === "alles") {
    const w = lens === "vracht" ? 1 : 0.38;
    if (dow >= 2 && dow <= 4) season += 0.16 * w;
    if (dow === 0 || dow === 6) season -= 0.22 * w;
  }
  if (lens === "plek") {
    season = dow === 1 ? 1.12 : 0.98;
  }
  const noise = 0.94 + rand(hash(`omzet:${lens}:${city ?? "all"}:${offset}`)) * 0.12;
  return Math.max(0, BASE_DAILY * lensShare * cityShare * trend * season * noise);
}

function trendFactor(offset: number, bend: number): number {
  const annual = 1 + 0.035 * Math.sin(((offset + 10) / 365) * Math.PI * 2);
  const window = 140;
  const recent = offset < -window ? 0 : ((offset + window) / window) * bend;
  return Math.max(0.45, annual + recent);
}

function dailyUtil(offset: number, lens: LensId, city: CityId | null): number {
  const date = new Date(ANCHOR + offset * 86_400_000);
  const dow = date.getUTCDay();
  let u = lens === "plek" ? 0.77 : lens === "vracht" ? 0.73 : 0.7;
  if (lens === "rit" && (dow === 5 || dow === 6)) u += 0.11;
  if (lens === "vracht" && (dow === 0 || dow === 6)) u -= 0.1;
  if (lens === "alles" && dow === 4) u += 0.04;
  if (city) u += cityById(city).util;
  if (city === "rotterdam" && dow === 4) u += 0.05;
  u += (rand(hash(`util:${lens}:${city ?? "all"}:${offset}`)) - 0.5) * 0.04;
  return clamp(u, 0.4, 0.97);
}

function dailyRepeat(offset: number, lens: LensId, city: CityId | null): number {
  let r = lens === "plek" ? 0.82 : lens === "vracht" ? 0.66 : lens === "rit" ? 0.47 : 0.57;
  if (city === "eindhoven") r -= 0.05;
  if (city === "den-haag") r += 0.035;
  if (city === "groningen") r += 0.02;
  r += offset * 0.00012;
  r += (rand(hash(`rep:${lens}:${city ?? "all"}:${offset}`)) - 0.5) * 0.02;
  return clamp(r, 0.28, 0.94);
}

function zipSeries(current: Daily[], previous: Daily[], parts: number): Point[] {
  const size = current.length / parts;
  const points: Point[] = [];
  for (let i = 0; i < parts; i++) {
    const a = Math.round(i * size);
    const b = Math.round((i + 1) * size);
    const c = current.slice(a, b);
    const p = previous.slice(a, b);
    const last = c[c.length - 1] ?? current[current.length - 1];
    points.push({
      label: pointLabel(last.offset, parts, current.length),
      omzet: sum(c.map((d) => d.omzet)),
      volume: sum(c.map((d) => d.volume)),
      vorig: sum(p.map((d) => d.omzet)),
      vorigVolume: sum(p.map((d) => d.volume)),
    });
  }
  return points;
}

function pointLabel(offset: number, parts: number, days: number): string {
  const d = new Date(ANCHOR + offset * 86_400_000);
  if (days > 120 || parts <= 12) {
    return `${MONTHS[d.getUTCMonth()]}`;
  }
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function buildKpis(lens: LensId, current: Daily[], previous: Daily[], series: Point[]): Kpi[] {
  const labels = kpiLabels(lens);
  const omzet = sum(current.map((d) => d.omzet));
  const omzetPrev = sum(previous.map((d) => d.omzet));
  const volume = sum(current.map((d) => d.volume));
  const volumePrev = sum(previous.map((d) => d.volume));
  const util = avg(current.map((d) => d.util));
  const utilPrev = avg(previous.map((d) => d.util));
  const repeat = avg(current.map((d) => d.repeat));
  const repeatPrev = avg(previous.map((d) => d.repeat));
  return [
    {
      key: "omzet",
      label: labels.omzet,
      value: omzet,
      delta: rel(omzet, omzetPrev),
      deltaMode: "rel",
      spark: series.map((p) => p.omzet),
    },
    {
      key: "volume",
      label: labels.volume,
      value: volume,
      delta: rel(volume, volumePrev),
      deltaMode: "rel",
      spark: series.map((p) => p.volume),
    },
    {
      key: "util",
      label: labels.util,
      value: util,
      delta: util - utilPrev,
      deltaMode: "pt",
      spark: current.map((d) => d.util),
    },
    {
      key: "repeat",
      label: labels.repeat,
      value: repeat,
      delta: repeat - repeatPrev,
      deltaMode: "pt",
      spark: current.map((d) => d.repeat),
    },
  ];
}

function kpiLabels(lens: LensId) {
  if (lens === "rit") {
    return { omzet: "Omzet", volume: "Ritten", util: "Vlootbezetting", repeat: "Herhaalrijders" };
  }
  if (lens === "vracht") {
    return { omzet: "Omzet", volume: "Zendingen", util: "Dockbezetting", repeat: "Op tijd" };
  }
  if (lens === "plek") {
    return { omzet: "Omzet", volume: "Abonnementen", util: "Vakbezetting", repeat: "Verlenging" };
  }
  return { omzet: "Omzet", volume: "Bewegingen", util: "Bezetting", repeat: "Herhaal" };
}

function buildMix(days: number, lens: LensId, city: CityId | null): Slice[] {
  if (lens === "alles") {
    const parts: LensId[] = ["rit", "vracht", "plek"];
    const rows = parts.map((id) => {
      const now = sum(dailyWindow(days, 0, id, city).map((d) => d.omzet));
      const prev = sum(dailyWindow(days, days, id, city).map((d) => d.omzet));
      return { id, now, prev };
    });
    const total = sum(rows.map((r) => r.now)) || 1;
    return rows.map((r) => ({
      id: r.id,
      name: lensById(r.id as LensId).label,
      hint: r.id === "rit" ? "Personen" : r.id === "vracht" ? "Stadslogistiek" : "Hubs",
      value: r.now,
      share: r.now / total,
      delta: rel(r.now, r.prev),
    }));
  }
  const weights = daypartWeights(lens);
  const now = sum(dailyWindow(days, 0, lens, city).map((d) => d.omzet));
  const prev = sum(dailyWindow(days, days, lens, city).map((d) => d.omzet));
  return weights.map((w) => ({
    id: w.id,
    name: w.name,
    hint: w.hint,
    value: now * w.share,
    share: w.share,
    delta: rel(now * w.share, prev * w.share),
  }));
}

function daypartWeights(lens: LensId) {
  if (lens === "vracht") {
    return [
      { id: "ochtend", name: "Ochtend", hint: "06–11", share: 0.34 },
      { id: "middag", name: "Middag", hint: "11–17", share: 0.42 },
      { id: "avond", name: "Avond", hint: "17–23", share: 0.19 },
      { id: "nacht", name: "Nacht", hint: "23–06", share: 0.05 },
    ];
  }
  if (lens === "plek") {
    return [
      { id: "ochtend", name: "Ochtend", hint: "06–11", share: 0.28 },
      { id: "middag", name: "Middag", hint: "11–17", share: 0.4 },
      { id: "avond", name: "Avond", hint: "17–23", share: 0.26 },
      { id: "nacht", name: "Nacht", hint: "23–06", share: 0.06 },
    ];
  }
  return [
    { id: "ochtend", name: "Ochtend", hint: "06–11", share: 0.2 },
    { id: "middag", name: "Middag", hint: "11–17", share: 0.23 },
    { id: "avond", name: "Avond", hint: "17–23", share: 0.4 },
    { id: "nacht", name: "Nacht", hint: "23–06", share: 0.17 },
  ];
}

function buildCities(days: number, lens: LensId): CityRow[] {
  const rows = CITIES.map((c) => {
    const nowD = dailyWindow(days, 0, lens, c.id);
    const prevD = dailyWindow(days, days, lens, c.id);
    const omzet = sum(nowD.map((d) => d.omzet));
    const prev = sum(prevD.map((d) => d.omzet));
    return {
      id: c.id,
      name: c.name,
      omzet,
      delta: rel(omzet, prev),
      share: 0,
      util: avg(nowD.map((d) => d.util)),
    };
  });
  const total = sum(rows.map((r) => r.omzet)) || 1;
  return rows
    .map((r) => ({ ...r, share: r.omzet / total }))
    .sort((a, b) => b.omzet - a.omzet);
}

function buildHours(lens: LensId): { hour: string; drukte: number }[] {
  const peaks =
    lens === "vracht"
      ? [
          [8, 1.3],
          [14, 1],
        ]
      : lens === "plek"
        ? [
            [9, 1],
            [13, 0.8],
            [17, 0.9],
          ]
        : lens === "rit"
          ? [
              [8, 1.1],
              [18, 1.45],
              [22, 0.7],
            ]
          : [
              [8, 1.15],
              [13, 0.7],
              [18, 1.25],
            ];
  const raw = Array.from({ length: 24 }, (_, h) => {
    let v = 0.12;
    for (const [mu, amp] of peaks) v += amp * Math.exp(-((h - mu) ** 2) / 8);
    if (lens !== "vracht" && h >= 1 && h <= 5) v *= 0.45;
    return v;
  });
  const max = Math.max(...raw);
  return raw.map((v, h) => ({
    hour: h.toString().padStart(2, "0"),
    drukte: Math.round((v / max) * 100),
  }));
}

function weekendLiftOf(days: Daily[]): number {
  const weekend: number[] = [];
  const week: number[] = [];
  for (const d of days) {
    const dow = new Date(ANCHOR + d.offset * 86_400_000).getUTCDay();
    if (dow === 5 || dow === 6) weekend.push(d.omzet);
    else if (dow >= 1 && dow <= 4) week.push(d.omzet);
  }
  const w = avg(weekend);
  const d = avg(week);
  return d === 0 ? 0 : (w - d) / d;
}

function buildInsights(ctx: {
  lens: LensId;
  city: CityId | null;
  mix: Slice[];
  cities: CityRow[];
  util: number;
  repeat: number;
  repeatDelta: number;
  weekendLift: number;
}): Insight[] {
  const list: Insight[] = [];
  const byDelta = [...ctx.cities].sort((a, b) => b.delta - a.delta);
  const fastest = byDelta[0];
  const slowest = byDelta[byDelta.length - 1];
  const focus = ctx.city ? ctx.cities.find((c) => c.id === ctx.city) : null;

  if (focus) {
    list.push({
      id: `focus-${focus.id}`,
      kind: "signaal",
      title: `Alleen ${focus.name}`,
      body: `${focus.name} is ${formatPctAbs(focus.share)} van deze stroom en staat ${formatPct(focus.delta)} tegen de vorige periode. Bezetting ${formatPctAbs(focus.util)}. De rest van het netwerk telt hier niet mee.`,
      chip: formatPctAbs(focus.share),
    });
  }

  if (fastest && fastest.delta > 0.04) {
    const small = fastest.share < 0.08;
    list.push({
      id: `groei-${fastest.id}`,
      kind: "kans",
      title: small ? `${fastest.name} groeit vanaf een smalle basis` : `${fastest.name} trekt het hardst`,
      body: small
        ? `${fastest.name} ligt ${formatPct(fastest.delta)} boven de vorige periode, maar het aandeel is ${formatPctAbs(fastest.share)}. Een mooi tempo, geen reden om de vloot te verhuizen.`
        : `${fastest.name} ligt ${formatPct(fastest.delta)} boven de vorige periode en draagt ${formatPctAbs(fastest.share)} van de omzet. Het tempo zit in volume, niet in een hogere prijs.`,
      chip: formatPct(fastest.delta),
    });
  }

  if (slowest && slowest.delta < -0.04) {
    list.push({
      id: `daling-${slowest.id}`,
      kind: "risico",
      title: `${slowest.name} levert in`,
      body: `${slowest.name} zakt ${formatPct(Math.abs(slowest.delta))} terug. Bezetting daar is ${formatPctAbs(slowest.util)}. Eerst de lege uren vullen. Een campagne erbovenop vergroot alleen de stilte.`,
      chip: formatPct(slowest.delta),
    });
  }

  const rdam = ctx.cities.find((c) => c.id === "rotterdam");
  if (rdam && rdam.util >= 0.84 && ctx.city !== "eindhoven") {
    list.push({
      id: "capaciteit-rotterdam",
      kind: "risico",
      title: "Rotterdam zit tegen de rand",
      body: `Bezetting in Rotterdam is ${formatPctAbs(rdam.util)}. Donderdag laat is de hub op de Maas het krapst. Een extra shift vangt vraag die nu wordt geweigerd. De schuif onder de steden rekent het voor.`,
      chip: formatPctAbs(rdam.util),
    });
  }

  if (ctx.weekendLift > 0.08 && (ctx.lens === "rit" || ctx.lens === "alles")) {
    list.push({
      id: "weekend",
      kind: "signaal",
      title: "Het weekend draagt de ritten",
      body: `Rit doet op vrijdag en zaterdag ${formatPct(ctx.weekendLift)} meer omzet per dag dan van maandag tot en met donderdag. De vloot is dan het volst. Doordeweeks ligt er ruimte die vracht wel pakt en rit laat liggen.`,
      chip: formatPct(ctx.weekendLift),
    });
  }

  if (ctx.lens === "alles") {
    const growing = [...ctx.mix].sort((a, b) => b.delta - a.delta)[0];
    if (growing) {
      list.push({
        id: `mix-${growing.id}`,
        kind: "signaal",
        title: `${growing.name} verschuift de mix`,
        body: `${growing.name} is ${formatPctAbs(growing.share)} van de omzet, ${formatPct(growing.delta)} tegen de vorige periode. ${mixNote(growing.id)}`,
        chip: formatPctAbs(growing.share),
      });
    }
  } else {
    const peak = [...ctx.mix].sort((a, b) => b.share - a.share)[0];
    if (peak) {
      list.push({
        id: `dagdeel-${peak.id}`,
        kind: "signaal",
        title: `${peak.name} is het zwaartepunt`,
        body: `${peak.name} (${peak.hint}) draagt ${formatPctAbs(peak.share)} van ${lensById(ctx.lens).label}. Plan onderhoud buiten dit blok, anders raak je de omzet precies waar ze valt.`,
        chip: formatPctAbs(peak.share),
      });
    }
  }

  if (ctx.repeatDelta >= 0.004) {
    list.push({
      id: "herhaal-op",
      kind: "kans",
      title: "Mensen komen terug",
      body: `Herhaal staat op ${formatPctAbs(ctx.repeat)}, ${formatPt(ctx.repeatDelta)} ten opzichte van de vorige periode. Vaste ophaalplekken en verlengde abonnementen verklaren het grootste deel.`,
      chip: formatPctAbs(ctx.repeat),
    });
  } else if (ctx.repeatDelta <= -0.004) {
    list.push({
      id: "herhaal-neer",
      kind: "risico",
      title: "Herhaal koelt af",
      body: `Herhaal zakt naar ${formatPctAbs(ctx.repeat)} (${formatPt(ctx.repeatDelta)}). Nieuwe vraag dekt de omzet nog, maar de basis wordt dunner. Eerst de tweede rit, niet de eerste.`,
      chip: formatPt(ctx.repeatDelta),
    });
  }

  if (ctx.util < 0.68) {
    list.push({
      id: "ruimte",
      kind: "kans",
      title: "Er is vloer over",
      body: `Gemiddelde bezetting is ${formatPctAbs(ctx.util)}. Dat is ruimte, geen succes. Korting op de daluren kost minder dan een stil voertuig.`,
      chip: formatPctAbs(ctx.util),
    });
  }

  const order: InsightKind[] = ["risico", "kans", "signaal"];
  const focused = list.filter((item) => item.id.startsWith("focus-"));
  const rest = list.filter((item) => !item.id.startsWith("focus-"));
  rest.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return [...focused, ...rest];
}

function mixNote(id: string): string {
  if (id === "vracht") return "Hier zit de betere marge. Elke punt aandeel weegt zwaarder dan bij Rit.";
  if (id === "plek") return "Abonnementen vragen geen extra vloot. De wachtlijst in Den Haag is omzet die al wil.";
  return "De marge per euro is hier het dunst, maar de avond wordt erdoor gevuld.";
}

function buildGoals(
  kpis: Kpi[],
  cities: CityRow[],
  lens: LensId,
  city: CityId | null,
  days: number,
): Goal[] {
  const omzet = kpis.find((k) => k.key === "omzet")?.value ?? 0;
  const util = kpis.find((k) => k.key === "util")?.value ?? 0;
  const repeat = kpis.find((k) => k.key === "repeat")?.value ?? 0;
  const share = lensById(lens).share * (city ? cityById(city).weight : 1);
  const run = (omzet / Math.max(1, days)) * 92;
  const haag = cities.find((c) => c.id === "den-haag");
  const hubs = haag && haag.delta > 0.04 ? 4 : 3;
  return [
    {
      id: "q4",
      name: "Omzet vierde kwartaal",
      detail: "Koers op het tempo van deze selectie. Het doel schaalt mee met stroom en stad.",
      current: run,
      target: 4_200_000 * share,
      format: "eur",
    },
    {
      id: "bezetting",
      name: "Bezetting",
      detail: "Comfortgrens is 85%. Daarboven weiger je vraag.",
      current: util,
      target: 0.82,
      format: "pct",
    },
    {
      id: "herhaal",
      name: "Herhaal",
      detail: "Aandeel dat binnen de periode terugkomt.",
      current: repeat,
      target: 0.66,
      format: "pct",
    },
    {
      id: "hubs",
      name: "Plek-hubs live",
      detail: "Binckhorst en Strijp-S staan nog op de wachtlijst.",
      current: hubs,
      target: 6,
      format: "count",
    },
  ];
}

function group(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function absPct(ratio: number, digits: number): string {
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

function rel(now: number, prev: number): number {
  if (prev === 0) return 0;
  return (now - prev) / prev;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return sum(xs) / xs.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number): number {
  let a = seed >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
