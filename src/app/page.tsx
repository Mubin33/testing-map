"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ActiveTool, Equipment, EquipmentDropRequest, PlacedEquipment, SelectedArea } from "@/types";
import { useMeasure } from "@/hooks/useMeasure";
import { useEquipment } from "@/hooks/useEquipment";
import MapContainer from "@/components/Map/MapContainer";
import Toolbar from "@/components/UI/Toolbar";
import Sidebar from "@/components/UI/Sidebar";
import EquipmentPanel from "@/components/Equipment/EquipmentPanel";
import EquipmentCalculator from "@/components/Equipment/EquipmentCalculator";
import UnitsToggle, { type UnitSystem } from "@/components/UI/UnitsToggle";
import ExportMeasurements from "@/components/UI/ExportMeasurements";
import HelpPanel from "@/components/UI/HelpPanel";
import LayoutManager from "@/components/UI/LayoutManager";
import type { MapView } from "@/types";
import {
  DEFAULT_MAP_VIEW,
  deleteLayout,
  getActiveLayoutId,
  loadSavedLayout,
  loadSavedLayouts,
  saveLayout,
  setActiveLayoutId,
  type SavedLayoutState,
} from "@/utils/layoutStorage";
import MapContainerLeaflet from "@/components/Map/MapContainerLeaflet";
import { isPointInPolygon } from "@/utils/geoUtils";

function pointInsideArea(point: { lat: number; lng: number }, area: SelectedArea) {
  if (area.type === "polygon" && area.path) {
    return isPointInPolygon(point, area.path);
  }
  if (!area.bounds) return false;
  return (
    point.lat <= area.bounds.north &&
    point.lat >= area.bounds.south &&
    point.lng <= area.bounds.east &&
    point.lng >= area.bounds.west
  );
}

