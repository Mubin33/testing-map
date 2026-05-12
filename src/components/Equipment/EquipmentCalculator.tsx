"use client";
import { useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Calculator, RotateCcw, Maximize2, ZapOff } from "lucide-react";
import type { Equipment, FitResult, SelectedArea } from "@/types";
import { calculateFit, generateGridPreview } from "@/utils/geometryUtils";
import { formatArea } from "@/utils/geoUtils";

interface Props {
  selectedArea: SelectedArea | null;
  selectedEquipment: Equipment | null;
  onEquipmentDrop: (eq: Equipment) => void;
}

export default function EquipmentCalculator({ selectedArea, selectedEquipment, onEquipmentDrop }: Props) {
  const [spacingM, setSpacingM] = useState(0.5);
  const [unit, setUnit] = useState<"m" | "ft">("m");
  const [result, setResult] = useState<FitResult | null>(null);
  const [manualArea, setManualArea] = useState({ w: "", h: "" });
  const [useManual, setUseManual] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: "calculator-drop" });

  // Recompute when inputs change
  useEffect(() => {
    const equipment = selectedEquipment;
    if (!equipment) { setResult(null); return; }

    let area: SelectedArea | null = selectedArea;

    if (useManual) {
      const w = parseFloat(manualArea.w);
      const h = parseFloat(manualArea.h);
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) { setResult(null); return; }
      area = {
        type: "manual",
        areaM2: w * h,
        widthM: Math.max(w, h),
        heightM: Math.min(w, h),
        label: `${w}m × ${h}m (manual)`,
      };
    }

    if (!area) { setResult(null); return; }
    setResult(calculateFit(equipment, area, spacingM));
  }, [selectedEquipment, selectedArea, spacingM, useManual, manualArea]);

  const convert = (m: number) => unit === "ft" ? m * 3.28084 : m;
  const unitLabel = unit === "ft" ? "ft" : "m";

  const effectiveArea: SelectedArea | null = useManual
    ? (() => {
        const w = parseFloat(manualArea.w);
        const h = parseFloat(manualArea.h);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
        return { type: "manual" as const, areaM2: w * h, widthM: Math.max(w, h), heightM: Math.min(w, h), label: "" };
      })()
    : selectedArea;

  const gridPreview = result ? generateGridPreview(result.cols, result.rows) : null;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-[var(--accent-amber)]" />
          <span className="text-sm font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-exo)" }}>
            Fit Calculator
          </span>
        </div>
        <button onClick={() => setUnit(u => u === "m" ? "ft" : "m")}
          className="text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-bright)] transition-all">
          {unit === "m" ? "→ ft" : "→ m"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* DROP ZONE */}
        <div
          ref={setNodeRef}
          className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 text-center
            ${isOver
              ? "border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.08)] scale-[1.01]"
              : selectedEquipment
                ? "border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.04)]"
                : "border-[var(--border)] hover:border-[var(--border-bright)]"
            }`}
        >
          {selectedEquipment ? (
            <div className="flex items-center gap-3">
              <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEquipment.color }} />
              {selectedEquipment.imageSrc && (
                <img
                  src={selectedEquipment.imageSrc}
                  alt={selectedEquipment.name}
                  draggable={false}
                  className="h-10 w-10 flex-shrink-0 object-contain"
                />
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-exo)" }}>
                  {!selectedEquipment.imageSrc && `${selectedEquipment.emoji} `}{selectedEquipment.name}
                </p>
                <p className="text-xs font-mono text-[var(--muted)]">
                  {convert(selectedEquipment.lengthM).toFixed(2)} × {convert(selectedEquipment.widthM).toFixed(2)} {unitLabel}
                  {" "}· {convert(selectedEquipment.lengthM * selectedEquipment.widthM).toFixed(1)} {unitLabel}²
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <p className="text-sm text-[var(--muted)]">Drop equipment here</p>
              <p className="text-[11px] text-[var(--muted)] mt-1">or click an item in the list</p>
            </div>
          )}
          {isOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[rgba(6,182,212,0.1)]">
              <p className="text-sm text-[var(--accent-cyan)] font-semibold" style={{ fontFamily: "var(--font-exo)" }}>
                Release to select
              </p>
            </div>
          )}
        </div>

        {/* AREA SOURCE */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[11px] text-[var(--muted)] uppercase tracking-wide">Area Source</label>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <button
              onClick={() => setUseManual(p => !p)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all
                ${useManual ? "border-[var(--accent-amber)] text-[var(--accent-amber)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-bright)]"}`}
            >
              {useManual ? "Map Area" : "Manual"}
            </button>
          </div>

          {useManual ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[var(--muted)] font-mono block mb-1">Width (m)</label>
                <input type="number" min="0.1" step="0.5" placeholder="e.g. 50"
                  value={manualArea.w}
                  onChange={(e) => setManualArea(p => ({ ...p, w: e.target.value }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-amber)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[var(--muted)] font-mono block mb-1">Height (m)</label>
                <input type="number" min="0.1" step="0.5" placeholder="e.g. 30"
                  value={manualArea.h}
                  onChange={(e) => setManualArea(p => ({ ...p, h: e.target.value }))}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-amber)]"
                />
              </div>
            </div>
          ) : (
            <div className={`rounded-lg border px-3 py-2 ${effectiveArea ? "border-[var(--accent-amber)] bg-[rgba(245,158,11,0.06)]" : "border-[var(--border)]"}`}>
              {effectiveArea ? (
                <div>
                  <p className="text-xs text-[var(--accent-amber)] font-mono">
                    {convert(effectiveArea.widthM).toFixed(1)} × {convert(effectiveArea.heightM).toFixed(1)} {unitLabel}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
                    Total: {formatArea(effectiveArea.areaM2)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Draw a rectangle on the map using <span className="text-[var(--accent-amber)]">Area</span> tool
                </p>
              )}
            </div>
          )}
        </div>

        {/* SPACING */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-[var(--muted)] uppercase tracking-wide">Spacing / Gap</label>
            <span className="text-xs font-mono text-[var(--accent-amber)]">{spacingM} m</span>
          </div>
          <input type="range" min="0" max="5" step="0.1" value={spacingM}
            onChange={(e) => setSpacingM(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent-amber)]"
          />
          <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono mt-1">
            <span>0 m</span><span>2.5 m</span><span>5 m</span>
          </div>
        </div>

        {/* RESULT */}
        {result && result.total > 0 ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Fit" value={result.total.toString()} accent="amber" large />
              <StatBox label="Efficiency" value={`${result.efficiency.toFixed(1)}%`} accent="cyan" large />
              <StatBox label="Columns" value={result.cols.toString()} />
              <StatBox label="Rows" value={result.rows.toString()} />
              <StatBox label="Covered" value={formatArea(result.coveredM2)} />
              <StatBox label="Orientation" value={result.orientationUsed === "rotated" ? "90° Rotated" : "Original"} />
            </div>

            {/* Visual Grid */}
            {gridPreview && gridPreview.displayCols > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Maximize2 size={11} className="text-[var(--muted)]" />
                  <span className="text-[11px] text-[var(--muted)] uppercase tracking-wide">
                    Layout Preview
                    {gridPreview.scale < 1 && (
                      <span className="text-[10px] ml-1 normal-case">(scaled)</span>
                    )}
                  </span>
                </div>
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 overflow-auto max-h-40">
                  <div
                    className="grid gap-px"
                    style={{
                      gridTemplateColumns: `repeat(${gridPreview.displayCols}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: gridPreview.displayCols * gridPreview.displayRows }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-sm aspect-[1.5] min-w-[8px] min-h-[5px]"
                        style={{ backgroundColor: selectedEquipment?.color ?? "var(--accent-cyan)", opacity: 0.7 }}
                      />
                    ))}
                  </div>
                </div>
                {gridPreview.scale < 1 && (
                  <p className="text-[10px] text-[var(--muted)] mt-1 font-mono text-center">
                    Showing {gridPreview.displayCols}×{gridPreview.displayRows} of {result.cols}×{result.rows}
                  </p>
                )}
              </div>
            )}
          </>
        ) : result && result.total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ZapOff size={28} className="text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)]">Equipment is larger than the area</p>
            <p className="text-[11px] text-[var(--muted)]">Try reducing spacing or selecting a larger area</p>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-xs text-[var(--muted)]">Select equipment and an area to calculate</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, large }: { label: string; value: string; accent?: "amber" | "cyan"; large?: boolean }) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2">
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1">{label}</p>
      <p
        className={`font-mono font-semibold ${large ? "text-xl" : "text-sm"} ${
          accent === "amber" ? "text-[var(--accent-amber)]" : accent === "cyan" ? "text-[var(--accent-cyan)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
