"use client";
import { useState } from "react";
import { Type } from "lucide-react";

export type UnitSystem = "metric" | "imperial" | "mixed";

interface UnitsToggleProps {
  onUnitsChange: (units: UnitSystem) => void;
  currentUnits: UnitSystem;
}

export default function UnitsToggle({ onUnitsChange, currentUnits }: UnitsToggleProps) {
  const units = [
    { id: "metric" as UnitSystem, label: "Metric", subtext: "m / km" },
    { id: "imperial" as UnitSystem, label: "Imperial", subtext: "ft / mi" },
    { id: "mixed" as UnitSystem, label: "Mixed", subtext: "m / ft" },
  ];

  return (
    <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-2 shadow-lg">
      <Type size={14} className="text-[var(--muted)] ml-2" />
      <div className="flex gap-1">
        {units.map((unit) => (
          <button
            key={unit.id}
            onClick={() => onUnitsChange(unit.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentUnits === unit.id
                ? "bg-[var(--accent-cyan)] text-[#0a0e1a]"
                : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
            }`}
            title={unit.subtext}
          >
            {unit.label}
          </button>
        ))}
      </div>
    </div>
  );
}
