"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

export type MapFit = "repeat" | "cover";

export function ColorOrMap({
  color,
  url,
  roughness = 0.88,
  fit = "repeat",
  aspect = 1,
}: {
  color: string;
  url?: string;
  roughness?: number;
  fit?: MapFit;
  aspect?: number;
}) {
  if (url) return <MappedMaterial url={url} roughness={roughness} fit={fit} aspect={aspect} />;
  return <meshStandardMaterial color={color} roughness={roughness} metalness={0.04} />;
}

function MappedMaterial({
  url,
  roughness,
  fit,
  aspect,
}: {
  url: string;
  roughness: number;
  fit: MapFit;
  aspect: number;
}) {
  const shared = useTexture(url);
  const tex = useMemo(() => {
    const t = shared.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [shared]);

  useEffect(() => {
    return () => {
      tex.dispose();
    };
  }, [tex]);

  useEffect(() => {
    if (fit === "cover") {
      const img = tex.image as { width?: number; height?: number } | undefined;
      const imgAspect = img?.width && img.height ? img.width / img.height : aspect;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      if (imgAspect > aspect && aspect > 0) {
        const rx = aspect / imgAspect;
        tex.repeat.set(rx, 1);
        tex.offset.set((1 - rx) / 2, 0);
      } else if (imgAspect > 0) {
        const ry = imgAspect / Math.max(aspect, 1e-6);
        tex.repeat.set(1, ry);
        tex.offset.set(0, (1 - ry) / 2);
      } else {
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
      }
    } else {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
    }
    tex.needsUpdate = true;
  }, [tex, fit, aspect]);

  return (
    <meshStandardMaterial
      map={tex}
      roughness={roughness}
      metalness={0.04}
      transparent={url.endsWith(".png") || url.endsWith(".svg") || url.endsWith(".webp")}
    />
  );
}
