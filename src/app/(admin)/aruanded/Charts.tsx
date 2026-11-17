"use client";

import { useState } from "react";
import { formatEuro } from "@/lib/time";

// Ühe seeria tulpdiagramm: üks toon, 4px ümar ots, õhuke ruudustik, hõljumisel vihje.
const BAR = "#0f766e";

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function RevenueBars({ data }: { data: { label: string; cents: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 56, r: 12, t: 16, b: 28 };
  const max = niceMax(Math.max(...data.map((d) => d.cents), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(24, band * 0.5);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const best = data.reduce((bi, d, i) => (d.cents > data[bi].cents ? i : bi), 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Käive perioodi kaupa">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#eef0f3" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
              {formatEuro(t, { decimals: false })}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + band * i + (band - bw) / 2;
          const top = y(d.cents);
          const h = Math.max(0, H - pad.b - top);
          const r = Math.min(4, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* suurem tabamisala kui tulp */}
              <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" />
              <path
                d={`M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z`}
                fill={BAR}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              {i === best && d.cents > 0 && (
                <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1f2937">
                  {formatEuro(d.cents, { decimals: false })}
                </text>
              )}
              <text x={pad.l + band * i + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7280">
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#d0d5dd" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="text-muted">{data[hover].label}</p>
          <p className="font-semibold">{formatEuro(data[hover].cents, { decimals: true })}</p>
        </div>
      )}
    </div>
  );
}

// Soojuskaart: üks toon heledast tumedani (järjestikune skaala)
const RAMP = ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e"];

export function Heatmap({ days, hours, values }: { days: string[]; hours: number[]; values: number[][] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(...values.flat(), 1);
  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `28px repeat(${hours.length}, minmax(0,1fr))` }}>
        <span />
        {hours.map((h) => (
          <span key={h} className="pb-1 text-center text-[11px] text-muted">
            {h}
          </span>
        ))}
        {days.map((d, di) => (
          <div key={d} className="contents">
            <span className="flex items-center text-[11px] text-muted">{d}</span>
            {hours.map((h, hi) => {
              const v = values[di][hi];
              const step = v === 0 ? 0 : Math.min(RAMP.length - 1, 1 + Math.floor((v / max) * (RAMP.length - 2)));
              return (
                <span
                  key={h}
                  onMouseEnter={() => setHover({ d: di, h: hi })}
                  onMouseLeave={() => setHover(null)}
                  className="h-7 rounded-[4px]"
                  style={{ background: RAMP[step], outline: hover?.d === di && hover?.h === hi ? "2px solid #1f2937" : undefined }}
                  title={`${d} ${h}:00 – ${v} broneeringut`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{hover ? `${days[hover.d]} kell ${hours[hover.h]}:00 · ${values[hover.d][hover.h]} broneeringut` : "Tumedam = rohkem broneeringuid. Heledad kohad on head ajad kampaaniaks."}</span>
        <span className="flex items-center gap-1">
          vähem
          {RAMP.slice(1).map((c) => (
            <span key={c} className="size-3 rounded-sm" style={{ background: c }} />
          ))}
          rohkem
        </span>
      </div>
    </div>
  );
}
