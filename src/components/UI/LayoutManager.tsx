"use client";
import { Trash2, Download, Save } from "lucide-react";
import type { SavedLayoutSummary } from "@/utils/layoutStorage";

interface Props {
  layouts: SavedLayoutSummary[];
  selectedLayoutId: string;
  onSelectLayout: (id: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onDelete: () => void;
}

function formatSavedAt(savedAt: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(savedAt));
  } catch {
    return savedAt;
  }
}

export default function LayoutManager({ layouts, selectedLayoutId, onSelectLayout, onSave, onLoad, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 shadow-sm">
      <span className="hidden md:inline text-[10px] uppercase tracking-wider text-[var(--muted)] pl-1 pr-1.5">
        Layouts
      </span>
      <select
        value={selectedLayoutId}
        onChange={(e) => onSelectLayout(e.target.value)}
        className="min-w-44 max-w-56 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text)] outline-none"
      >
        <option value="">Select saved layout</option>
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layout.name} • {formatSavedAt(layout.savedAt)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onLoad}
        disabled={!selectedLayoutId}
        className="inline-flex items-center gap-1 rounded-md border hover:border-[var(--border)] px-2.5 py-1 text-xs hover:text-[var(--muted)] transition-colors border-[var(--accent-cyan)] text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={12} />
        Load
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-cyan)] px-2.5 py-1 text-xs font-semibold text-[#0a0e1a] transition-colors hover:bg-cyan-400"
      >
        <Save size={12} />
        Save
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!selectedLayoutId}
        className="inline-flex items-center gap-1 rounded-md border hover:border-[var(--border)] px-2.5 py-1 text-xs hover:text-[var(--muted)] transition-colors border-[var(--accent-red)] text-[var(--accent-red)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}
