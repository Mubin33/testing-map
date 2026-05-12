"use client";
import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export default function HelpPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: "P", action: "Switch to Pan tool" },
    { key: "M", action: "Switch to Measure tool" },
    { key: "A", action: "Switch to Area tool" },
    { key: "U", action: "Undo last measurement point" },
    { key: "Esc", action: "Cancel current action" },
  ];

  const features = [
    { title: "Measure Distances", desc: "Click points on the map to measure distances between locations" },
    { title: "Create Polygons", desc: "Place 3+ points and click the first point to close the polygon and calculate area" },
    { title: "Select Areas", desc: "Use the Area tool to draw rectangles and calculate their dimensions" },
    { title: "Search Locations", desc: "Use the search bar in the top-right to find and navigate to any location in Bangladesh" },
    { title: "Export Data", desc: "Export your measurements as JSON or CSV files for later use" },
    { title: "Unit Systems", desc: "Toggle between Metric, Imperial, or Mixed units for measurements" },
    { title: "Equipment Planning", desc: "Drag equipment from the sidebar to plan layouts in your selected area" },
    { title: "Equipment Tools", desc: "Rotate, duplicate, and delete equipment items on the map" },
  ];

  return (
    <>
      {/* Help button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)] text-[#0a0e1a] flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="Help & Shortcuts"
      >
        <HelpCircle size={20} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
              <h2 className="text-lg font-bold text-[var(--text)]">GeoPlanner Help & Shortcuts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Keyboard Shortcuts */}
              <section>
                <h3 className="text-sm font-semibold text-[var(--accent-cyan)] uppercase tracking-wider mb-3">
                  Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center gap-3 p-2 bg-[var(--surface-2)] rounded-lg"
                    >
                      <kbd className="px-2 py-1 bg-[var(--accent-amber)] text-[#0a0e1a] rounded font-mono text-xs font-bold">
                        {shortcut.key}
                      </kbd>
                      <span className="text-sm text-[var(--text)]">{shortcut.action}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Features */}
              <section>
                <h3 className="text-sm font-semibold text-[var(--accent-green)] uppercase tracking-wider mb-3">
                  Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {features.map((feature, idx) => (
                    <div key={idx} className="p-3 bg-[var(--surface-2)] rounded-lg">
                      <p className="font-medium text-[var(--text)] text-sm mb-1">{feature.title}</p>
                      <p className="text-xs text-[var(--muted)]">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="text-sm font-semibold text-[var(--accent-amber)] uppercase tracking-wider mb-3">
                  Pro Tips
                </h3>
                <ul className="space-y-2 text-sm text-[var(--muted)]">
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-cyan)] font-bold">•</span>
                    <span>Hover over equipment to see rotation, duplicate, and delete options</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-cyan)] font-bold">•</span>
                    <span>Your search history is saved locally for quick access</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-cyan)] font-bold">•</span>
                    <span>Toggle unit systems to view measurements in different formats</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-cyan)] font-bold">•</span>
                    <span>Measurements are automatically saved when you create polygons</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-cyan)] font-bold">•</span>
                    <span>Click on a measurement point marker to select it for editing</span>
                  </li>
                </ul>
              </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border)] flex-shrink-0 bg-[var(--surface-2)]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)] text-[#0a0e1a] rounded-lg font-medium transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
