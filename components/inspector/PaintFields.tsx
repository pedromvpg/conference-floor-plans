"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sliderRangeStyle } from "@/lib/hall-view";
import { paintIsNone, paintToHex, type ShapePaint } from "@/lib/paint";

export function PaintFields({
  value,
  fillFallback = "#0a0a0a",
  strokeFallback = "#0a0a0a",
  defaultStrokeWidth = 1,
  strokeStep = 0.5,
  showOpacity = true,
  showChannels = true,
  onChange,
}: {
  value: ShapePaint;
  fillFallback?: string;
  strokeFallback?: string;
  defaultStrokeWidth?: number;
  strokeStep?: number;
  showOpacity?: boolean;
  showChannels?: boolean;
  onChange: (next: ShapePaint) => void;
}) {
  const fillNone = paintIsNone(value.fill);
  const strokeNone = paintIsNone(value.stroke) || value.strokeWidth <= 0;
  const fillHex = paintToHex(value.fill, fillFallback);
  const strokeHex = paintToHex(value.stroke, strokeFallback);

  return (
    <div className="space-y-2">
      {showChannels ? (
        <>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="w-12 shrink-0 text-[10px] font-normal text-muted-foreground">Fill</Label>
          <input
            type="color"
            aria-label="Fill color"
            value={fillHex}
            onChange={(e) => onChange({ ...value, fill: e.target.value })}
            className="size-8 shrink-0 cursor-pointer border border-input bg-background p-0.5"
          />
          <Button
            size="sm"
            variant={fillNone ? "secondary" : "outline"}
            onClick={() => onChange({ ...value, fill: "none" })}
          >
            None
          </Button>
          {value.fill != null && value.fill !== fillFallback ? (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, fill: null })}>
              Reset
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 pl-14">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Fill opacity"
            disabled={fillNone}
            value={value.fillOpacity}
            style={sliderRangeStyle(0, 1, value.fillOpacity) as CSSProperties}
            onChange={(e) => onChange({ ...value, fillOpacity: Number(e.target.value) })}
            className="chrome-slider w-full disabled:opacity-40"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
            {Math.round(value.fillOpacity * 100)}%
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="w-12 shrink-0 text-[10px] font-normal text-muted-foreground">Stroke</Label>
          <input
            type="color"
            aria-label="Stroke color"
            value={strokeHex}
            onChange={(e) =>
              onChange({
                ...value,
                stroke: e.target.value,
                strokeWidth: value.strokeWidth > 0 ? value.strokeWidth : defaultStrokeWidth,
              })
            }
            className="size-8 shrink-0 cursor-pointer border border-input bg-background p-0.5"
          />
          <Button
            size="sm"
            variant={strokeNone ? "secondary" : "outline"}
            onClick={() => onChange({ ...value, stroke: "none", strokeWidth: 0 })}
          >
            None
          </Button>
        </div>
        <div className="flex items-center gap-2 pl-14">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Stroke opacity"
            disabled={strokeNone}
            value={value.strokeOpacity}
            style={sliderRangeStyle(0, 1, value.strokeOpacity) as CSSProperties}
            onChange={(e) => onChange({ ...value, strokeOpacity: Number(e.target.value) })}
            className="chrome-slider w-full disabled:opacity-40"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
            {Math.round(value.strokeOpacity * 100)}%
          </span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Stroke width</Label>
        <Input
          type="number"
          min="0"
          step={strokeStep}
          value={value.strokeWidth}
          disabled={paintIsNone(value.stroke)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n) || n < 0) return;
            onChange({
              ...value,
              strokeWidth: n,
              stroke: n <= 0 ? "none" : paintIsNone(value.stroke) ? strokeFallback : value.stroke,
            });
          }}
        />
      </div>
        </>
      ) : null}
      {showOpacity ? (
        <div>
          <Label className="text-[10px] text-muted-foreground">Opacity</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              aria-label="Opacity"
              value={value.opacity}
              style={sliderRangeStyle(0, 1, value.opacity) as CSSProperties}
              onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
              className="chrome-slider w-full"
            />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              {Math.round(value.opacity * 100)}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
