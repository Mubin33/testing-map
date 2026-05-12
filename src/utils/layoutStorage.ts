import type { ActiveTool, Equipment, MapView, MeasurePoint, PlacedEquipment, SelectedArea } from "@/types";

export type UnitSystem = "metric" | "imperial" | "mixed";

export interface SavedLayoutState {
  version: 1;
  id: string;
  name: string;
  savedAt: string;
  activeTool: ActiveTool;
  mapView: MapView;
  unitSystem: UnitSystem;
  measurePoints: MeasurePoint[];
  measureComplete: boolean;
  selectedArea: SelectedArea | null;
  placedEquipment: PlacedEquipment[];
  equipmentCatalog: Equipment[];
  selectedEquipmentId: string | null;
}

export interface SavedLayoutSummary {
  id: string;
  name: string;
  savedAt: string;
}

const LAYOUTS_KEY = "geoplanner_saved_layouts";
const ACTIVE_LAYOUT_KEY = "geoplanner_active_layout_id";

export const DEFAULT_MAP_VIEW: MapView = {
  center: { lat: 23.8103, lng: 90.4125 },
  zoom: 13,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readLayouts(): SavedLayoutState[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(LAYOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLayoutState[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.name) : [];
  } catch {
    return [];
  }
}

function writeLayouts(layouts: SavedLayoutState[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
}

export function loadSavedLayouts(): SavedLayoutSummary[] {
  return readLayouts().map(({ id, name, savedAt }) => ({ id, name, savedAt }));
}

export function loadSavedLayout(id: string): SavedLayoutState | null {
  return readLayouts().find((layout) => layout.id === id) ?? null;
}

export function saveLayout(layout: Omit<SavedLayoutState, "version" | "savedAt" | "id"> & { id?: string; savedAt?: string }) {
  const current = readLayouts();
  const next: SavedLayoutState = {
    version: 1,
    id: layout.id ?? `layout-${Date.now()}`,
    name: layout.name.trim() || "Untitled layout",
    savedAt: layout.savedAt ?? new Date().toISOString(),
    activeTool: layout.activeTool,
    mapView: layout.mapView,
    unitSystem: layout.unitSystem,
    measurePoints: layout.measurePoints,
    measureComplete: layout.measureComplete,
    selectedArea: layout.selectedArea,
    placedEquipment: layout.placedEquipment,
    equipmentCatalog: layout.equipmentCatalog,
    selectedEquipmentId: layout.selectedEquipmentId,
  };

  const filtered = current.filter((item) => item.id !== next.id);
  writeLayouts([next, ...filtered]);
  if (isBrowser()) {
    window.localStorage.setItem(ACTIVE_LAYOUT_KEY, next.id);
  }
  return next;
}

export function deleteLayout(id: string) {
  const current = readLayouts();
  const next = current.filter((item) => item.id !== id);
  writeLayouts(next);
  if (isBrowser()) {
    const activeId = window.localStorage.getItem(ACTIVE_LAYOUT_KEY);
    if (activeId === id) {
      window.localStorage.removeItem(ACTIVE_LAYOUT_KEY);
    }
  }
  return next.map(({ id: layoutId, name, savedAt }) => ({ id: layoutId, name, savedAt }));
}

export function getActiveLayoutId() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_LAYOUT_KEY);
}

export function setActiveLayoutId(id: string | null) {
  if (!isBrowser()) return;
  if (id) {
    window.localStorage.setItem(ACTIVE_LAYOUT_KEY, id);
  } else {
    window.localStorage.removeItem(ACTIVE_LAYOUT_KEY);
  }
}
