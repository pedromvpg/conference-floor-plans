"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAT_AISLE_X, SEAT_COL_PITCH, SEAT_ROW_PITCH } from "@/lib/stage-seating";

const SEAT = { w: 0.55, h: 0.45, d: 0.5 };
const BACK = { w: 0.55, h: 0.52, d: 0.1 };

export function StageSeating({
  width,
  startZ,
  depth,
  lodDistance,
  color,
  enabled,
  banks = 1,
}: {
  width: number;
  startZ: number;
  depth: number;
  lodDistance: number;
  color: string;
  enabled: boolean;
  banks?: 1 | 2 | 4;
}) {
  const hiRef = useRef<THREE.Group>(null);
  const loRef = useRef<THREE.Group>(null);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);

  const layout = useMemo(
    () => seatLayout(width, depth, startZ, banks),
    [width, depth, startZ, banks],
  );

  const matrices = useMemo(() => {
    const seat: THREE.Matrix4[] = [];
    const back: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (const p of layout.seats) {
      dummy.rotation.set(0, Math.PI, 0);
      dummy.position.set(p.x, SEAT.h / 2, p.z);
      dummy.updateMatrix();
      seat.push(dummy.matrix.clone());
      dummy.position.set(p.x, SEAT.h + BACK.h / 2, p.z + 0.2);
      dummy.updateMatrix();
      back.push(dummy.matrix.clone());
    }
    return { seat, back };
  }, [layout]);

  useFrame(({ camera }) => {
    const hi = hiRef.current;
    const lo = loRef.current;
    if (!hi || !lo) return;
    origin.set(0, 0, layout.centerZ);
    hi.parent?.localToWorld(world.copy(origin));
    const near = camera.position.distanceTo(world) < lodDistance;
    hi.visible = enabled && near;
    lo.visible = enabled && !near;
  });

  if (!enabled || layout.seats.length === 0) return null;

  return (
    <group>
      <group ref={hiRef}>
        <InstancedBoxes matrices={matrices.seat} size={[SEAT.w, SEAT.h, SEAT.d]} color={color} />
        <InstancedBoxes matrices={matrices.back} size={[BACK.w, BACK.h, BACK.d]} color={color} />
      </group>
      <group ref={loRef} visible={false}>
        {layout.slabs.map((slab, i) => (
          <mesh key={i} position={[slab.x, 0.58, slab.z]} receiveShadow>
            <boxGeometry args={[slab.w, 1.16, slab.d]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function seatLayout(width: number, depth: number, startZ: number, banks: 1 | 2 | 4) {
  const seats: { x: number; z: number }[] = [];
  const slabs: { x: number; z: number; w: number; d: number }[] = [];
  const z0 = startZ + 0.35;

  if (banks === 1) {
    const cols = Math.max(2, Math.floor(width / SEAT_COL_PITCH));
    const rows = Math.max(2, Math.min(18, Math.floor(depth / SEAT_ROW_PITCH)));
    fillBank(seats, slabs, { cols, rows, x0: -((cols - 1) * SEAT_COL_PITCH) / 2, z0 });
    return { seats, slabs, centerZ: startZ + (rows * SEAT_ROW_PITCH) / 2 };
  }

  const count = banks;
  const gaps = (count - 1) * SEAT_AISLE_X;
  const colBudget = Math.max(count * 2, Math.floor((Math.max(width, gaps + SEAT_COL_PITCH * count * 2) - gaps) / SEAT_COL_PITCH));
  const baseCols = Math.max(2, Math.floor(colBudget / count));
  const extra = colBudget - baseCols * count;
  const colCounts = Array.from({ length: count }, (_, i) => baseCols + (i < extra ? 1 : 0));
  const rows = Math.max(2, Math.min(14, Math.floor(depth / SEAT_ROW_PITCH)));
  const bankWs = colCounts.map((c) => c * SEAT_COL_PITCH);
  const totalW = bankWs.reduce((s, w) => s + w, 0) + gaps;
  let xCursor = -totalW / 2;
  const groups = colCounts.map((cols, i) => {
    const x0 = xCursor + SEAT_COL_PITCH / 2;
    xCursor += bankWs[i] + SEAT_AISLE_X;
    return { cols, rows, x0, z0 };
  });

  for (const group of groups) fillBank(seats, slabs, group);
  return { seats, slabs, centerZ: z0 + (rows * SEAT_ROW_PITCH) / 2 };
}

function fillBank(
  seats: { x: number; z: number }[],
  slabs: { x: number; z: number; w: number; d: number }[],
  bank: { cols: number; rows: number; x0: number; z0: number },
) {
  for (let r = 0; r < bank.rows; r++) {
    for (let c = 0; c < bank.cols; c++) {
      seats.push({ x: bank.x0 + c * SEAT_COL_PITCH, z: bank.z0 + r * SEAT_ROW_PITCH });
    }
  }
  slabs.push({
    x: bank.x0 + ((bank.cols - 1) * SEAT_COL_PITCH) / 2,
    z: bank.z0 + ((bank.rows - 1) * SEAT_ROW_PITCH) / 2,
    w: bank.cols * SEAT_COL_PITCH,
    d: bank.rows * SEAT_ROW_PITCH,
  });
}

function InstancedBoxes({
  matrices,
  size,
  color,
}: {
  matrices: THREE.Matrix4[];
  size: [number, number, number];
  color: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </instancedMesh>
  );
}
