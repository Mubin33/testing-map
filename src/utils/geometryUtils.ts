import type { Equipment, FitResult, SelectedArea } from "@/types";

interface FitParams {
  areaWidth: number;   // metres
  areaHeight: number;  // metres
  equipLength: number; // metres (longer dimension)
  equipWidth: number;  // metres (shorter dimension)
  spacing: number;     // metres gap between units
}

function fitCount({ areaWidth, areaHeight, equipLength, equipWidth, spacing }: FitParams) {
  const cols = Math.floor(areaWidth / (equipLength + spacing));
  const rows = Math.floor(areaHeight / (equipWidth + spacing));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

/**
 * Calculate how many equipment units fit in the selected area,
 * trying both orientations and returning the best result.
 */
export function calculateFit(
  equipment: Equipment,
  area: SelectedArea,
  spacingM: number
): FitResult {
  const W = area.widthM;
  const H = area.heightM;

  const eL = equipment.lengthM;
  const eW = equipment.widthM;

  // Orientation A: length along width axis
  const a = fitCount({ areaWidth: W, areaHeight: H, equipLength: eL, equipWidth: eW, spacing: spacingM });
  const totalA = a.cols * a.rows;

  // Orientation B: rotated 90°
  const b = fitCount({ areaWidth: W, areaHeight: H, equipLength: eW, equipWidth: eL, spacing: spacingM });
  const totalB = b.cols * b.rows;

  const useRotated = totalB > totalA;
  const best = useRotated ? b : a;
  const total = useRotated ? totalB : totalA;

  const coveredM2 = total * eL * eW;
  const efficiency = area.areaM2 > 0 ? (coveredM2 / area.areaM2) * 100 : 0;

  return {
    equipment,
    area,
    spacingM,
    cols: best.cols,
    rows: best.rows,
    total,
    coveredM2,
    efficiency: Math.min(100, efficiency),
    orientationUsed: total === 0 ? "original" : useRotated ? "rotated" : "original",
  };
}

/**
 * Generate a visual grid layout string for display.
 * Returns grid of rows × cols capped at a visual size.
 */
export function generateGridPreview(
  cols: number,
  rows: number,
  maxCells = 200
): { displayCols: number; displayRows: number; scale: number } {
  const total = cols * rows;
  if (total === 0) return { displayCols: 0, displayRows: 0, scale: 1 };
  if (total <= maxCells) return { displayCols: cols, displayRows: rows, scale: 1 };

  const ratio = maxCells / total;
  const scale = Math.sqrt(ratio);
  return {
    displayCols: Math.max(1, Math.round(cols * scale)),
    displayRows: Math.max(1, Math.round(rows * scale)),
    scale,
  };
}
