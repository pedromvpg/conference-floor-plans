"use client";

import * as THREE from "three";
import { useTexture } from "@react-three/drei";

export function ColorOrMap({
  color,
  url,
  roughness = 0.88,
}: {
  color: string;
  url?: string;
  roughness?: number;
}) {
  if (url) return <MappedMaterial url={url} roughness={roughness} />;
  return <meshStandardMaterial color={color} roughness={roughness} metalness={0.04} />;
}

function MappedMaterial({ url, roughness }: { url: string; roughness: number }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return (
    <meshStandardMaterial
      map={tex}
      roughness={roughness}
      metalness={0.04}
      transparent={url.endsWith(".png") || url.endsWith(".svg") || url.endsWith(".webp")}
    />
  );
}
