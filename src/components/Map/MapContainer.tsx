"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
  Polygon,
  Marker,
  OverlayView,
} from "@react-google-maps/api";
import { CopyPlus, RotateCw, Trash2 } from "lucide-react";
import type { ActiveTool, EquipmentDropRequest, MapView, MeasurePoint, PlacedEquipment, SelectedArea } from "@/types";
import LocationSearch from "@/components/UI/LocationSearch";
import {
  haversineDistance,
  boundsToAreaMeters,
  formatDistance,
  formatArea,
  polygonArea,
  polygonBounds,
  polygonCenter,
  boundsDimensionsMeters,
  isPointInPolygon,
} from "@/utils/geoUtils";

const LIBRARIES: ("drawing" | "geometry" | "places")[] = ["drawing", "geometry"];

// Use default Google Maps styling so all standard labels and place names remain visible.
const MAP_STYLES: google.maps.MapTypeStyle[] = [];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeId: "roadmap",
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  zoomControlOptions: { position: 9 },
};

interface Props {
  activeTool: ActiveTool;
  mapView: MapView;
  onMapViewChange: (view: MapView) => void;
  measurePoints: MeasurePoint[];
  isMeasureComplete: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onMeasurePointClick: (pointId: string) => void;
  onAreaSelected: (area: SelectedArea) => void;
  onClearArea: () => void;
  onRemoveLastPoint?: () => void;
  selectedArea: SelectedArea | null;
  totalDistance?: number;
  placedEquipment: PlacedEquipment[];
  pendingEquipmentDrop: EquipmentDropRequest | null;
  onPendingEquipmentDropHandled: () => void;
  onPlaceEquipment: (equipment: EquipmentDropRequest["equipment"], lat: number, lng: number) => void;
  onMoveEquipment: (id: string, lat: number, lng: number) => void;
  onRotateEquipment: (id: string) => void;
  onDuplicateEquipment: (id: string) => void;
  onDeleteEquipment: (id: string) => void;
}

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function clampVisualSize(px: number) {
  return Math.max(8, Math.min(2400, px));
}

function sameArea(a: SelectedArea | null, b: SelectedArea | null) {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  if (
    a.areaM2 !== b.areaM2 ||
    a.widthM !== b.widthM ||
    a.heightM !== b.heightM ||
    a.label !== b.label ||
    a.center?.lat !== b.center?.lat ||
    a.center?.lng !== b.center?.lng
  ) {
    return false;
  }

  const aBounds = a.bounds;
  const bBounds = b.bounds;
  if (!!aBounds !== !!bBounds) return false;
  if (aBounds && bBounds) {
    if (
      aBounds.north !== bBounds.north ||
      aBounds.south !== bBounds.south ||
      aBounds.east !== bBounds.east ||
      aBounds.west !== bBounds.west
    ) {
      return false;
    }
  }

  if ((a.path?.length ?? 0) !== (b.path?.length ?? 0)) return false;
  if (a.path && b.path) {
    for (let i = 0; i < a.path.length; i++) {
      const ap = a.path[i];
      const bp = b.path[i];
      if (ap.id !== bp.id || ap.lat !== bp.lat || ap.lng !== bp.lng) return false;
    }
  }

  return true;
}

