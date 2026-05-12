"use client";
import { Hand, Ruler, Square, Trash2, RotateCcw, Package } from "lucide-react";
import type { ActiveTool } from "@/types";

interface Props {
  activeTool: ActiveTool;
  onChange: (tool: ActiveTool) => void;
  onClearMeasure: () => void;
  onRemoveLastPoint?: () => void;
  onClearArea: () => void;
  totalDistance: number;
  pointCount: number;
}

const TOOLS = [
  { id: "pan" as ActiveTool, icon: Hand, label: "Pan / Navigate", shortcut: "P", color: "cyan" },
  { id: "measure" as ActiveTool, icon: Ruler, label: "Measure Distance", shortcut: "M", color: "amber" },
  { id: "area" as ActiveTool, icon: Square, label: "Select Area", shortcut: "A", color: "green" },
];

function fmt(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(3)} km`;
  return `${m.toFixed(1)} m`;
}

export default function Toolbar({ activeTool, onChange, onClearMeasure, onRemoveLastPoint, onClearArea, totalDistance, pointCount }: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
      {/* Tool buttons */}
      <div className="flex items-center gap-1 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl px-2 py-1.5 backdrop-blur-sm shadow-2xl">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          const colorMap: Record<string, string> = {
            cyan: "text-[var(--accent-cyan)] bg-[rgba(6,182,212,0.12)] border-[var(--accent-cyan)]",
            amber: "text-[var(--accent-amber)] bg-[rgba(245,158,11,0.12)] border-[var(--accent-amber)]",
            green: "text-[var(--accent-green)] bg-[rgba(16,185,129,0.12)] border-[var(--accent-green)]",
          };
          return (
            <button
              key={tool.id}
              onClick={() => onChange(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
              className={`tooltip flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150 font-medium
                ${active
                  ? colorMap[tool.color]
                  : "text-[var(--muted)] border-transparent hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                }`}
              data-tip={tool.label}
              style={{ fontFamily: "var(--font-exo)" }}
            >
              <Icon size={14} />
              <span className="hidden sm:block">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Measure stats */}
      {activeTool === "measure" && (
        <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--accent-amber)] rounded-xl px-3 py-1.5 shadow-2xl animate-fade-in glow-amber">
          <div>
            <p className="text-[10px] text-[var(--muted)] font-mono leading-none">TOTAL DISTANCE</p>
            <p className="text-base font-mono font-semibold text-[var(--accent-amber)] leading-tight">
              {totalDistance > 0 ? fmt(totalDistance) : "—"}
            </p>
          </div>
          <div className="w-px h-8 bg-[var(--border)]" />
          <div>
            <p className="text-[10px] text-[var(--muted)] font-mono leading-none">POINTS</p>
            <p className="text-base font-mono font-semibold text-[var(--text)] leading-tight">{pointCount}</p>
          </div>
          {pointCount > 0 && (
            <>
              <div className="w-px h-8 bg-[var(--border)]" />
              <button onClick={onRemoveLastPoint}
                className="text-[var(--muted)] hover:text-[var(--accent-amber)] transition-colors tooltip text-lg"
                data-tip="Undo last point (U)">
                ↶
              </button>
              <button onClick={onClearMeasure}
                className="text-[var(--muted)] hover:text-[var(--accent-red)] transition-colors tooltip"
                data-tip="Clear all points">
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Area clear */}
      {activeTool === "area" && (
        <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--accent-green)] rounded-xl px-3 py-1.5 shadow-2xl animate-fade-in glow-green">
          <p className="text-xs text-[var(--accent-green)] font-mono">Click & drag to draw rectangle</p>
          <button onClick={onClearArea}
            className="text-[var(--muted)] hover:text-[var(--accent-red)] transition-colors tooltip"
            data-tip="Clear area">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
