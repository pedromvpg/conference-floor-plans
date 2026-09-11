export type HallView = {
  orthographic: boolean;
  cuboids: boolean;
  fog: boolean;
  fogIntensity: number;
  ao: boolean;
  shadows: boolean;
  environment: boolean;
  pathTracing: boolean;
  azimuth: number;
  elevation: number;
  distance: number;
  lightAzimuth: number;
  lightElevation: number;
  lightDistance: number;
  lightIntensity: number;
  fill: number;
};

export const DEFAULT_HALL_VIEW: HallView = {
  orthographic: false,
  cuboids: false,
  fog: false,
  fogIntensity: 0.28,
  ao: false,
  shadows: false,
  environment: false,
  pathTracing: false,
  azimuth: 45,
  elevation: 32,
  distance: 1,
  lightAzimuth: 62,
  lightElevation: 56,
  lightDistance: 1,
  lightIntensity: 1,
  fill: 1,
};

export function fogRange(span: number, intensity: number) {
  const i = Math.min(1, Math.max(0, intensity));
  return {
    near: 48 + span * (2.1 - i * 1.7),
    far: 160 + span * (7.2 - i * 5.2),
  };
}

export function sliderRangeStyle(min: number, max: number, value: number): { "--range": string } {
  const t = (Number(value) - min) / (max - min);
  const pct = Number.isFinite(t) ? Math.min(100, Math.max(0, t * 100)) : 0;
  return { "--range": `${pct}%` };
}
