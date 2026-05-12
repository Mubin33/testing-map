"use client";
import { Download, Share2 } from "lucide-react";
import type { MeasurePoint, SelectedArea } from "@/types";
import { formatDistance, formatArea } from "@/utils/geoUtils";

interface ExportMeasurementsProps {
  measurePoints: MeasurePoint[];
  selectedArea: SelectedArea | null;
  totalDistance: number;
}

export default function ExportMeasurements({
  measurePoints,
  selectedArea,
  totalDistance,
}: ExportMeasurementsProps) {
  const handleExportJSON = () => {
    const data = {
      timestamp: new Date().toISOString(),
      measurePoints: measurePoints.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
      selectedArea,
      totalDistance,
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geoplacer-measurement-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    let csv = "Type,Value,Details\n";
    csv += `Total Distance,${totalDistance.toFixed(2)} m,${formatDistance(totalDistance)}\n`;

    if (selectedArea) {
      csv += `Polygon Area,${selectedArea.areaM2.toFixed(2)} m2,${formatArea(selectedArea.areaM2)}\n`;
      csv += `Width,${selectedArea.widthM.toFixed(2)} m,\n`;
      csv += `Height,${selectedArea.heightM.toFixed(2)} m,\n`;
    }

    csv += `\nMeasure Points (${measurePoints.length} points)\n`;
    csv += "Index,Latitude,Longitude\n";
    measurePoints.forEach((p, i) => {
      csv += `${i + 1},${p.lat},${p.lng}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geoplacer-measurement-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const data = {
      timestamp: new Date().toISOString(),
      measurePoints: measurePoints.map((p) => ({ lat: p.lat, lng: p.lng })),
      selectedArea,
      totalDistance: formatDistance(totalDistance),
    };

    const text = `GeoPlanner Measurement: ${formatDistance(totalDistance)}${
      selectedArea ? ` | Area: ${formatArea(selectedArea.areaM2)}` : ""
    }`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "GeoPlanner Measurement",
          text,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") console.error(err);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      alert("Measurement copied to clipboard!");
    }
  };

  const hasData = measurePoints.length > 0 || selectedArea;

  if (!hasData) return null;

  return (
    <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg p-1">
      <button
        onClick={handleExportJSON}
        className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
        title="Export as JSON"
      >
        <Download size={16} />
      </button>
      <button
        onClick={handleExportCSV}
        className="px-3 py-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text)] text-xs font-mono font-medium transition-colors"
        title="Export as CSV"
      >
        CSV
      </button>
      <button
        onClick={handleShare}
        className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--accent-amber)] hover:text-[var(--accent-amber)] transition-colors"
        title="Share measurement"
      >
        <Share2 size={16} />
      </button>
    </div>
  );
}
