"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  children: React.ReactNode;
  side?: "left" | "right";
  width?: number;
}

export default function Sidebar({ children, side = "left", width = 280 }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="relative flex-shrink-0 h-full flex flex-col bg-[var(--surface-1)] border-r border-[var(--border)] transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? "0px" : `${width}px`, minWidth: collapsed ? "0" : undefined }}
    >
      {!collapsed && (
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className={`absolute top-1/2 -translate-y-1/2 z-30 w-5 h-10 flex items-center justify-center
          bg-[var(--surface-2)] border border-[var(--border)] rounded-r-lg
          text-[var(--muted)] hover:text-[var(--text)] transition-colors shadow-md
          ${side === "left" ? "-right-5" : "-left-5"}`}
      >
        {side === "left"
          ? collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />
          : collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </div>
  );
}
