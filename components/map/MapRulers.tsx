"use client";

import { fromMeters, rulerStepMeters, rulerTicks } from "@/lib/units";
import type { Units } from "@/lib/types";

const BAR = 22;

export function MapRulers({
  cam,
  units,
  pxPerMeter,
  viewW,
  viewH,
}: {
  cam: { x: number; y: number; w: number; h: number };
  units: Units;
  pxPerMeter: number;
  viewW: number;
  viewH: number;
}) {
  if (viewW < 1 || viewH < 1 || !(pxPerMeter > 0)) return null;

  const scale = pxPerMeter;
  const ox = (viewW - cam.w * scale) / 2;
  const oy = (viewH - cam.h * scale) / 2;
  const worldLeft = cam.x - ox / scale;
  const worldRight = cam.x + (viewW - ox) / scale;
  const worldTop = cam.y - oy / scale;
  const worldBottom = cam.y + (viewH - oy) / scale;

  const major = rulerStepMeters(units, scale);
  const minor = major / 5;
  const xTicks = rulerTicks(worldLeft, worldRight, minor);
  const yTicks = rulerTicks(worldTop, worldBottom, minor);
  const sx = (x: number) => ox + (x - cam.x) * scale;
  const sy = (y: number) => oy + (y - cam.y) * scale;
  const label = (meters: number) => {
    const v = fromMeters(meters, units);
    return Number.isInteger(v) ? String(v) : v.toFixed(v >= 10 ? 0 : 1);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      <svg className="h-full w-full" width={viewW} height={viewH}>
        <rect x={0} y={0} width={viewW} height={BAR} fill="var(--map-bg)" fillOpacity={0.92} />
        <rect x={0} y={0} width={BAR} height={viewH} fill="var(--map-bg)" fillOpacity={0.92} />
        {xTicks.map((x) => {
          const majorTick = Math.abs(x / major - Math.round(x / major)) < 1e-6;
          const h = majorTick ? BAR * 0.55 : BAR * 0.28;
          const px = sx(x);
          return (
            <g key={`rx-${x}`}>
              <line
                x1={px}
                y1={BAR}
                x2={px}
                y2={BAR - h}
                stroke="var(--map-label-muted)"
                strokeWidth={1}
              />
              {majorTick && px > BAR + 4 ? (
                <text
                  x={px + 3}
                  y={BAR - h - 2}
                  fill="var(--map-label-muted)"
                  fontSize={10}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {label(x)}
                </text>
              ) : null}
            </g>
          );
        })}
        {yTicks.map((y) => {
          const majorTick = Math.abs(y / major - Math.round(y / major)) < 1e-6;
          const w = majorTick ? BAR * 0.55 : BAR * 0.28;
          const py = sy(y);
          return (
            <g key={`ry-${y}`}>
              <line
                x1={BAR}
                y1={py}
                x2={BAR - w}
                y2={py}
                stroke="var(--map-label-muted)"
                strokeWidth={1}
              />
              {majorTick && py > BAR + 8 ? (
                <text
                  x={4}
                  y={py - 2}
                  fill="var(--map-label-muted)"
                  fontSize={10}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {label(y)}
                </text>
              ) : null}
            </g>
          );
        })}
        <rect x={0} y={0} width={BAR} height={BAR} fill="var(--map-bg)" />
        <text
          x={BAR / 2}
          y={BAR / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--map-label-muted)"
          fontSize={10}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {units}
        </text>
      </svg>
    </div>
  );
}
