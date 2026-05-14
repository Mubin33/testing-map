"use client";
import type { Equipment } from "@/types";

interface Props {
  equipment: Equipment;
  isSelected: boolean;
  onSelect: (eq: Equipment) => void;
  onRemove?: (id: string) => void;
}

export default function EquipmentCard({ equipment, isSelected, onSelect, onRemove }: Props) {
  return (
    <div
      className={`
        relative group flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer
        transition-all duration-150 select-none
        ${isSelected
          ? "border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.08)] glow-cyan"
          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-bright)] hover:bg-[var(--surface-3)]"
        }
      `}
      onClick={() => onSelect(equipment)}
    >
      {/* Color strip */}
      <div
        className="w-1 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: equipment.color }}
      />

      {/* Icon */}
      {equipment.imageSrc ? (
        <img
          src={equipment.imageSrc}
          alt={equipment.name}
          draggable={false}
          className="h-8 w-8 flex-shrink-0 object-contain"
        />
      ) : (
        <span className="text-xl flex-shrink-0">{equipment.emoji}</span>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate leading-tight"
           style={{ fontFamily: "var(--font-exo)" }}>
          {equipment.name}
        </p>
        <p className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
          {equipment.lengthM}m × {equipment.widthM}m
        </p>
      </div>

      {/* Area */}
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-[var(--muted)] font-mono">
          {(equipment.lengthM * equipment.widthM).toFixed(1)} m²
        </p>
      </div>

      {/* Remove btn (custom only) */}
      {onRemove && (
        <button
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--surface-3)] text-[var(--muted)]
                     hover:text-[var(--accent-red)] hover:bg-[rgba(239,68,68,0.1)] text-[10px] leading-none
                     opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onRemove(equipment.id); }}
        >
          ×
        </button>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute right-2 bottom-1 text-[10px] text-[var(--accent-cyan)] font-mono">
          SELECTED
        </div>
      )}
    </div>
  );
}
