"use client";
import { useState } from "react";
import { Package, Plus, ChevronDown, ChevronRight } from "lucide-react";
import type { Equipment } from "@/types";
import EquipmentCard from "./EquipmentCard";

interface Props {
  categorized: Record<string, Equipment[]>;
  selected: Equipment | null;
  onSelect: (eq: Equipment) => void;
  onRemove: (id: string) => void;
  onAddCustom: (name: string, length: number, width: number, emoji: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  container: "📦 Containers",
  vehicle: "🚗 Vehicles",
  structure: "⛺ Structures",
  storage: "🗄️ Storage",
  custom: "📐 Custom",
};

const EMOJI_OPTIONS = ["📐", "🔲", "🔷", "⬛", "🟦", "🏗️", "🛢️", "📦", "🪨", "🧱"];

export default function EquipmentPanel({ categorized, selected, onSelect, onRemove, onAddCustom }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", length: "2", width: "1", emoji: "📐" });

  const toggleCollapse = (cat: string) =>
    setCollapsed((p) => ({ ...p, [cat]: !p[cat] }));

  const handleAdd = () => {
    const l = parseFloat(form.length);
    const w = parseFloat(form.width);
    if (!form.name.trim() || isNaN(l) || isNaN(w) || l <= 0 || w <= 0) return;
    onAddCustom(form.name.trim(), l, w, form.emoji);
    setForm({ name: "", length: "2", width: "1", emoji: "📐" });
    setShowAddForm(false);
  };

  const allCategories = Object.keys(CATEGORY_LABELS);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-[var(--accent-cyan)]" />
          <span className="text-sm font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-exo)" }}>
            Equipment
          </span>
        </div>
        <button
          onClick={() => setShowAddForm((p) => !p)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-all
            ${showAddForm
              ? "border-[var(--accent-amber)] text-[var(--accent-amber)] bg-[rgba(245,158,11,0.08)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-amber)] hover:text-[var(--accent-amber)]"
            }`}
        >
          <Plus size={11} />
          Custom
        </button>
      </div>

      {/* Add Custom Form */}
      {showAddForm && (
        <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-2)] animate-fade-in">
          <p className="text-[11px] text-[var(--muted)] mb-2 uppercase tracking-wide">New Equipment</p>

          {/* Emoji picker */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {EMOJI_OPTIONS.map((e) => (
              <button key={e}
                onClick={() => setForm((p) => ({ ...p, emoji: e }))}
                className={`w-7 h-7 rounded text-base transition-all ${form.emoji === e ? "bg-[var(--surface-3)] ring-1 ring-[var(--accent-cyan)]" : "hover:bg-[var(--surface-3)]"}`}
              >{e}</button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Equipment name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] placeholder-[var(--muted)] mb-2 focus:outline-none focus:border-[var(--accent-cyan)]"
          />
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-[10px] text-[var(--muted)] font-mono block mb-1">Length (m)</label>
              <input type="number" min="0.1" step="0.1" value={form.length}
                onChange={(e) => setForm((p) => ({ ...p, length: e.target.value }))}
                className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-cyan)]"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[var(--muted)] font-mono block mb-1">Width (m)</label>
              <input type="number" min="0.1" step="0.1" value={form.width}
                onChange={(e) => setForm((p) => ({ ...p, width: e.target.value }))}
                className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded px-2 py-1.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-cyan)]"
              />
            </div>
          </div>
          <button onClick={handleAdd}
            className="w-full bg-[var(--accent-cyan)] hover:bg-cyan-400 text-[#0a0e1a] font-semibold text-sm py-1.5 rounded transition-colors"
            style={{ fontFamily: "var(--font-exo)" }}
          >
            Add Equipment
          </button>
        </div>
      )}

      {/* Hint */}
      <div className="px-4 py-2 border-b border-[var(--border)]">
        <p className="text-[10px] text-[var(--muted)]">
          Click to select, then drag inside the map square to place a row
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {allCategories.map((cat) => {
          const items = categorized[cat] || [];
          if (items.length === 0) return null;
          const collapsed_ = collapsed[cat];
          return (
            <div key={cat}>
              <button
                onClick={() => toggleCollapse(cat)}
                className="flex items-center gap-1.5 w-full text-left py-1.5 text-[11px] text-[var(--muted)] uppercase tracking-wider hover:text-[var(--text)] transition-colors"
              >
                {collapsed_ ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                {CATEGORY_LABELS[cat]}
                <span className="ml-auto text-[10px] font-mono">{items.length}</span>
              </button>
              {!collapsed_ && (
                <div className="space-y-1 mb-2">
                  {items.map((eq) => (
                    <EquipmentCard
                      key={eq.id}
                      equipment={eq}
                      isSelected={selected?.id === eq.id}
                      onSelect={onSelect}
                      onRemove={eq.category === "custom" ? onRemove : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
