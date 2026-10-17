import { useEffect, useState, type ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEur, formatInt, type CityId, type Point, type Slice } from "@/lib/metrics";

const tick = { fill: "var(--color-muted)", fontSize: 12, fontFamily: "var(--font-sans)" };

export function RevenueChart({
  series,
  mode,
  compare,
}: {
  series: Point[];
  mode: "omzet" | "volume";
  compare: boolean;
}) {
  const dataKey = mode === "omzet" ? "omzet" : "volume";
  const prevKey = mode === "omzet" ? "vorig" : "vorigVolume";
  return (
    <ChartFrame className="h-56 sm:h-72">
      <AreaChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="omzetFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brass)" stopOpacity={0.38} />
            <stop offset="100%" stopColor="var(--color-brass)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip content={<MoneyTip mode={mode} compare={compare} />} />
        {compare ? (
          <Area
            type="monotone"
            dataKey={prevKey}
            name="Vorige"
            stroke="var(--color-muted)"
            fill="none"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey={dataKey}
          name="Nu"
          stroke="var(--color-brass)"
          fill="url(#omzetFill)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-brass)", stroke: "var(--color-bg)" }}
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function MixChart({ slices }: { slices: Slice[] }) {
  return (
    <ChartFrame className="h-48">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="88%"
          paddingAngle={2}
          stroke="var(--color-surface)"
          strokeWidth={2}
        >
          {slices.map((s, i) => (
            <Cell key={s.id} fill="var(--color-brass)" fillOpacity={1 - i * 0.22} />
          ))}
        </Pie>
        <Tooltip content={<MixTip />} />
      </PieChart>
    </ChartFrame>
  );
}

export function CityChart({
  rows,
  selected,
  onSelect,
}: {
  rows: { id: CityId; name: string; omzet: number }[];
  selected: CityId | null;
  onSelect: (id: CityId) => void;
}) {
  return (
    <ChartFrame className="h-72">
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        onClick={(state) => {
          const id = state?.activePayload?.[0]?.payload?.id as CityId | undefined;
          if (id) onSelect(id);
        }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={{ fill: "var(--color-fg)", fontSize: 13, fontFamily: "var(--font-sans)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CityTip />} />
        <Bar dataKey="omzet" radius={[0, 6, 6, 0]} barSize={16} cursor="pointer">
          {rows.map((row) => (
            <Cell
              key={row.id}
              fill="var(--color-brass)"
              fillOpacity={!selected || selected === row.id ? 1 : 0.28}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function HourChart({ hours }: { hours: { hour: string; drukte: number }[] }) {
  return (
    <ChartFrame className="h-40">
      <BarChart data={hours} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          tick={tick}
          axisLine={false}
          tickLine={false}
          interval={3}
        />
        <YAxis hide />
        <Tooltip content={<HourTip />} />
        <Bar dataKey="drukte" fill="var(--color-brass)" radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ChartFrame>
  );
}

export function Spark({ data }: { data: number[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const series = data.map((v, i) => ({ i, v }));
  if (!ready) return <div className="h-8 w-full" />;
  return (
    <div className="h-8 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--color-brass)"
            fill="var(--color-brass)"
            fillOpacity={0.16}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartFrame({
  className,
  children,
}: {
  className: string;
  children: ReactElement;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className={className} />;
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function MoneyTip({
  active,
  payload,
  label,
  mode,
  compare,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string }>;
  label?: string;
  mode: "omzet" | "volume";
  compare: boolean;
}) {
  if (!active || !payload?.length) return null;
  const fmt = mode === "omzet" ? formatEur : formatInt;
  const now = payload.find((p) => p.dataKey === (mode === "omzet" ? "omzet" : "volume"));
  const prev = payload.find((p) => p.dataKey === (mode === "omzet" ? "vorig" : "vorigVolume"));
  return (
    <div className="rounded-lg bg-raised px-3 py-2 text-sm shadow-card">
      <p className="text-muted">{label}</p>
      <p className="font-display text-fg tabular-nums">{now?.value != null ? fmt(now.value) : "—"}</p>
      {compare && prev?.value != null ? (
        <p className="text-muted tabular-nums">Vorige {fmt(prev.value)}</p>
      ) : null}
    </div>
  );
}

function MixTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: Slice }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-lg bg-raised px-3 py-2 text-sm shadow-card">
      <p className="text-fg">{row.name}</p>
      <p className="text-muted tabular-nums">{row.value != null ? formatEur(row.value) : ""}</p>
    </div>
  );
}

function CityTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-raised px-3 py-2 text-sm shadow-card">
      <p className="text-fg">{label}</p>
      <p className="text-muted tabular-nums">{payload[0].value != null ? formatEur(payload[0].value) : ""}</p>
    </div>
  );
}

function HourTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-raised px-3 py-2 text-sm shadow-card">
      <p className="text-fg">{label}:00</p>
      <p className="text-muted">Drukte {payload[0].value}</p>
    </div>
  );
}
