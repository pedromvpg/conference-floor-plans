"use client";

import * as THREE from "three";
import { getConsoleFunction, setConsoleFunction } from "three";

const prevThreeConsole = getConsoleFunction();
setConsoleFunction((type, message, ...rest) => {
  if (
    type === "warn" &&
    typeof message === "string" &&
    message.includes("THREE.Clock:") &&
    message.includes("Timer")
  ) {
    return;
  }
  if (prevThreeConsole) {
    prevThreeConsole(type, message, ...rest);
    return;
  }
  const log = console[type] ?? console.warn;
  log(message, ...rest);
});

/** Clock-shaped wrapper around THREE.Timer for R3F (`new THREE.Clock()`). */
class TimerClock {
  autoStart: boolean;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  running = false;
  private timer = new THREE.Timer();

  constructor(autoStart = true) {
    this.autoStart = autoStart;
  }

  start() {
    this.timer.dispose();
    this.timer = new THREE.Timer();
    this.timer.update();
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (!this.running) return 0;
    this.timer.update();
    const diff = this.timer.getDelta();
    this.oldTime = performance.now();
    this.elapsedTime = this.timer.getElapsed();
    return diff;
  }
}

try {
  Object.defineProperty(THREE, "Clock", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: TimerClock,
  });
} catch {
  /* Namespace export is a getter; R3F still constructs the original Clock class. */
}
