import type { Calibration, Floor, FloorBasemap } from "./types";

export function primaryFloor(floors: Floor[]): Floor | undefined {
  return [...floors].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))[0];
}

export function inheritedSettingsTargetId(
  floor: Floor,
  floors: Floor[],
  field: "calibration" | "basemap",
): string {
  const primary = primaryFloor(floors);
  if (!primary || floor.id === primary.id) return floor.id;
  if (floor[field] == null) return primary.id;
  return floor.id;
}

export function withInheritedFloorSettings(floor: Floor, floors: Floor[]): Floor {
  const primary = primaryFloor(floors);
  if (!primary || primary.id === floor.id) return floor;
  return {
    ...floor,
    calibration: floor.calibration ?? cloneCalibration(primary.calibration),
    basemap: floor.basemap ?? cloneBasemap(primary.basemap),
  };
}

export function calibrationFromPrimary(
  primary: Calibration | null | undefined,
  widthPx: number,
  heightPx: number,
): Calibration {
  if (!primary) {
    return {
      originX: 0,
      originY: 0,
      metersPerPixel: 0.1,
      rotationDeg: 0,
      widthPx,
      heightPx,
    };
  }
  return { ...primary, widthPx, heightPx };
}

function cloneCalibration(cal: Calibration | null): Calibration | null {
  return cal ? { ...cal } : null;
}

function cloneBasemap(bm: FloorBasemap | null): FloorBasemap | null {
  return bm ? { ...bm } : null;
}
