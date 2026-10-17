import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ChartColumn,
  LayoutDashboard,
  Lightbulb,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { CityChart, HourChart, MixChart, RevenueChart, Spark } from "@/components/charts";
import {
  CITIES,
  LENSES,
  LOGBOOK,
  PERIODS,
  buildSnapshot,
  formatEur,
  formatEurCompact,
  formatInt,
  formatPct,
  formatPctAbs,
  formatPt,
  lensById,
  periodById,
  shiftLift,
  todayLabel,
  type CityId,
  type Insight,
  type InsightKind,
  type Kpi,
  type LensId,
  type PeriodId,
} from "@/lib/metrics";

const STORE_KEY = "meridiaan-desk-v1";

const NAV = [
  { id: "bureau", label: "Bureau", icon: LayoutDashboard },
  { id: "stromen", label: "Stromen", icon: ChartColumn },
  { id: "inzichten", label: "Inzichten", icon: Lightbulb },
  { id: "doelen", label: "Doelen", icon: Target },
] as const;

type NavId = (typeof NAV)[number]["id"];

type Prefs = {
  period: PeriodId;
  lens: LensId;
  city: CityId | null;
  compare: boolean;
  pinned: string[];
  dismissed: string[];
};

const DEFAULTS: Prefs = {
  period: "30",
  lens: "alles",
  city: null,
  compare: true,
  pinned: [],
  dismissed: [],
};

