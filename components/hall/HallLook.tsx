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

export function ApplyMeshShadows({ enabled, revision }: { enabled: boolean; revision: number }) {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
    });
  }, [enabled, revision, scene]);
  return null;
}
