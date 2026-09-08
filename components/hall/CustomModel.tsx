"use client";

import { Component, type ReactNode, useMemo } from "react";
import * as THREE from "three";
import { Clone, useGLTF } from "@react-three/drei";
import { facingObb, yawRad } from "@/lib/hall";
import type { Ring } from "@/lib/types";
import { BoothKit } from "./BoothKit";

export function CustomModel({
  url,
  ring,
  facingDeg,
  rugColor,
  selected,
}: {
  url: string;
  ring: Ring;
  facingDeg: number;
  rugColor: string;
  selected: boolean;
}) {
  const fallback = (
    <BoothKit ring={ring} facingDeg={facingDeg} rugColor={rugColor} selected={selected} />
  );
  return (
    <ModelErrorBoundary resetKey={url} fallback={fallback}>
      <FittedGltf url={url} ring={ring} facingDeg={facingDeg} selected={selected} />
    </ModelErrorBoundary>
  );
}

function FittedGltf({
  url,
  ring,
  facingDeg,
  selected,
}: {
  url: string;
  ring: Ring;
  facingDeg: number;
  selected: boolean;
}) {
  const gltf = useGLTF(url);
  const obb = facingObb(ring, facingDeg);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return {
      sx: size.x > 1e-4 ? obb.w / size.x : 1,
      sz: size.z > 1e-4 ? obb.d / size.z : 1,
      ox: -center.x,
      oy: -box.min.y,
      oz: -center.z,
    };
  }, [gltf.scene, obb.w, obb.d]);

  return (
    <group position={[obb.cx, 0, obb.cy]} rotation={[0, yawRad(facingDeg), 0]}>
      <group scale={[fit.sx, 1, fit.sz]}>
        <group position={[fit.ox, fit.oy, fit.oz]}>
          <Clone object={gltf.scene} />
        </group>
      </group>
      {selected ? (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(obb.w, obb.d) * 0.48, Math.max(obb.w, obb.d) * 0.52, 24]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      ) : null}
    </group>
  );
}

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; resetKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: Readonly<{ resetKey: string }>) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