export function Desk() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"omzet" | "volume">("omzet");
  const [kind, setKind] = useState<InsightKind | "alles" | "bewaard">("alles");
  const [extra, setExtra] = useState(8);
  const [active, setActive] = useState<NavId>("bureau");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({ ...DEFAULTS, ...parsed, city: parsed.city ?? null });
      }
    } catch {
      /* ignore broken local prefs */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  }, [prefs, hydrated]);

  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el);
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = vis?.target.id as NavId | undefined;
        if (id) setActive(id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.15, 0.4] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const snap = useMemo(
    () => buildSnapshot(prefs.period, prefs.lens, prefs.city),
    [prefs.period, prefs.lens, prefs.city],
  );

  const omzet = snap.kpis[0];
  const lead = snap.insights.find((item) => !prefs.dismissed.includes(item.id));
  const period = periodById(prefs.period);
  const lens = lensById(prefs.lens);
  const cityName = prefs.city ? CITIES.find((c) => c.id === prefs.city)?.name : null;
  const lift = shiftLift(snap.rotterdam.omzet, snap.rotterdam.util, extra / 100);

  const visible = snap.insights.filter((item) => {
    if (prefs.dismissed.includes(item.id) && kind !== "bewaard") return false;
    if (kind === "bewaard") return prefs.pinned.includes(item.id);
    if (kind === "alles") return true;
    return item.kind === kind;
  });

  function patch(partial: Partial<Prefs>) {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }

  function go(id: NavId) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function togglePin(id: string) {
    patch({
      pinned: prefs.pinned.includes(id) ? prefs.pinned.filter((x) => x !== id) : [...prefs.pinned, id],
    });
  }

  function dismiss(id: string) {
    patch({ dismissed: prefs.dismissed.includes(id) ? prefs.dismissed : [...prefs.dismissed, id] });
  }

  return (
    <div className="min-h-dvh bg-bg text-fg md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-line px-5 py-6 md:flex">
        <div>
          <Brand />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Secties">
            {NAV.map((item) => (
              <NavButton key={item.id} item={item} active={active === item.id} onClick={() => go(item.id)} />
            ))}
          </nav>
        </div>
        <p className="text-sm text-muted">Rotterdam · {todayLabel()}</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Brand compact />
            </div>
            <p className="hidden text-sm text-muted md:block">{todayLabel()}</p>
            <p className="text-sm text-muted tabular-nums">t/m 17 okt</p>
          </div>
        </header>

        <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 pb-28 md:px-8 md:pb-16">
          <section id="bureau" className="scroll-mt-20 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-brass">Bureau · {lens.label}{cityName ? ` · ${cityName}` : ""}</p>
              <h1 className="font-display text-3xl text-fg md:text-5xl">De periode in één blik</h1>
              <p className="max-w-2xl font-display text-xl text-fg md:text-2xl">
                {lead?.title ?? "Geen uitschieter in deze selectie."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Control label="Periode">
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Periode">
                  {PERIODS.map((p) => (
                    <Chip
                      key={p.id}
                      pressed={prefs.period === p.id}
                      onClick={() => patch({ period: p.id })}
                      label={p.long}
                    >
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </Control>
              <Control label="Stroom">
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Stroom">
                  {LENSES.map((l) => (
                    <Chip
                      key={l.id}
                      pressed={prefs.lens === l.id}
                      onClick={() => patch({ lens: l.id })}
                      label={l.label}
                    >
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </Control>
              <div className="flex flex-wrap items-center gap-2">
                <Chip pressed={prefs.compare} onClick={() => patch({ compare: !prefs.compare })} label="Vergelijk met de vorige periode" toggle>
                  Vergelijk vorige
                </Chip>
                {cityName ? (
                  <button
                    type="button"
                    onClick={() => patch({ city: null })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brass px-3 text-sm font-medium text-ink"
                  >
                    {cityName}
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only">Wis stad</span>
                  </button>
                ) : (
                  <p className="text-sm text-muted">Heel het netwerk · {period.long}</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-5 shadow-card">
              <p className="text-sm text-muted">Omzet · {period.long}</p>
              <p className="mt-1 font-display text-4xl tabular-nums tracking-tight text-fg md:text-6xl">
                {formatEur(omzet.value)}
              </p>
              <Delta value={omzet.delta} mode={omzet.deltaMode} />
            </div>

            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {snap.kpis.map((kpi) => (
                <KpiCard key={kpi.key} kpi={kpi} />
              ))}
            </ul>
          </section>

          <section id="stromen" className="scroll-mt-20 flex flex-col gap-4">
            <SectionTitle kicker="Stromen" title="Hoe het geld loopt" />
            <div className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl">{mode === "omzet" ? "Omzet" : (snap.kpis[1]?.label ?? "Volume")}</h3>
                  <p className="text-sm text-muted">
                    {prefs.compare ? "Messing is nu, streep is de vorige periode." : "Alleen deze periode."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grafiek">
                  <Chip pressed={mode === "omzet"} onClick={() => setMode("omzet")} label="Omzet">
                    Omzet
                  </Chip>
                  <Chip pressed={mode === "volume"} onClick={() => setMode("volume")} label="Volume">
                    Volume
                  </Chip>
                </div>
              </div>
              <RevenueChart series={snap.series} mode={mode} compare={prefs.compare} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
                <h3 className="font-display text-xl">{prefs.lens === "alles" ? "Mix van stromen" : "Dagdelen"}</h3>
                <p className="text-sm text-muted">Aandeel van de omzet in deze selectie.</p>
                <MixChart slices={snap.mix} />
                <ul className="mt-2 flex flex-col gap-2">
                  {snap.mix.map((slice, i) => (
                    <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full bg-brass"
                          style={{ opacity: 1 - i * 0.22 }}
                          aria-hidden="true"
                        />
                        <span>
                          {slice.name}
                          <span className="text-muted"> · {slice.hint}</span>
                        </span>
                      </span>
                      <span className="tabular-nums text-muted">
                        {formatPctAbs(slice.share)}
                        {prefs.lens === "alles" ? ` · ${formatPct(slice.delta)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
                <h3 className="font-display text-xl">Wanneer het druk is</h3>
                <p className="text-sm text-muted">Relatieve drukte over het etmaal, voor {lens.label.toLowerCase()}.</p>
                <HourChart hours={snap.hours} />
              </article>
            </div>

            <article className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
              <div className="mb-3 flex flex-col gap-3">
                <div>
                  <h3 className="font-display text-xl">Steden</h3>
                  <p className="text-sm text-muted">Kies een stad. Het bureau, de mix en de drukte volgen.</p>
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stad">
                  <Chip pressed={prefs.city === null} onClick={() => patch({ city: null })} label="Alle steden">
                    Alle
                  </Chip>
                  {snap.cities.map((row) => (
                    <Chip
                      key={row.id}
                      pressed={prefs.city === row.id}
                      onClick={() => patch({ city: prefs.city === row.id ? null : row.id })}
                      label={row.name}
                    >
                      {row.name}
                    </Chip>
                  ))}
                </div>
              </div>
              <CityChart
                rows={snap.cities}
                selected={prefs.city}
                onSelect={(id) => patch({ city: prefs.city === id ? null : id })}
              />
              <div className="mt-4 border-t border-line pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">Extra shift, Rotterdam</h3>
                  <p className="font-display text-2xl tabular-nums text-brass">{formatEur(lift.euro)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {extra}% extra capaciteit. Bij een bezetting van {formatPctAbs(snap.rotterdam.util)} wordt ongeveer{" "}
                  {formatPctAbs(lift.capture, 0)} daarvan echt omzet. De rest blijft reserve.
                </p>
                <label className="mt-4 flex flex-col gap-2 text-sm">
                  <span className="text-muted">Capaciteit erbij · {extra}%</span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={extra}
                    onChange={(e) => setExtra(Number(e.target.value))}
                    className="accent-brass h-11 w-full"
                  />
                </label>
              </div>
            </article>
          </section>

          <section id="inzichten" className="scroll-mt-20 flex flex-col gap-4">
            <SectionTitle kicker="Inzichten" title="Wat het betekent" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Soort inzicht">
              {(
                [
                  ["alles", "Alles"],
                  ["risico", "Risico"],
                  ["kans", "Kans"],
                  ["signaal", "Signaal"],
                  ["bewaard", "Bewaard"],
                ] as const
              ).map(([id, label]) => (
                <Chip key={id} pressed={kind === id} onClick={() => setKind(id)} label={label}>
                  {label}
                </Chip>
              ))}
            </div>
            {visible.length === 0 ? (
              <div className="rounded-2xl bg-surface p-5 shadow-card">
                <p className="font-display text-xl">Niets in dit vak</p>
                <p className="mt-1 text-sm text-muted">
                  {prefs.dismissed.length > 0
                    ? "Weggeklikte inzichten staan nog in het geheugen van dit bureau."
                    : "Bewaar een inzicht met het bladwijzer-icoon."}
                </p>
                {prefs.dismissed.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => patch({ dismissed: [] })}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-brass"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Zet weggeklikte terug
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((item) => (
                  <InsightCard
                    key={item.id}
                    item={item}
                    pinned={prefs.pinned.includes(item.id)}
                    onPin={() => togglePin(item.id)}
                    onDismiss={() => dismiss(item.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section id="doelen" className="scroll-mt-20 flex flex-col gap-4">
            <SectionTitle kicker="Doelen" title="Waar het naartoe moet" />
            <ul className="grid gap-3 md:grid-cols-2">
              {snap.goals.map((goal) => {
                const ratio = goal.target === 0 ? 0 : goal.current / goal.target;
                const width = Math.max(0, Math.min(100, ratio * 100));
                return (
                  <li key={goal.id} className="rounded-2xl bg-surface p-4 shadow-card">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-xl">{goal.name}</h3>
                      <p className="tabular-nums text-brass">{formatPctAbs(Math.min(ratio, 9.99), 0)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted">{goal.detail}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                      <div className="h-full rounded-full bg-brass" style={{ width: `${width}%` }} />
                    </div>
                    <p className="mt-2 text-sm tabular-nums text-fg">
                      {goal.format === "eur"
                        ? formatEurCompact(goal.current)
                        : goal.format === "pct"
                          ? formatPctAbs(goal.current)
                          : formatInt(goal.current)}
                      <span className="text-muted">
                        {" "}
                        van{" "}
                        {goal.format === "eur"
                          ? formatEurCompact(goal.target)
                          : goal.format === "pct"
                            ? formatPctAbs(goal.target)
                            : formatInt(goal.target)}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>

            <article className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
              <h3 className="font-display text-xl">Logboek</h3>
              <p className="text-sm text-muted">Wat het bureau deze weken heeft zien gebeuren.</p>
              <ol className="mt-4 flex flex-col">
                {LOGBOOK.map((entry) => (
                  <li key={entry.title} className="grid grid-cols-[4.5rem_1fr] gap-3 border-t border-line py-3">
                    <p className="text-sm tabular-nums text-brass">{entry.date}</p>
                    <div>
                      <p className="font-medium">{entry.title}</p>
                      <p className="text-sm text-muted">{entry.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </section>

          <footer className="border-t border-line pt-4 text-sm text-muted">
            Meridiaan is een demonstratiebedrijf in Rotterdam. Elke grafiek, elk inzicht en de extra shift
            gebruiken hetzelfde boek. Cijfers zijn geen live feed.
          </footer>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-bg/95 backdrop-blur-md md:hidden"
        aria-label="Secties"
      >
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            className={
              active === item.id
                ? "flex min-h-16 flex-col items-center justify-center gap-1 text-brass"
                : "flex min-h-16 flex-col items-center justify-center gap-1 text-muted"
            }
            aria-current={active === item.id ? "true" : undefined}
          >
            <item.icon className="size-5" aria-hidden="true" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "font-display text-xl italic text-fg" : "font-display text-3xl italic text-fg"}>
      Meridiaan
    </p>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex min-h-11 items-center gap-3 rounded-xl bg-raised px-3 text-left text-fg"
          : "flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-muted"
      }
      aria-current={active ? "true" : undefined}
    >
      <Icon className="size-4" aria-hidden="true" />
      {item.label}
    </button>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  label,
  children,
  toggle = false,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  toggle?: boolean;
}) {
  return (
    <button
      type="button"
      role={toggle ? undefined : "radio"}
      aria-checked={toggle ? undefined : pressed}
      aria-pressed={toggle ? pressed : undefined}
      aria-label={label}
      onClick={onClick}
      className={
        pressed
          ? "min-h-11 rounded-full bg-brass px-2 text-sm font-medium text-ink"
          : "min-h-11 rounded-full bg-surface px-2 text-sm text-fg shadow-card"
      }
    >
      {children}
    </button>
  );
}

function Delta({ value, mode, compact = false }: { value: number; mode: "rel" | "pt"; compact?: boolean }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={up ? "mt-2 inline-flex items-center gap-1 text-sm text-brass" : "mt-2 inline-flex items-center gap-1 text-sm text-muted"}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{mode === "pt" ? formatPt(value) : formatPct(value)}</span>
      {compact ? null : <span>t.o.v. de vorige periode</span>}
    </p>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const shown =
    kpi.key === "omzet"
      ? formatEurCompact(kpi.value)
      : kpi.key === "volume"
        ? formatInt(kpi.value)
        : formatPctAbs(kpi.value);
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-card">
      <p className="text-sm text-muted">{kpi.label}</p>
      <p className="font-display text-2xl tabular-nums text-fg">{shown}</p>
      <Spark data={kpi.spark} />
      <Delta value={kpi.delta} mode={kpi.deltaMode} compact />
    </li>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-sm text-brass">{kicker}</p>
      <h2 className="font-display text-3xl">{title}</h2>
    </div>
  );
}

function InsightCard({
  item,
  pinned,
  onPin,
  onDismiss,
}: {
  item: Insight;
  pinned: boolean;
  onPin: () => void;
  onDismiss: () => void;
}) {
  const kindLabel = item.kind === "kans" ? "Kans" : item.kind === "risico" ? "Risico" : "Signaal";
  return (
    <li className="rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-brass">
          {kindLabel} · <span className="tabular-nums">{item.chip}</span>
        </p>
        <div className="flex">
          <button
            type="button"
            onClick={onPin}
            aria-pressed={pinned}
            aria-label={pinned ? "Maak bewaren ongedaan" : "Bewaar inzicht"}
            className="inline-flex size-11 items-center justify-center text-fg"
          >
            {pinned ? <BookmarkCheck className="size-5 text-brass" /> : <Bookmark className="size-5" />}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Klap inzicht weg"
            className="inline-flex size-11 items-center justify-center text-muted"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <h3 className="font-display text-xl">{item.title}</h3>
      <p className="mt-1 text-sm text-muted">{item.body}</p>
    </li>
  );
}

