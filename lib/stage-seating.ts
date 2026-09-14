import type { ExhibitKit, ExhibitKitKind } from "./types";

export const SEAT_ROW_PITCH = 1.05;
export const SEAT_COL_PITCH = 0.62;
export const SEAT_AISLE_X = 1.2;

export function isMainStageKind(kind: ExhibitKitKind | null | undefined): boolean {
  return kind !== "secondary_stage";
}

export function stageSeatPlan(
  kind: ExhibitKitKind | null | undefined,
  widthM: number,
  depthM: number,
): {
  seatW: number;
  seatDepth: number;
  banks: 2 | 4;
  platformW: number;
  platformD: number;
  wallW: number;
  aisle: number;
  rugD: number;
  rugW: number;
} {
  const isMain = isMainStageKind(kind);
  const platformW = isMain ? widthM : widthM * 0.62;
  const platformD = isMain
    ? Math.max(6.2, Math.min(8.0, depthM * 0.36))
    : Math.max(2.4, Math.min(4.4, depthM * 0.36));
  const aisle = isMain ? 2.6 : 1.3;
  const rugD = Math.max(2.8, depthM - platformD);
  const seatW = isMain ? widthM * 1.45 : widthM * 0.96;
  const rugW = Math.max(seatW + 0.9, platformW);
  const seatDepth = Math.max(2.2, rugD - aisle - 0.35);
  return {
    seatW,
    seatDepth,
    banks: isMain ? 4 : 2,
    platformW,
    platformD,
    wallW: platformW,
    aisle,
    rugD,
    rugW,
  };
}

export function stageKitBreakdown(kit: Pick<ExhibitKit, "kind" | "widthM" | "depthM" | "wallHeightM" | "platformHeightM">) {
  const plan = stageSeatPlan(kit.kind, kit.widthM, kit.depthM);
  const platformH = kit.platformHeightM ?? 0.9;
  return {
    totalW: Math.max(kit.widthM, plan.seatW, plan.rugW, plan.platformW),
    totalD: kit.depthM,
    totalH: platformH + kit.wallHeightM,
    platformW: plan.platformW,
    platformD: plan.platformD,
    platformH,
    wallW: plan.wallW,
    wallH: kit.wallHeightM,
    seats: countBankSeats(plan.seatW, plan.seatDepth, plan.banks),
  };
}

export function countBankSeats(width: number, depth: number, banks: 1 | 2 | 4): number {
  if (banks === 1) {
    const cols = Math.max(2, Math.floor(width / SEAT_COL_PITCH));
    const rows = Math.max(2, Math.min(18, Math.floor(depth / SEAT_ROW_PITCH)));
    return cols * rows;
  }
  const count = banks;
  const gaps = (count - 1) * SEAT_AISLE_X;
  const colBudget = Math.max(
    count * 2,
    Math.floor((Math.max(width, gaps + SEAT_COL_PITCH * count * 2) - gaps) / SEAT_COL_PITCH),
  );
  const baseCols = Math.max(2, Math.floor(colBudget / count));
  const extra = colBudget - baseCols * count;
  const cols = count * baseCols + extra;
  const rows = Math.max(2, Math.min(14, Math.floor(depth / SEAT_ROW_PITCH)));
  return cols * rows;
}

export function kitSeatCount(kit: Pick<ExhibitKit, "kind" | "widthM" | "depthM">): number | null {
  if (kit.kind !== "main_stage" && kit.kind !== "secondary_stage") return null;
  const plan = stageSeatPlan(kit.kind, kit.widthM, kit.depthM);
  return countBankSeats(plan.seatW, plan.seatDepth, plan.banks);
}
