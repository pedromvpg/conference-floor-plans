"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SEAT = { w: 0.55, h: 0.45, d: 0.5 };
const BACK = { w: 0.55, h: 0.52, d: 0.1 };
const ROW_PITCH = 1.05;
const COL_PITCH = 0.62;

export function StageSeating({
  width,
  startZ,
  depth,
  lodDistance,
  color,
  enabled,
}: {
  width: number;
  startZ: number;
  depth: number;
  lodDistance: number;
  color: string;
  enabled: boolean;
}) {
  const hiRef = useRef<THREE.Group>(null);
  const loRef = useRef<THREE.Group>(null);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);

  const cols = Math.max(2, Math.floor(width / COL_PITCH));
  const rows = Math.max(2, Math.min(10, Math.floor(depth / ROW_PITCH)));
  const slabW = cols * COL_PITCH;
  const slabD = rows * ROW_PITCH;
  const centerZ = startZ + slabD / 2;

  const matrices = useMemo(() => {
    const seat: THREE.Matrix4[] = [];
    const back: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const x0 = -((cols - 1) * COL_PITCH) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * COL_PITCH;
        const z = startZ + 0.35 + r * ROW_PITCH;
        dummy.rotation.set(0, Math.PI, 0);
        dummy.position.set(x, SEAT.h / 2, z);
        dummy.updateMatrix();
        seat.push(dummy.matrix.clone());
        dummy.position.set(x, SEAT.h + BACK.h / 2, z + 0.2);
        dummy.updateMatrix();
        back.push(dummy.matrix.clone());
      }
    }
    return { seat, back };
  }, [cols, rows, startZ]);

  useFrame(({ camera }) => {
    const hi = hiRef.current;
    const lo = loRef.current;
    if (!hi || !lo) return;
    origin.set(0, 0, centerZ);
    hi.parent?.localToWorld(world.copy(origin));
    const near = camera.position.distanceTo(world) < lodDistance;
    hi.visible = enabled && near;
    lo.visible = enabled && !near;
  });

  if (!enabled) return null;

  return (
    <group>
      <group ref={hiRef}>
        <InstancedBoxes matrices={matrices.seat} size={[SEAT.w, SEAT.h, SEAT.d]} color={color} />
        <InstancedBoxes matrices={matrices.back} size={[BACK.w, BACK.h, BACK.d]} color={color} />
      </group>
      <group ref={loRef} visible={false}>
        <mesh position={[0, 0.58, centerZ]} receiveShadow>
          <boxGeometry args={[slabW, 1.16, slabD]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
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
