// ─── Tool Modes ────────────────────────────────────────────────────────────
export type ActiveTool = "pan" | "measure" | "area" | "equipment";

// ─── Map View ──────────────────────────────────────────────────────────────
export interface MapView {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
}

// ─── Measure ───────────────────────────────────────────────────────────────
export interface MeasurePoint {
  id: string;
  lat: number;
  lng: number;
}

export interface MeasureSegment {
  from: MeasurePoint;
  to: MeasurePoint;
  distanceM: number;
}

// ─── Area ──────────────────────────────────────────────────────────────────
export interface SelectedArea {
  type: "rectangle" | "polygon" | "manual";
  areaM2: number;
  widthM: number;   // longer side
  heightM: number;  // shorter side
  label: string;
  path?: MeasurePoint[];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center?: {
    lat: number;
    lng: number;
  };
}

// ─── Equipment ─────────────────────────────────────────────────────────────
export interface Equipment {
  id: string;
  name: string;
  emoji: string;
  imageSrc?: string;
  lengthM: number;
  widthM: number;
  color: string;
  category: EquipmentCategory;
}

export interface PlacedEquipment {
  id: string;
  equipment: Equipment;
  lat: number;
  lng: number;
  rotationDeg: number;
}

export interface EquipmentDropRequest {
  equipment: Equipment;
  clientX: number;
  clientY: number;
}

export type EquipmentCategory =
  | "container"
  | "vehicle"
  | "structure"
  | "storage"
  | "custom";

// ─── Calculation Result ────────────────────────────────────────────────────
export interface FitResult {
  equipment: Equipment;
  area: SelectedArea;
  spacingM: number;
  cols: number;
  rows: number;
  total: number;
  coveredM2: number;
  efficiency: number;       // 0–100 %
  orientationUsed: "original" | "rotated" | "best";
}
