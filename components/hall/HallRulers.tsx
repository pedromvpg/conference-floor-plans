"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import { fromMeters, rulerStepFromSpan, rulerTicks } from "@/lib/units";
import type { Units } from "@/lib/types";
import type { HallExtent } from "./HallScene";

export function HallRulers({
  extent,
  units,
  color,
}: {
  extent: HallExtent;
  units: Units;
  color: string;
}) {
  const step = rulerStepFromSpan(Math.max(extent.w, extent.h), units);
  const xTicks = useMemo(
    () => rulerTicks(extent.minX, extent.maxX, step),
    [extent.minX, extent.maxX, step],
  );
  const yTicks = useMemo(
    () => rulerTicks(extent.minY, extent.maxY, step),
    [extent.minY, extent.maxY, step],
  );
  const y = 0.04;
  const tick = Math.min(step, 1.2) * 0.35;
  const label = (meters: number) => {
    const v = fromMeters(meters, units);
    return Number.isInteger(v) ? String(v) : v.toFixed(v >= 10 ? 0 : 1);
  };

  return (
    <group>
      <Line
        points={[
          [extent.minX, y, extent.minY],
          [extent.maxX, y, extent.minY],
        ]}
        color={color}
      />
      <Line
        points={[
          [extent.minX, y, extent.minY],
          [extent.minX, y, extent.maxY],
        ]}
        color={color}
      />
      {xTicks.map((x) => (
        <group key={`hx-${x}`}>
          <Line
            points={[
              [x, y, extent.minY],
              [x, y, extent.minY - tick],
            ]}
            color={color}
          />
          <Text
            position={[x, y + 0.02, extent.minY - tick - 0.35]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.45}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {label(x)}
          </Text>
        </group>
      ))}
      {yTicks.map((z) => (
        <group key={`hz-${z}`}>
          <Line
            points={[
              [extent.minX, y, z],
              [extent.minX - tick, y, z],
            ]}
            color={color}
          />
          <Text
            position={[extent.minX - tick - 0.35, y + 0.02, z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            fontSize={0.45}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {label(z)}
          </Text>
        </group>
      ))}
      <Text
        position={[extent.minX - tick, y + 0.02, extent.minY - tick]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.4}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {units}
      </Text>
    </group>
  );
}