export default function MapContainer({
  activeTool,
  mapView,
  onMapViewChange,
  measurePoints,
  isMeasureComplete,
  onMapClick,
  onMeasurePointClick,
  onAreaSelected,
  onClearArea,
  onRemoveLastPoint,
  selectedArea,
  totalDistance = 0,
  placedEquipment,
  pendingEquipmentDrop,
  onPendingEquipmentDropHandled,
  onPlaceEquipment,
  onMoveEquipment,
  onRotateEquipment,
  onDuplicateEquipment,
  onDeleteEquipment,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const rectangleRef = useRef<google.maps.Rectangle | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [draggingPlacedId, setDraggingPlacedId] = useState<string | null>(null);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const lastEmittedAreaRef = useRef<SelectedArea | null>(null);

  const emitAreaSelected = useCallback(
    (nextArea: SelectedArea) => {
      if (sameArea(lastEmittedAreaRef.current, nextArea)) return;
      lastEmittedAreaRef.current = nextArea;
      onAreaSelected(nextArea);
    },
    [onAreaSelected]
  );

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(mapView.center);
    map.setZoom(mapView.zoom);
    setZoom(mapView.zoom);
    setMapLoaded(true);
  }, [mapView]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const currentCenter = map.getCenter();
    if (!currentCenter || currentCenter.lat() !== mapView.center.lat || currentCenter.lng() !== mapView.center.lng) {
      map.setCenter(mapView.center);
    }
    if ((map.getZoom() ?? 13) !== mapView.zoom) {
      map.setZoom(mapView.zoom);
    }
    setZoom(mapView.zoom);
  }, [mapLoaded, mapView]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const emitView = () => {
      const center = map.getCenter();
      if (!center) return;
      onMapViewChange({
        center: { lat: center.lat(), lng: center.lng() },
        zoom: map.getZoom() ?? 13,
      });
      setZoom(map.getZoom() ?? 13);
    };

    const idleListener = map.addListener("idle", emitView);
    const zoomListener = map.addListener("zoom_changed", emitView);
    emitView();

    return () => {
      idleListener.remove();
      zoomListener.remove();
    };
  }, [mapLoaded, onMapViewChange]);

  // Setup Drawing Manager for area tool
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const maps = window.google.maps;

    if (!drawingManagerRef.current) {
      const dm = new maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        rectangleOptions: {
          fillColor: "#f59e0b",
          fillOpacity: 0.15,
          strokeColor: "#f59e0b",
          strokeWeight: 2,
          strokeOpacity: 0.9,
          editable: true,
          draggable: true,
        },
      });
      dm.setMap(mapRef.current);
      drawingManagerRef.current = dm;

      maps.event.addListener(dm, "rectanglecomplete", (rect: google.maps.Rectangle) => {
        // Remove old rectangle
        if (rectangleRef.current) rectangleRef.current.setMap(null);
        rectangleRef.current = rect;

        const handleBoundsChange = () => {
          const bounds = rect.getBounds();
          if (!bounds) return;
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const { areaM2, widthM, heightM } = boundsToAreaMeters(
            { lat: ne.lat(), lng: ne.lng() },
            { lat: sw.lat(), lng: sw.lng() }
          );
          emitAreaSelected({
            type: "rectangle",
            areaM2,
            widthM: Math.max(widthM, heightM),
            heightM: Math.min(widthM, heightM),
            label: `${Math.max(widthM, heightM).toFixed(1)}m x ${Math.min(widthM, heightM).toFixed(1)}m`,
            bounds: {
              north: ne.lat(),
              south: sw.lat(),
              east: ne.lng(),
              west: sw.lng(),
            },
            center: {
              lat: bounds.getCenter().lat(),
              lng: bounds.getCenter().lng(),
            },
          });
        };

        handleBoundsChange();
        maps.event.addListener(rect, "bounds_changed", handleBoundsChange);
        dm.setDrawingMode(null);
      });
    }
  }, [emitAreaSelected, mapLoaded]);

  // Sync drawing mode with active tool
  useEffect(() => {
    if (!drawingManagerRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;
    if (activeTool === "area") {
      drawingManagerRef.current.setDrawingMode(maps.drawing.OverlayType.RECTANGLE);
    } else {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, [activeTool]);

  // Clear area
  useEffect(() => {
    if (!selectedArea || selectedArea.type !== "rectangle") {
      if (rectangleRef.current) rectangleRef.current.setMap(null);
      rectangleRef.current = null;
      if (!selectedArea) lastEmittedAreaRef.current = null;
      return;
    }
    if (selectedArea.type === "rectangle" && !selectedArea.bounds && rectangleRef.current) {
      rectangleRef.current.setMap(null);
      rectangleRef.current = null;
    }
  }, [selectedArea]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !selectedArea || selectedArea.type !== "rectangle" || !selectedArea.bounds) return;
    const maps = window.google.maps;
    let rect = rectangleRef.current;

    if (!rect) {
      rect = new maps.Rectangle({
        bounds: selectedArea.bounds,
        editable: true,
        draggable: true,
        fillColor: "#e3e3e3",
        fillOpacity: 0.15,
        strokeColor: "#e3e3e3",
        strokeWeight: 1,
        strokeOpacity: 0.9,
      });
      rect.setMap(mapRef.current);
      rectangleRef.current = rect;
    } else {
      const currentBounds = rect.getBounds();
      const nextBounds = selectedArea.bounds;
      const changed =
        !currentBounds ||
        currentBounds.getNorthEast().lat() !== nextBounds.north ||
        currentBounds.getSouthWest().lat() !== nextBounds.south ||
        currentBounds.getNorthEast().lng() !== nextBounds.east ||
        currentBounds.getSouthWest().lng() !== nextBounds.west;
      if (changed) {
        rect.setBounds(nextBounds);
      }
    }

    const syncBounds = () => {
      const bounds = rect.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const { areaM2, widthM, heightM } = boundsToAreaMeters(
        { lat: ne.lat(), lng: ne.lng() },
        { lat: sw.lat(), lng: sw.lng() }
      );
      emitAreaSelected({
        type: "rectangle",
        areaM2,
        widthM: Math.max(widthM, heightM),
        heightM: Math.min(widthM, heightM),
        label: `${Math.max(widthM, heightM).toFixed(1)}m x ${Math.min(widthM, heightM).toFixed(1)}m`,
        bounds: {
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        },
        center: {
          lat: bounds.getCenter().lat(),
          lng: bounds.getCenter().lng(),
        },
      });
    };

    syncBounds();
    const listener = maps.event.addListener(rect, "bounds_changed", syncBounds);
    return () => {
      listener.remove();
    };
  }, [emitAreaSelected, mapLoaded, selectedArea]);

  useEffect(() => {
    if (!isMeasureComplete || measurePoints.length < 3) return;
    const areaM2 = polygonArea(measurePoints);
    const bounds = polygonBounds(measurePoints);
    const { widthM, heightM } = boundsDimensionsMeters(bounds);
    emitAreaSelected({
      type: "polygon",
      areaM2,
      widthM,
      heightM,
      label: `${widthM.toFixed(1)}m x ${heightM.toFixed(1)}m`,
      path: measurePoints,
      bounds,
      center: polygonCenter(measurePoints),
    });
  }, [emitAreaSelected, isMeasureComplete, measurePoints]);

  const clientPointToLatLng = useCallback((clientX: number, clientY: number) => {
    const map = mapRef.current;
    const shell = mapShellRef.current;
    const projection = map?.getProjection();
    const center = map?.getCenter();
    const mapZoom = map?.getZoom();
    if (!map || !shell || !projection || !center || mapZoom == null) return null;

    const rect = shell.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const scale = 2 ** mapZoom;
    const centerPoint = projection.fromLatLngToPoint(center);
    if (!centerPoint) return null;
    const worldPoint = new google.maps.Point(
      centerPoint.x + (clientX - (rect.left + rect.width / 2)) / scale,
      centerPoint.y + (clientY - (rect.top + rect.height / 2)) / scale
    );
    const latLng = projection.fromPointToLatLng(worldPoint);
    return latLng ? { lat: latLng.lat(), lng: latLng.lng() } : null;
  }, []);

  const pointIsInsideSelectedArea = useCallback(
    (point: { lat: number; lng: number }) => {
      if (!selectedArea) return false;
      if (selectedArea.type === "polygon" && selectedArea.path) {
        return isPointInPolygon(point, selectedArea.path);
      }
      if (selectedArea.bounds) {
        return (
          point.lat <= selectedArea.bounds.north &&
          point.lat >= selectedArea.bounds.south &&
          point.lng <= selectedArea.bounds.east &&
          point.lng >= selectedArea.bounds.west
        );
      }
      return false;
    },
    [selectedArea]
  );

  useEffect(() => {
    if (!pendingEquipmentDrop) return;
    const point = clientPointToLatLng(pendingEquipmentDrop.clientX, pendingEquipmentDrop.clientY);
    if (point && pointIsInsideSelectedArea(point)) {
      onPlaceEquipment(pendingEquipmentDrop.equipment, point.lat, point.lng);
    }
    onPendingEquipmentDropHandled();
  }, [
    clientPointToLatLng,
    onPendingEquipmentDropHandled,
    onPlaceEquipment,
    pendingEquipmentDrop,
    pointIsInsideSelectedArea,
  ]);

  useEffect(() => {
    if (!draggingPlacedId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = clientPointToLatLng(event.clientX, event.clientY);
      if (point && pointIsInsideSelectedArea(point)) {
        onMoveEquipment(draggingPlacedId, point.lat, point.lng);
      }
    };
    const handlePointerUp = () => setDraggingPlacedId(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [clientPointToLatLng, draggingPlacedId, onMoveEquipment, pointIsInsideSelectedArea]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-equipment-overlay]")) {
        setSelectedPlacedId(null);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      setSelectedPlacedId(null);
      if (activeTool !== "measure" || !e.latLng) return;
      onMapClick(e.latLng.lat(), e.latLng.lng());
    },
    [activeTool, onMapClick]
  );

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--surface-1)]">
        <div className="text-center p-8">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-[var(--accent-red)] font-semibold mb-1">Maps failed to load</p>
          <p className="text-sm text-[var(--muted)] max-w-xs">
            Check your <code className="bg-[var(--surface-2)] px-1 rounded">.env.local</code> file and make sure{" "}
            <code className="bg-[var(--surface-2)] px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> is set correctly.
          </p>
          <p className="text-xs text-[var(--muted)] mt-2">Enable: Maps JS API, Drawing Library, Geometry Library</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--surface-1)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent-cyan)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--muted)] font-mono">Loading Google Maps…</p>
        </div>
      </div>
    );
  }

  // Build polyline path
  const polylinePath = measurePoints.map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <div ref={mapShellRef} className="flex-1 relative overflow-hidden" style={{
      cursor: activeTool === "measure" ? "crosshair" : activeTool === "area" ? "crosshair" : "grab",
    }}>
      {/* <LocationSearch mapRef={mapRef} onLocationFound={(lat, lng, name) => {
        setSelectedLocation({ lat, lng, name });
      }} /> */}
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{
          ...MAP_OPTIONS,
          styles: MAP_STYLES,
        }}
      >
        {/* Measure polyline */}
        {measurePoints.length >= 2 && (
          <Polyline
            path={polylinePath}
            options={{
              strokeColor: "#f59e0b", //
              strokeOpacity: 0.9,
              strokeWeight: 2.5,
              geodesic: true,
            }}
          />
        )}

        {/* Measure polygon (when 3+ points) */}
        {measurePoints.length >= 3 && (
          <Polygon
            path={polylinePath}
            options={{
              fillColor: "", //#f59e0b
              fillOpacity:  0,
              strokeColor: "#f59e0b",
              strokeOpacity: 0.9,
              strokeWeight: 2.5,
              geodesic: true,
            }}
          />
        )}

        {/* Measure markers + segment labels */}
        {measurePoints.map((pt, i) => (
          <Marker
            key={pt.id}
            position={{ lat: pt.lat, lng: pt.lng }}
            onClick={() => {
              if (activeTool === "measure" && measurePoints.length >= 3) {
                onMeasurePointClick(pt.id);
              }
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: i === 0 ? 7 : 5,
              fillColor: isMeasureComplete ? "#10b981" : i === 0 ? "#06b6d4" : "#f59e0b",
              fillOpacity: 1,
              strokeColor: "#0a0e1a",
              strokeWeight: 2,
            }}
            zIndex={10}
          />
        ))}

        {/* Segment distance labels */}
        {measurePoints.length >= 2 &&
          measurePoints.slice(1).map((pt, i) => {
            const prev = measurePoints[i];
            const midLat = (prev.lat + pt.lat) / 2;
            const midLng = (prev.lng + pt.lng) / 2;
            const dist = haversineDistance(prev, pt);
            return (
              <OverlayView
                key={`seg-${i}`}
                position={{ lat: midLat, lng: midLng }}
                mapPaneName={OverlayView.OVERLAY_LAYER}
              >
                <div className="transform -translate-x-1/6 -translate-y-1/6 bg-[rgba(10,14,26,0.9)] border border-[var(--accent-amber)] text-[var(--accent-amber)] text-[11px] font-mono px-3 py-1 rounded-lg whitespace-nowrap shadow-lg w-fit pointer-events-none font-medium">
                  {formatDistance(dist)}
                </div>
              </OverlayView>
            );
          })}

        {/* Total distance label at last point */}
        {measurePoints.length >= 2 && (() => {
          const last = measurePoints[measurePoints.length - 1];
          return (
            <OverlayView
              position={{ lat: last.lat, lng: last.lng }}
              mapPaneName={OverlayView.OVERLAY_LAYER}
            >
              <div className="transform translate-x-3 -translate-y-1/6 w-fit bg-gradient-to-r from-[var(--accent-amber)] to-[var(--accent-amber)] text-[#0a0e1a] text-[12px] font-mono font-bold px-3 py-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap relative">
                Total: {formatDistance(totalDistance)}
                <div className="absolute top-0 -left-2 w-0 h-0 border-l-2 border-r-0 border-t-2 border-b-2 border-l-[var(--accent-amber)] border-r-transparent border-t-[var(--accent-amber)] border-b-transparent" />
              </div>
            </OverlayView>
          );
        })()}

        {/* Polygon area label (when 3+ points) */}
        {measurePoints.length >= 3 && (() => {
          const polygonAreaM2 = polygonArea(measurePoints);
          if (polygonAreaM2 === 0) return null;
          // Position at centroid of polygon
          const centerLat = measurePoints.reduce((sum, p) => sum + p.lat, 0) / measurePoints.length;
          const centerLng = measurePoints.reduce((sum, p) => sum + p.lng, 0) / measurePoints.length;
          return (
            <OverlayView
              position={{ lat: centerLat, lng: centerLng }}
              mapPaneName={OverlayView.OVERLAY_LAYER}
            >
              <div className="transform -translate-x-1/2 -translate-y-1/2 w-fit bg-[rgba(10,14,26,0.95)] border-2 border-[var(--accent-cyan)] text-[var(--accent-cyan)] rounded-lg px-4 py-3 shadow-xl pointer-events-none text-center font-mono">
                <p className="text-sm font-bold">
                  {formatArea(polygonAreaM2)}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-1">
                  {measurePoints.length} points
                </p>
              </div>
            </OverlayView>
          );
        })()}

        {/* Area label */}
        {selectedArea && (() => {
          const rectBounds = rectangleRef.current?.getBounds();
          const center =
            selectedArea.center ??
            (rectBounds
              ? { lat: rectBounds.getCenter().lat(), lng: rectBounds.getCenter().lng() }
              : null);
          if (!center) return null;
          return (
            <OverlayView
              position={center}
              mapPaneName={OverlayView.OVERLAY_LAYER}
            >
              <div></div>
              {/* <div className="transform -translate-x-1/2 -translate-y-1/2 w-fit bg-[rgba(10,14,26,0.95)] border border-[var(--accent-amber)] rounded-lg px-4 py-3 pointer-events-none shadow-xl text-center">
                <p className="text-[var(--accent-amber)] font-mono text-sm font-bold">
                  {formatArea(selectedArea.areaM2)}
                </p>
                <p className="text-[var(--muted)] font-mono text-[10px] mt-1">
                  {selectedArea.widthM.toFixed(1)}m x {selectedArea.heightM.toFixed(1)}m
                </p>
              </div> */}
            </OverlayView>
          );
        })()}

        {/* Placed equipment */}
        {placedEquipment.map((item) => {
          const mpp = metersPerPixel(item.lat, zoom);
          const widthPx = clampVisualSize(item.equipment.lengthM / mpp);
          const heightPx = clampVisualSize(item.equipment.widthM / mpp);
          const isSelected = selectedPlacedId === item.id;
          return (
            <OverlayView
              key={item.id}
              position={{ lat: item.lat, lng: item.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                data-equipment-overlay
                className="absolute select-none"
                style={{
                  width: widthPx,
                  height: heightPx,
                  transform: "translate(-50%, -50%)",
                  transformOrigin: "center",
                  zIndex: draggingPlacedId === item.id || isSelected ? 50 : 20,
                }}
              >
                <div
                  className={`relative w-full h-full border-[1px] cursor-move transition-opacity ${
                    isSelected ? "ring-2 ring-white/80" : ""
                  }`}
                  style={{
                    backgroundColor: `${item.equipment.color}55`,
                    borderColor: item.equipment.color,
                    transform: `rotate(${item.rotationDeg}deg)`,
                    transformOrigin: "center",
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedPlacedId(item.id);
                    setDraggingPlacedId(item.id);
                  }}
                  title={`${item.equipment.name} (${item.equipment.lengthM}m x ${item.equipment.widthM}m)`}
                >
                  {item.equipment.imageSrc ? (
                    <img
                      src={item.equipment.imageSrc}
                      alt={item.equipment.name}
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-fill"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center overflow-hidden">
                      <span
                        className="font-mono font-bold text-[#0a0e1a] bg-white/80 rounded px-1"
                        style={{ fontSize: Math.max(9, Math.min(16, Math.min(widthPx, heightPx) * 0.45)) }}
                      >
                        {item.equipment.emoji}
                      </span>
                    </div>
                  )}
                </div>
                {isSelected && (
                  <>
                  <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-[rgba(10,14,26,0.92)] border border-white/40 px-2 py-0.5 text-[10px] font-mono font-semibold text-white shadow-lg pointer-events-none">
                    {item.equipment.lengthM}m x {item.equipment.widthM}m
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-md border border-[var(--border)] bg-[rgba(10,14,26,0.92)] px-1 py-0.5 shadow-xl">
                    <button
                      className="tooltip grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--accent-amber)]"
                      data-tip="Rotate"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRotateEquipment(item.id);
                      }}
                    >
                      <RotateCw size={13} />
                    </button>
                    <button
                      className="tooltip grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--accent-cyan)]"
                      data-tip="Duplicate"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateEquipment(item.id);
                      }}
                    >
                      <CopyPlus size={13} />
                    </button>
                    <button
                      className="tooltip grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--accent-red)]"
                      data-tip="Delete"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteEquipment(item.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  </>
                )}
              </div>
            </OverlayView>
          );
        })}

        {/* Selected location marker and label */}
        {selectedLocation && (
          <>
            <Marker
              position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#06b6d4",
                fillOpacity: 1,
                strokeColor: "#0a0e1a",
                strokeWeight: 3,
              }}
              zIndex={15}
            />
            <OverlayView
              position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
              mapPaneName={OverlayView.OVERLAY_LAYER}
            >
              <div className="transform -translate-x-1/2 translate-y-3 w-fit bg-gradient-to-r from-[var(--accent-cyan)] to-cyan-500 text-[#0a0e1a] text-[12px] font-mono font-bold px-3 py-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap relative">
                📍 {selectedLocation.name}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 translate-y-0 w-0 h-0 border-l-2 border-r-2 border-b-2 border-l-transparent border-r-transparent border-b-cyan-500" />
              </div>
            </OverlayView>
          </>
        )}
      </GoogleMap>

      {/* Instructions & quick actions overlay */}
      {activeTool === "measure" && measurePoints.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[rgba(10,14,26,0.9)] border border-[var(--accent-amber)] rounded-xl px-4 py-2 text-sm text-[var(--accent-amber)] font-mono pointer-events-none animate-fade-in shadow-lg">
          Click on the map to start measuring
        </div>
      )}
      {activeTool === "measure" && measurePoints.length > 0 && (
        <button
          onClick={onRemoveLastPoint}
          className="absolute bottom-6 right-6 bg-[var(--accent-amber)] hover:bg-[var(--accent-amber)] text-[#0a0e1a] px-4 py-2 rounded-lg font-mono text-sm font-bold shadow-lg transition-all hover:shadow-xl pointer-events-auto"
          title="Undo last point (or press U)">
          ↶ Undo Point
        </button>
      )}
      {activeTool === "area" && !selectedArea && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[rgba(10,14,26,0.9)] border border-[var(--accent-green)] rounded-xl px-4 py-2 text-sm text-[var(--accent-green)] font-mono pointer-events-none animate-fade-in shadow-lg">
          Click and drag to draw an area rectangle
        </div>
      )}
    </div>
  );
}
