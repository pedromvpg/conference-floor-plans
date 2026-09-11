"use client";

import { Suspense, useEffect, useLayoutEffect, type ReactNode } from "react";
import * as THREE from "three";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Pathtracer, usePathtracer } from "@react-three/gpu-pathtracer";
import { EffectComposer, N8AO } from "@react-three/postprocessing";

export function HallPathTrace({
  enabled,
  sceneKey = 0,
  children,
}: {
  enabled: boolean;
  sceneKey?: string | number;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <Pathtracer enabled samples={28} bounces={4} tiles={2} resolutionFactor={0.7} minSamples={1}>
      {children}
      <PathTraceRebuild sceneKey={sceneKey} />
    </Pathtracer>
  );
}

function PathTraceRebuild({ sceneKey }: { sceneKey: string | number }) {
  const { update, reset } = usePathtracer();
  useEffect(() => {
    update();
    reset();
  }, [sceneKey, update, reset]);
  return null;
}

export function HallEnvironment({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <Environment preset="warehouse" environmentIntensity={0.42} />
    </Suspense>
  );
}

export function HallAO({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <N8AO aoRadius={2.2} intensity={1.25} quality="performance" halfRes />
    </EffectComposer>
  );
}

function litMaterial(mat: THREE.Material | THREE.Material[] | undefined) {
  const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
  return list.some(
    (m) =>
      m instanceof THREE.MeshStandardMaterial ||
      m instanceof THREE.MeshPhysicalMaterial ||
      m instanceof THREE.MeshLambertMaterial ||
      m instanceof THREE.MeshPhongMaterial ||
      m instanceof THREE.MeshToonMaterial,
  );
}

function applyShadowFlags(scene: THREE.Scene, enabled: boolean) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mode = mesh.userData.shadowMode as "none" | "cast" | "receive" | "both" | undefined;
    if (!enabled || mode === "none") {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return;
    }
    if (mode === "receive") {
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      return;
    }
    if (!litMaterial(mesh.material)) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return;
    }
    if (mode === "cast") {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      return;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

export function ApplyMeshShadows({ enabled, revision }: { enabled: boolean; revision: number }) {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    applyShadowFlags(scene, enabled);
    let nested = 0;
    const a = requestAnimationFrame(() => {
      applyShadowFlags(scene, enabled);
      nested = requestAnimationFrame(() => applyShadowFlags(scene, enabled));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(nested);
    };
  }, [enabled, revision, scene]);
  return null;
}
