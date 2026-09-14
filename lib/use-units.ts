"use client";

import { useEffect, useState } from "react";
import type { Units } from "./types";

const KEY = "conference-floor-plans-units";

export function useUnits(): [Units, (units: Units) => void] {
  const [units, setUnitsState] = useState<Units>("m");

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "m" || stored === "ft") setUnitsState(stored);
  }, []);

  function setUnits(next: Units) {
    setUnitsState(next);
    localStorage.setItem(KEY, next);
  }

  return [units, setUnits];
}
