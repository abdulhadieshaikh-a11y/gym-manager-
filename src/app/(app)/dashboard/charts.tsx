"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

const AXIS = { fontSize: 11.5, fill: "#8a8c94" };
const GRID = "#ecebe7";

function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function TooltipBox({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-graphite px-3 py-2 text-[12.5px] text-white shadow-[var(--shadow-pop)]">
      <p className="mb-1 font-medium">{title}</p>
      {lines.map(([k, v]) => (
        <p key={k} className="tabular text-graphite-text">
          {k}: <span className="text-white">{v}</span>
        </p>
      ))}
    </div>
  );
}

type TipProps<T> = { active?: boolean; payload?: ReadonlyArray<{ payload?: T }> };

export function CollectionsChart({ data, currency }: { data: { label: string; total: number }[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={compact} />
        <Tooltip
          cursor={{ fill: "rgba(168,131,74,0.08)" }}
          content={(p: TipProps<{ label: string; total: number }>) =>
            p.active && p.payload?.[0]?.payload ? (
              <TooltipBox title={p.payload[0].payload!.label} lines={[["Collected", formatMoney(p.payload[0].payload!.total, currency)]]} />
            ) : null
          }
        />
        <Bar dataKey="total" fill="#a8834a" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({ data }: { data: { label: string; total: number; added: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          content={(p: TipProps<{ label: string; total: number; added: number }>) =>
            p.active && p.payload?.[0]?.payload ? (
              <TooltipBox
                title={p.payload[0].payload!.label}
                lines={[
                  ["Total members", String(p.payload[0].payload!.total)],
                  ["Joined this month", String(p.payload[0].payload!.added)],
                ]}
              />
            ) : null
          }
        />
        <Line type="monotone" dataKey="total" stroke="#1c1d21" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a8834a", strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AttendanceChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(28,29,33,0.05)" }}
          content={(p: TipProps<{ label: string; count: number }>) =>
            p.active && p.payload?.[0]?.payload ? <TooltipBox title={p.payload[0].payload!.label} lines={[["Check-ins", String(p.payload[0].payload!.count)]]} /> : null
          }
        />
        <Bar dataKey="count" fill="#3a3b42" radius={[3, 3, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
