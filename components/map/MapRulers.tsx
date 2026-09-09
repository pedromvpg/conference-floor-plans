"use client";

import { fromMeters, rulerStepMeters, rulerTicks } from "@/lib/units";
import type { Units } from "@/lib/types";

export function MapRulers({
  cam,
  units,
  pxPerMeter,
}: {
  cam: { x: number; y: number; w: number; h: number };
  units: Units;
  pxPerMeter: number;
}) {
  const bar = 22 / Math.max(pxPerMeter, 1e-6);
  const stroke = 1 / Math.max(pxPerMeter, 1e-6);
  const font = 10 / Math.max(pxPerMeter, 1e-6);
  const major = rulerStepMeters(units, pxPerMeter);
  const minor = major / 5;
  const xTicks = rulerTicks(cam.x, cam.x + cam.w, minor);
  const yTicks = rulerTicks(cam.y, cam.y + cam.h, minor);
  const label = (meters: number) => {
    const v = fromMeters(meters, units);
    return Number.isInteger(v) ? String(v) : v.toFixed(v >= 10 ? 0 : 1);
  };

  return (
    <g pointerEvents="none">
      <rect x={cam.x} y={cam.y} width={cam.w} height={bar} fill="var(--map-bg)" fillOpacity={0.92} />
      <rect x={cam.x} y={cam.y} width={bar} height={cam.h} fill="var(--map-bg)" fillOpacity={0.92} />
      {xTicks.map((x) => {
        const majorTick = Math.abs(x / major - Math.round(x / major)) < 1e-6;
        const h = majorTick ? bar * 0.7 : bar * 0.35;
        return (
          <g key={`rx-${x}`}>
            <line
              x1={x}
              y1={cam.y + bar}
              x2={x}
              y2={cam.y + bar - h}
              stroke="var(--map-label-muted)"
              strokeWidth={stroke}
            />
            {majorTick && x > cam.x + bar ? (
              <text
                x={x + font * 0.2}
                y={cam.y + bar - h - font * 0.2}
                fill="var(--map-label-muted)"
                fontSize={font}
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
        const w = majorTick ? bar * 0.7 : bar * 0.35;
        return (
          <g key={`ry-${y}`}>
            <line
              x1={cam.x + bar}
              y1={y}
              x2={cam.x + bar - w}
              y2={y}
              stroke="var(--map-label-muted)"
              strokeWidth={stroke}
            />
            {majorTick && y > cam.y + bar ? (
              <text
                x={cam.x + 3 / Math.max(pxPerMeter, 1e-6)}
                y={y - font * 0.25}
                fill="var(--map-label-muted)"
                fontSize={font}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {label(y)}
              </text>
            ) : null}
          </g>
        );
      })}
      <rect x={cam.x} y={cam.y} width={bar} height={bar} fill="var(--map-bg)" />
      <text
        x={cam.x + bar * 0.5}
        y={cam.y + bar * 0.62}
        textAnchor="middle"
        fill="var(--map-label-muted)"
        fontSize={font}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {units}
      </text>
    </g>
  );
}