export default function Home() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("pan");
  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const [areas, setAreas] = useState<SelectedArea[]>([]);
  const [draggingEquipment, setDraggingEquipment] = useState<Equipment | null>(null);
  const [pendingEquipmentDrop, setPendingEquipmentDrop] = useState<EquipmentDropRequest | null>(null);
  const [placedEquipment, setPlacedEquipment] = useState<PlacedEquipment[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [mapView, setMapView] = useState<MapView>(DEFAULT_MAP_VIEW);
  const [savedLayouts, setSavedLayouts] = useState(loadSavedLayouts());
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const moveFrameRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{ id: string; lat: number; lng: number } | null>(null);

  const { points, segments, totalM, isComplete, addPoint, closePolygon, removeLastPoint, clearPoints, hydrate: hydrateMeasure } = useMeasure();
  const {
    equipment,
    selected,
    categorized,
    select,
    remove,
    addCustom,
    hydrate: hydrateEquipment,
  } = useEquipment();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const applyLayout = useCallback((layout: SavedLayoutState) => {
    setActiveTool(layout.activeTool);
    setMapView(layout.mapView ?? DEFAULT_MAP_VIEW);
    setUnitSystem(layout.unitSystem);
    hydrateMeasure(layout.measurePoints, layout.measureComplete);
    setAreas(layout.areas ?? (layout.selectedArea?.source === "drawn" ? [layout.selectedArea] : []));
    setSelectedArea(layout.selectedArea ?? layout.areas?.[0] ?? null);
    setPlacedEquipment(layout.placedEquipment);
    hydrateEquipment(layout.equipmentCatalog, layout.selectedEquipmentId);
  }, [hydrateEquipment, hydrateMeasure]);

  useEffect(() => {
    const layouts = loadSavedLayouts();
    setSavedLayouts(layouts);
    const activeId = getActiveLayoutId();
    if (!activeId) return;
    const layout = loadSavedLayout(activeId);
    if (!layout) return;
    setSelectedLayoutId(layout.id);
    applyLayout(layout);
  }, [applyLayout]);

  const handleMapViewChange = useCallback((nextView: MapView) => {
    setMapView((prev) => {
      if (
        prev.center.lat === nextView.center.lat &&
        prev.center.lng === nextView.center.lng &&
        prev.zoom === nextView.zoom
      ) {
        return prev;
      }
      return nextView;
    });
  }, []);

  const handleAreaSelected = useCallback((nextArea: SelectedArea) => {
    // For measurement polygons, just select them
    if (nextArea.source === "measurement") {
      setSelectedArea(nextArea);
      return;
    }

    // For drawn rectangles, add/update in areas array
    const areaId = nextArea.id ?? `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const areaName = nextArea.name ?? `Shape ${areas.filter(a => a.source === "drawn").length + 1}`;
    const areaWithId: SelectedArea = { ...nextArea, id: areaId, name: areaName, source: "drawn" };

    setAreas((prev) => {
      const existingIndex = prev.findIndex((area) => area.id === areaId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = areaWithId;
        return updated;
      }
      return [...prev, areaWithId];
    });
    setSelectedArea(areaWithId);
  }, [areas]);

  const updateArea = useCallback((updatedArea: SelectedArea) => {
    setAreas((prev) => prev.map((area) => (area.id === updatedArea.id ? updatedArea : area)));
    setSelectedArea((prev) => (prev?.id === updatedArea.id ? updatedArea : prev));
  }, []);

  const renameArea = useCallback((areaId: string, name: string) => {
    setAreas((prev) => prev.map((area) => (area.id === areaId ? { ...area, name } : area)));
    setSelectedArea((prev) => (prev?.id === areaId ? { ...prev, name } : prev));
  }, []);

  const deleteArea = useCallback((areaId: string) => {
    const target = areas.find((area) => area.id === areaId);
    if (!target) return;

    setPlacedEquipment((prev) => prev.filter((item) => !pointInsideArea({ lat: item.lat, lng: item.lng }, target)));
    setAreas((prev) => prev.filter((area) => area.id !== areaId));
    setSelectedArea((prev) => (prev?.id === areaId ? null : prev));
  }, [areas]);

  const handleDragStart = (event: DragStartEvent) => {
    const equipment = event.active.data.current?.equipment as Equipment | undefined;
    if (equipment) setDraggingEquipment(equipment);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingEquipment(null);
    const equipment = event.active.data.current?.equipment as Equipment | undefined;
    if (!equipment) return;

    // Dropped in calculator zone
    if (event.over?.id === "calculator-drop") {
      select(equipment);
      return;
    }

    const activator = event.activatorEvent;
    if (activator instanceof PointerEvent || activator instanceof MouseEvent || activator instanceof TouchEvent) {
      const startPoint =
        "changedTouches" in activator
          ? activator.changedTouches[0]
          : activator;
      if (startPoint) {
        setPendingEquipmentDrop({
          equipment,
          clientX: startPoint.clientX + event.delta.x,
          clientY: startPoint.clientY + event.delta.y,
        });
      }
    }
  };

  const handleClearArea = useCallback(() => {
    setAreas([]);
    setSelectedArea(null);
  }, []);

  const handleMeasureMapClick = useCallback(
    (lat: number, lng: number) => {
      // Clear measurement selectedArea before adding new point
      if (selectedArea?.source === "measurement") {
        setSelectedArea(null);
      }
      addPoint(lat, lng);
    },
    [addPoint, selectedArea]
  );

  const handleClearMeasure = useCallback(() => {
    clearPoints();
    // Always clear measurement-based selectedArea when clearing measure points
    if (selectedArea?.source === "measurement" || selectedArea?.type === "polygon") {
      setSelectedArea(null);
    }
  }, [clearPoints, selectedArea]);

  const handleUndoMeasurePoint = useCallback(() => {
    removeLastPoint();
    // Clear selectedArea if it's measurement-based since we're modifying the measurement
    if (selectedArea?.source === "measurement" || selectedArea?.type === "polygon") {
      setSelectedArea(null);
    }
  }, [removeLastPoint, selectedArea]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "p" || e.key === "P") setActiveTool("pan");
      if (e.key === "m" || e.key === "M") setActiveTool("measure");
      if (e.key === "a" || e.key === "A") setActiveTool("area");
      if (e.key === "u" || e.key === "U") handleUndoMeasurePoint();
      if (e.key === "Escape") setActiveTool("pan");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndoMeasurePoint]);

  const placeEquipment = useCallback((equipment: Equipment, lat: number, lng: number) => {
    setPlacedEquipment((prev) => [
      ...prev,
      {
        id: `placed-${Date.now()}-${prev.length}`,
        equipment,
        lat,
        lng,
        rotationDeg: 0,
      },
    ]);
  }, []);

  const placeEquipmentGroup = useCallback((groupId: string, equipment: Equipment, positions: { lat: number; lng: number; rotationDeg?: number }[]) => {
    setPlacedEquipment((prev) => [
      ...prev.filter((item) => item.placementGroupId !== groupId),
      ...positions.map((position, index) => ({
        id: `${groupId}-${index}`,
        equipment,
        lat: position.lat,
        lng: position.lng,
        rotationDeg: position.rotationDeg ?? 0,
        placementGroupId: groupId,
      })),
    ]);
  }, []);

  const moveEquipment = useCallback((id: string, lat: number, lng: number) => {
    pendingMoveRef.current = { id, lat, lng };
    if (moveFrameRef.current != null) return;

    moveFrameRef.current = window.requestAnimationFrame(() => {
      const next = pendingMoveRef.current;
      moveFrameRef.current = null;
      pendingMoveRef.current = null;
      if (!next) return;

      setPlacedEquipment((prev) => {
        let changed = false;
        const updated = prev.map((item) => {
          if (item.id !== next.id) return item;
          if (item.lat === next.lat && item.lng === next.lng) return item;
          changed = true;
          return { ...item, lat: next.lat, lng: next.lng };
        });
        return changed ? updated : prev;
      });
    });
  }, []);

  const rotateEquipment = useCallback((id: string) => {
    setPlacedEquipment((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rotationDeg: (item.rotationDeg + 2) % 360 } : item
      )
    );
  }, []);

  const duplicateEquipment = useCallback((id: string) => {
    setPlacedEquipment((prev) => {
      const source = prev.find((item) => item.id === id);
      if (!source) return prev;
      return [
        ...prev,
        {
          ...source,
          id: `placed-${Date.now()}-${prev.length}`,
        },
      ];
    });
  }, []);

  const deleteEquipment = useCallback((id: string) => {
    setPlacedEquipment((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      if (moveFrameRef.current != null) {
        window.cancelAnimationFrame(moveFrameRef.current);
      }
    };
  }, []);

  const handleSaveLayout = useCallback(() => {
    if (typeof window === "undefined") return;
    const existing = savedLayouts.find((layout) => layout.id === selectedLayoutId);
    const layoutName = window.prompt("Name this layout", existing?.name ?? "My Layout");
    if (layoutName === null) return;

    const saved = saveLayout({
      name: layoutName,
      activeTool,
      mapView,
      unitSystem,
      measurePoints: points,
      measureComplete: isComplete,
      areas,
      selectedArea,
      placedEquipment,
      equipmentCatalog: equipment,
      selectedEquipmentId: selected?.id ?? null,
      ...(selectedLayoutId || existing?.id ? { id: selectedLayoutId || existing?.id } : {}),
    });

    setSavedLayouts(loadSavedLayouts());
    setSelectedLayoutId(saved.id);
    setActiveLayoutId(saved.id);
  }, [activeTool, areas, equipment, isComplete, mapView, points, placedEquipment, savedLayouts, selected, selectedArea, selectedLayoutId, unitSystem]);

  const handleLoadLayout = useCallback(() => {
    if (!selectedLayoutId) return;
    const layout = loadSavedLayout(selectedLayoutId);
    if (!layout) return;
    applyLayout(layout);
    setActiveLayoutId(layout.id);
  }, [applyLayout, selectedLayoutId]);

  const handleDeleteLayout = useCallback(() => {
    if (!selectedLayoutId) return;
    const nextLayouts = deleteLayout(selectedLayoutId);
    setSavedLayouts(nextLayouts);
    setSelectedLayoutId("");
    setActiveLayoutId(null);
  }, [selectedLayoutId]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg)]">
        {/* Top header bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-[var(--surface-1)] border-b border-[var(--border)] z-30">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-amber)] to-[var(--accent-cyan)] flex items-center justify-center text-[#0a0e1a] font-bold text-xs">
              T
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--text)] leading-none" style={{ fontFamily: "var(--font-exo)" }}>
                Testing
              </h1> 
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <LayoutManager
              layouts={savedLayouts}
              selectedLayoutId={selectedLayoutId}
              onSelectLayout={setSelectedLayoutId}
              onSave={handleSaveLayout}
              onLoad={handleLoadLayout}
              onDelete={handleDeleteLayout}
            /> 
          </div>
        </header>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Sidebar: Equipment Panel */}
          <Sidebar side="left" width={280}>
            <EquipmentPanel
              categorized={categorized}
              selected={selected}
              onSelect={select}
              onRemove={remove}
              onAddCustom={addCustom}
            />
          </Sidebar>

          {/* Map area */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Floating toolbar */}
            <Toolbar
              activeTool={activeTool}
              onChange={setActiveTool}
              onClearMeasure={handleClearMeasure}
              onRemoveLastPoint={handleUndoMeasurePoint}
              onClearArea={handleClearArea}
              totalDistance={totalM}
              pointCount={points.length}
            />

            <MapContainer
              activeTool={activeTool}
              mapView={mapView}
              onMapViewChange={handleMapViewChange}
              onToolChange={setActiveTool}
              areas={areas}
              measurePoints={points}
              isMeasureComplete={isComplete}
              onMapClick={handleMeasureMapClick}
              onMeasurePointClick={closePolygon}
              onAreaSelected={handleAreaSelected}
              onClearArea={handleClearArea}
              onRemoveLastPoint={handleUndoMeasurePoint}
              selectedArea={selectedArea}
              totalDistance={totalM}
              selectedEquipment={selected}
              placedEquipment={placedEquipment}
              pendingEquipmentDrop={pendingEquipmentDrop}
              onPendingEquipmentDropHandled={() => setPendingEquipmentDrop(null)}
              onPlaceEquipment={placeEquipment}
              onPlaceEquipmentGroup={placeEquipmentGroup}
              onMoveEquipment={moveEquipment}
              onRotateEquipment={rotateEquipment}
              onDuplicateEquipment={duplicateEquipment}
              onDeleteEquipment={deleteEquipment}
            />

            {/* UI Overlays */}
            <UnitsToggle currentUnits={unitSystem} onUnitsChange={setUnitSystem} />
            <ExportMeasurements measurePoints={points} selectedArea={selectedArea} totalDistance={totalM} />

            {/* Bottom status bar */}
            <div className="flex-shrink-0 flex items-center gap-4 px-4 py-1.5 bg-[var(--surface-1)] border-t border-[var(--border)] text-[11px] font-mono text-[var(--muted)]">
              <span className={`flex items-center gap-1.5 ${activeTool === "measure" ? "text-[var(--accent-amber)]" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTool === "measure" ? "bg-[var(--accent-amber)] animate-pulse" : "bg-[var(--border-bright)]"}`} />
                {activeTool === "measure" ? `Measure: ${points.length} pts` : "Measure: off"}
              </span>
              <span className={`flex items-center gap-1.5 ${activeTool === "area" ? "text-[var(--accent-green)]" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${areas.length > 0 || selectedArea ? "bg-[var(--accent-green)]" : "bg-[var(--border-bright)]"}`} />
                {areas.length > 0
                  ? `Areas: ${areas.length}`
                  : selectedArea
                    ? `Area: ${selectedArea.widthM.toFixed(0)}×${selectedArea.heightM.toFixed(0)}m`
                    : "Area: none"}
              </span>
              <span className={`flex items-center gap-1.5 ${selected ? "text-[var(--accent-cyan)]" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-[var(--accent-cyan)]" : "bg-[var(--border-bright)]"}`} />
                {selected ? `Equipment: ${selected.name}` : "Equipment: none"}
              </span>
            </div>
          </div>

          {/* Right Sidebar: Calculator */}
          <Sidebar side="right" width={300}>
            <EquipmentCalculator
              selectedArea={selectedArea}
              selectedEquipment={selected}
              areas={areas}
              placedEquipment={placedEquipment}
              onSelectArea={setSelectedArea}
              onRenameArea={renameArea}
              onDeleteArea={deleteArea}
              onEquipmentDrop={select}
            />
          </Sidebar>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingEquipment && (
          <div className="bg-[var(--surface-2)] border border-[var(--accent-cyan)] rounded-lg px-3 py-2 shadow-2xl glow-cyan opacity-90 flex items-center gap-2">
            {draggingEquipment.imageSrc ? (
              <img
                src={draggingEquipment.imageSrc}
                alt={draggingEquipment.name}
                draggable={false}
                className="h-8 w-8 object-contain"
              />
            ) : (
              <span className="text-lg">{draggingEquipment.emoji}</span>
            )}
            <div>
              <p className="text-xs font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-exo)" }}>
                {draggingEquipment.name}
              </p>
              <p className="text-[10px] font-mono text-[var(--muted)]">
                {draggingEquipment.lengthM}m × {draggingEquipment.widthM}m
              </p>
            </div>
          </div>
        )}
      </DragOverlay>

      {/* Help Panel */}
      <HelpPanel />
    </DndContext>
  );
}
