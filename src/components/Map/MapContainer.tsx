"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
  Polygon,
  Marker,
  Rectangle,
  OverlayView,
} from "@react-google-maps/api";
import { RotateCw, Trash2 } from "lucide-react";
import type { ActiveTool, Equipment, EquipmentDropRequest, MapView, MeasurePoint, PlacedEquipment, SelectedArea } from "@/types";
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

type ClientRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

interface Props {
  activeTool: ActiveTool;
  mapView: MapView;
  onMapViewChange: (view: MapView) => void;
  onToolChange: (tool: ActiveTool) => void;
  areas: SelectedArea[];
  measurePoints: MeasurePoint[];
  isMeasureComplete: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onMeasurePointClick: (pointId: string) => void;
  onAreaSelected: (area: SelectedArea) => void;
  onClearArea: () => void;
  onRemoveLastPoint?: () => void;
  selectedArea: SelectedArea | null;
  totalDistance?: number;
  selectedEquipment: Equipment | null;
  placedEquipment: PlacedEquipment[];
  pendingEquipmentDrop: EquipmentDropRequest | null;
  onPendingEquipmentDropHandled: () => void;
  onPlaceEquipment: (equipment: EquipmentDropRequest["equipment"], lat: number, lng: number) => void;
  onPlaceEquipmentGroup: (groupId: string, equipment: Equipment, positions: { lat: number; lng: number; rotationDeg?: number }[]) => void;
  onMoveEquipment: (id: string, lat: number, lng: number) => void;
  onRotateEquipment: (id: string) => void;
  onDuplicateEquipment?: (id: string) => void;
  onDeleteEquipment: (id: string) => void;
}

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function clampVisualSize(px: number) {
  return Math.max(8, Math.min(2400, px));
}

function rectsOverlap(a: ClientRect, b: ClientRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function normalizeClientRect(startX: number, startY: number, currentX: number, currentY: number): ClientRect {
  return {
    left: Math.min(startX, currentX),
    right: Math.max(startX, currentX),
    top: Math.min(startY, currentY),
    bottom: Math.max(startY, currentY),
  };
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
  onToolChange,
  areas,
  measurePoints,
  isMeasureComplete,
  onMapClick,
  onMeasurePointClick,
  onAreaSelected,
  onClearArea,
  onRemoveLastPoint,
  selectedArea,
  totalDistance = 0,
  selectedEquipment,
  placedEquipment,
  pendingEquipmentDrop,
  onPendingEquipmentDropHandled,
  onPlaceEquipment,
  onPlaceEquipmentGroup,
  onMoveEquipment,
  onRotateEquipment,
  onDeleteEquipment,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [draggingPlacedId, setDraggingPlacedId] = useState<string | null>(null);
  const [autoPlacingGroupId, setAutoPlacingGroupId] = useState<string | null>(null);
  const [selectedPlacedIds, setSelectedPlacedIds] = useState<string[]>([]);
  const [selectionDrag, setSelectionDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const lastEmittedAreaRef = useRef<SelectedArea | null>(null);
  const [fixedZoneBounds, setFixedZoneBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  
  // Fixed zone size in pixels at baseline zoom (affects scale with zoom)
  const FIXED_ZONE_SIZE_PX = 500;

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
    if ((map.getZoom() ?? 13) !== mapView.zoom) {
      map.setZoom(mapView.zoom);
    }
    setZoom(mapView.zoom);
  }, [mapLoaded, mapView]);

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

  const latLngToClientPoint = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    const shell = mapShellRef.current;
    const projection = map?.getProjection();
    const center = map?.getCenter();
    const mapZoom = map?.getZoom();
    if (!map || !shell || !projection || !center || mapZoom == null) return null;

    const rect = shell.getBoundingClientRect();
    const scale = 2 ** mapZoom;
    const centerPoint = projection.fromLatLngToPoint(center);
    const targetPoint = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lng));
    if (!centerPoint || !targetPoint) return null;

    return {
      x: rect.left + rect.width / 2 + (targetPoint.x - centerPoint.x) * scale,
      y: rect.top + rect.height / 2 + (targetPoint.y - centerPoint.y) * scale,
    };
  }, []);

  const getEquipmentClientRect = useCallback(
    (item: PlacedEquipment, pointOverride?: { lat: number; lng: number }) => {
      const lat = pointOverride?.lat ?? item.lat;
      const lng = pointOverride?.lng ?? item.lng;
      const center = latLngToClientPoint(lat, lng);
      if (!center) return null;

      const mpp = metersPerPixel(lat, zoom);
      const widthPx = clampVisualSize(item.equipment.lengthM / mpp);
      const heightPx = clampVisualSize(item.equipment.widthM / mpp);
      const radians = ((item.rotationDeg % 180) * Math.PI) / 180;
      const rotatedWidth = Math.abs(widthPx * Math.cos(radians)) + Math.abs(heightPx * Math.sin(radians));
      const rotatedHeight = Math.abs(widthPx * Math.sin(radians)) + Math.abs(heightPx * Math.cos(radians));

      return {
        left: center.x - rotatedWidth / 2,
        right: center.x + rotatedWidth / 2,
        top: center.y - rotatedHeight / 2,
        bottom: center.y + rotatedHeight / 2,
      };
    },
    [latLngToClientPoint, zoom]
  );

  const itemWouldOverlap = useCallback(
    (
      item: PlacedEquipment,
      pointOverride?: { lat: number; lng: number },
      rotationOverride?: number,
      ignoredIds: Set<string> = new Set([item.id])
    ) => {
      const candidate: PlacedEquipment = {
        ...item,
        lat: pointOverride?.lat ?? item.lat,
        lng: pointOverride?.lng ?? item.lng,
        rotationDeg: rotationOverride ?? item.rotationDeg,
      };
      const candidateRect = getEquipmentClientRect(candidate);
      if (!candidateRect) return true;

      return placedEquipment.some((otherItem) => {
        if (ignoredIds.has(otherItem.id)) return false;
        const otherRect = getEquipmentClientRect(otherItem);
        return !!otherRect && rectsOverlap(candidateRect, otherRect);
      });
    },
    [getEquipmentClientRect, placedEquipment]
  );

  const equipmentWouldOverlap = useCallback(
    (equipment: Equipment, lat: number, lng: number, ignoredIds: Set<string> = new Set()) => {
      const candidate: PlacedEquipment = {
        id: "candidate",
        equipment,
        lat,
        lng,
        rotationDeg: 0,
      };
      return itemWouldOverlap(candidate, undefined, undefined, ignoredIds);
    },
    [itemWouldOverlap]
  );

  const canRotateItems = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const candidates = placedEquipment
        .filter((item) => idSet.has(item.id))
        .map((item) => ({ ...item, rotationDeg: (item.rotationDeg + 2) % 360 }));
      if (candidates.length !== ids.length) return false;

      const candidateRects = candidates.map((item) => ({ id: item.id, rect: getEquipmentClientRect(item) }));
      if (candidateRects.some((entry) => !entry.rect)) return false;

      for (let i = 0; i < candidateRects.length; i++) {
        const rect = candidateRects[i].rect;
        if (!rect) return false;

        for (let j = i + 1; j < candidateRects.length; j++) {
          const otherRect = candidateRects[j].rect;
          if (otherRect && rectsOverlap(rect, otherRect)) return false;
        }

        const overlapsOutsideSelection = placedEquipment.some((item) => {
          if (idSet.has(item.id)) return false;
          const itemRect = getEquipmentClientRect(item);
          return !!itemRect && rectsOverlap(rect, itemRect);
        });
        if (overlapsOutsideSelection) return false;
      }

      return true;
    },
    [getEquipmentClientRect, placedEquipment]
  );

  const getFixedZoneClientRect = useCallback(() => {
    const shell = mapShellRef.current;
    if (!shell) return null;

    const rect = shell.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - FIXED_ZONE_SIZE_PX / 2;
    const top = rect.top + rect.height / 2 - FIXED_ZONE_SIZE_PX / 2;

    return {
      left,
      right: left + FIXED_ZONE_SIZE_PX,
      top,
      bottom: top + FIXED_ZONE_SIZE_PX,
      width: FIXED_ZONE_SIZE_PX,
      height: FIXED_ZONE_SIZE_PX,
    };
  }, []);

  const clientPointIsInsideFixedZone = useCallback(
    (clientX: number, clientY: number) => {
      const rect = getFixedZoneClientRect();
      if (!rect) return false;
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    },
    [getFixedZoneClientRect]
  );

  const buildSideBySidePositions = useCallback(
    (groupId: string, equipment: Equipment, startX: number, startY: number, currentX: number, currentY: number) => {
      const map = mapRef.current;
      const mapZoom = map?.getZoom();
      const startPoint = clientPointToLatLng(startX, startY);
      const zoneRect = getFixedZoneClientRect();
      if (!map || mapZoom == null || !startPoint || !zoneRect) return [];

      const mpp = metersPerPixel(startPoint.lat, mapZoom);
      const itemWidthPx = clampVisualSize(equipment.lengthM / mpp);
      const itemHeightPx = clampVisualSize(equipment.widthM / mpp);
      const halfWidth = itemWidthPx / 2;
      const halfHeight = itemHeightPx / 2;

      if (itemWidthPx > zoneRect.width || itemHeightPx > zoneRect.height) return [];

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const isHorizontal = Math.abs(deltaX) >= Math.abs(deltaY);
      const direction = (isHorizontal ? deltaX : deltaY) >= 0 ? 1 : -1;
      const maxLeft = zoneRect.left + halfWidth;
      const maxRight = zoneRect.right - halfWidth;
      const maxTop = zoneRect.top + halfHeight;
      const maxBottom = zoneRect.bottom - halfHeight;
      const centerY = Math.max(zoneRect.top + halfHeight, Math.min(zoneRect.bottom - halfHeight, startY));
      const centerX = Math.max(zoneRect.left + halfWidth, Math.min(zoneRect.right - halfWidth, startX));
      const startCenterX = centerX;
      const startCenterY = Math.max(maxTop, Math.min(maxBottom, startY));
      const stepPx = isHorizontal ? itemWidthPx : itemHeightPx;
      const draggedDistance = Math.abs((isHorizontal ? currentX : currentY) - (isHorizontal ? startCenterX : startCenterY));
      const count = Math.max(1, Math.floor(draggedDistance / stepPx) + 1);
      const positions: { lat: number; lng: number }[] = [];
      const existingIdsToIgnore = new Set(
        placedEquipment.filter((item) => item.placementGroupId === groupId).map((item) => item.id)
      );

      for (let index = 0; index < count; index++) {
        const nextCenterX = isHorizontal ? startCenterX + direction * index * itemWidthPx : startCenterX;
        const nextCenterY = isHorizontal ? centerY : startCenterY + direction * index * itemHeightPx;
        if (nextCenterX < maxLeft || nextCenterX > maxRight || nextCenterY < maxTop || nextCenterY > maxBottom) break;
        const point = clientPointToLatLng(nextCenterX, nextCenterY);
        if (!point || !clientPointIsInsideFixedZone(nextCenterX, nextCenterY)) break;
        if (equipmentWouldOverlap(equipment, point.lat, point.lng, existingIdsToIgnore)) break;
        positions.push(point);
      }

      return positions;
    },
    [clientPointIsInsideFixedZone, clientPointToLatLng, equipmentWouldOverlap, getFixedZoneClientRect, placedEquipment]
  );

  // Calculate fixed zone bounds based on screen center
  const getFixedZoneBounds = useCallback(() => {
    const map = mapRef.current;
    const shell = mapShellRef.current;
    const projection = map?.getProjection();
    const mapZoom = map?.getZoom();
    if (!map || !shell || !projection || mapZoom == null) return null;

    const rect = shell.getBoundingClientRect();
    const screenCenterX = rect.left + rect.width / 2;
    const screenCenterY = rect.top + rect.height / 2;

    // Calculate the zone size in pixels based on zoom
    const zoneSize = FIXED_ZONE_SIZE_PX;

    // Get four corners of the zone in screen coordinates
    const topLeftX = screenCenterX - zoneSize / 2;
    const topLeftY = screenCenterY - zoneSize / 2;
    const bottomRightX = screenCenterX + zoneSize / 2;
    const bottomRightY = screenCenterY + zoneSize / 2;

    // Convert screen coordinates to lat/lng
    const topLeft = clientPointToLatLng(topLeftX, topLeftY);
    const bottomRight = clientPointToLatLng(bottomRightX, bottomRightY);
    const topRight = clientPointToLatLng(bottomRightX, topLeftY);
    const bottomLeft = clientPointToLatLng(topLeftX, bottomRightY);

    if (!topLeft || !bottomRight || !topRight || !bottomLeft) return null;

    return {
      north: Math.max(topLeft.lat, topRight.lat),
      south: Math.min(bottomLeft.lat, bottomRight.lat),
      east: Math.max(topRight.lng, bottomRight.lng),
      west: Math.min(topLeft.lng, bottomLeft.lng),
    };
  }, [clientPointToLatLng]);

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
      // Update fixed zone bounds whenever map view changes
      const bounds = getFixedZoneBounds();
      setFixedZoneBounds(bounds);
    };

    const idleListener = map.addListener("idle", emitView);
    const zoomListener = map.addListener("zoom_changed", emitView);
    emitView();

    return () => {
      idleListener.remove();
      zoomListener.remove();
    };
  }, [mapLoaded, onMapViewChange, getFixedZoneBounds]);

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
        const bounds = rect.getBounds();
        if (!bounds) return;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const { areaM2, widthM, heightM } = boundsToAreaMeters(
          { lat: ne.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: sw.lng() }
        );
        emitAreaSelected({
          source: "drawn",
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
        dm.setDrawingMode(null);
        onToolChange("pan");
      });
    }
  }, [emitAreaSelected, mapLoaded, onToolChange]);

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

  useEffect(() => {
    if (!isMeasureComplete || measurePoints.length < 3) return;
    const areaM2 = polygonArea(measurePoints);
    const bounds = polygonBounds(measurePoints);
    const { widthM, heightM } = boundsDimensionsMeters(bounds);
    emitAreaSelected({
      source: "measurement",
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

  const pointIsInsideAnyArea = useCallback(
    (point: { lat: number; lng: number }) => {
      // Check fixed zone first
      if (fixedZoneBounds) {
        const isInFixedZone =
          point.lat <= fixedZoneBounds.north &&
          point.lat >= fixedZoneBounds.south &&
          point.lng <= fixedZoneBounds.east &&
          point.lng >= fixedZoneBounds.west;
        if (isInFixedZone) return true;
      }

      // Check drawn and selected areas
      const candidates = [
        ...areas,
        ...(selectedArea ? [selectedArea] : []),
      ];

      return candidates.some((area) => {
        if (area.type === "polygon" && area.path) {
          return isPointInPolygon(point, area.path);
        }
        if (area.bounds) {
          return (
            point.lat <= area.bounds.north &&
            point.lat >= area.bounds.south &&
            point.lng <= area.bounds.east &&
            point.lng >= area.bounds.west
          );
        }
        return false;
      });
    },
    [areas, selectedArea, fixedZoneBounds]
  );

  const buildDraggedCopyPositions = useCallback(
    (groupId: string, sourceItem: PlacedEquipment, startX: number, startY: number, currentX: number, currentY: number) => {
      const map = mapRef.current;
      const mapZoom = map?.getZoom();
      const sourceCenter = latLngToClientPoint(sourceItem.lat, sourceItem.lng);
      const shellRect = mapShellRef.current?.getBoundingClientRect();
      if (!map || mapZoom == null || !sourceCenter || !shellRect) return [];

      const mpp = metersPerPixel(sourceItem.lat, mapZoom);
      const itemWidthPx = clampVisualSize(sourceItem.equipment.lengthM / mpp);
      const itemHeightPx = clampVisualSize(sourceItem.equipment.widthM / mpp);
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const isHorizontal = Math.abs(deltaX) >= Math.abs(deltaY);
      const direction = (isHorizontal ? deltaX : deltaY) >= 0 ? 1 : -1;
      const stepPx = isHorizontal ? itemWidthPx : itemHeightPx;
      const draggedDistance = Math.abs(isHorizontal ? deltaX : deltaY);
      const count = Math.floor(draggedDistance / stepPx);
      const positions: { lat: number; lng: number; rotationDeg?: number }[] = [];
      const existingIdsToIgnore = new Set(
        placedEquipment.filter((item) => item.placementGroupId === groupId).map((item) => item.id)
      );

      for (let index = 1; index <= count; index++) {
        const nextCenterX = isHorizontal ? sourceCenter.x + direction * index * itemWidthPx : sourceCenter.x;
        const nextCenterY = isHorizontal ? sourceCenter.y : sourceCenter.y + direction * index * itemHeightPx;
        if (
          nextCenterX < shellRect.left ||
          nextCenterX > shellRect.right ||
          nextCenterY < shellRect.top ||
          nextCenterY > shellRect.bottom
        ) {
          break;
        }

        const point = clientPointToLatLng(nextCenterX, nextCenterY);
        if (!point || !pointIsInsideAnyArea(point)) break;

        const candidate: PlacedEquipment = {
          ...sourceItem,
          id: "copy-candidate",
          lat: point.lat,
          lng: point.lng,
        };
        if (itemWouldOverlap(candidate, undefined, sourceItem.rotationDeg, existingIdsToIgnore)) break;
        positions.push({ ...point, rotationDeg: sourceItem.rotationDeg });
      }

      return positions;
    },
    [clientPointToLatLng, itemWouldOverlap, latLngToClientPoint, placedEquipment, pointIsInsideAnyArea]
  );

  useEffect(() => {
    if (!pendingEquipmentDrop) return;
    let cancelled = false;
    let retryFrame: number | null = null;

    const tryPlace = (attempt: number) => {
      if (cancelled) return;
      const point = clientPointToLatLng(pendingEquipmentDrop.clientX, pendingEquipmentDrop.clientY);
      if (point && pointIsInsideAnyArea(point)) {
        onPlaceEquipment(pendingEquipmentDrop.equipment, point.lat, point.lng);
        onPendingEquipmentDropHandled();
        return;
      }

      if (attempt === 0) {
        retryFrame = window.requestAnimationFrame(() => tryPlace(1));
        return;
      }

      onPendingEquipmentDropHandled();
    };

    tryPlace(0);

    return () => {
      cancelled = true;
      if (retryFrame != null) window.cancelAnimationFrame(retryFrame);
    };
  }, [
    clientPointToLatLng,
    onPendingEquipmentDropHandled,
    onPlaceEquipment,
    pendingEquipmentDrop,
    pointIsInsideAnyArea,
  ]);

  useEffect(() => {
    if (!draggingPlacedId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = clientPointToLatLng(event.clientX, event.clientY);
      const draggedItem = placedEquipment.find((item) => item.id === draggingPlacedId);
      const ignoredIds = new Set([draggingPlacedId]);
      if (
        point &&
        draggedItem &&
        pointIsInsideAnyArea(point) &&
        !itemWouldOverlap(draggedItem, point, undefined, ignoredIds)
      ) {
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
  }, [clientPointToLatLng, draggingPlacedId, itemWouldOverlap, onMoveEquipment, placedEquipment, pointIsInsideAnyArea]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-equipment-overlay]") && !target.closest("[data-equipment-selection-toolbar]")) {
        setSelectedPlacedIds([]);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (suppressNextMapClickRef.current) {
        suppressNextMapClickRef.current = false;
        return;
      }
      setSelectedPlacedIds([]);
      if (activeTool !== "measure" || !e.latLng) return;
      onMapClick(e.latLng.lat(), e.latLng.lng());
    },
    [activeTool, onMapClick]
  );

  const handleMapPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest("[data-equipment-selection-toolbar]")) return;

      if (event.ctrlKey && activeTool !== "measure" && activeTool !== "area") {
        const equipmentOverlay = target instanceof Element ? target.closest("[data-equipment-overlay]") : null;
        const sourceId = equipmentOverlay?.getAttribute("data-equipment-id");
        const sourceItem = sourceId ? placedEquipment.find((item) => item.id === sourceId) : null;

        if (sourceItem) {
          event.preventDefault();
          event.stopPropagation();
          suppressNextMapClickRef.current = true;

          const groupId = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const startX = event.clientX;
          const startY = event.clientY;
          setAutoPlacingGroupId(groupId);
          setSelectedPlacedIds([sourceItem.id]);

          const handlePointerMove = (moveEvent: PointerEvent) => {
            onPlaceEquipmentGroup(
              groupId,
              sourceItem.equipment,
              buildDraggedCopyPositions(groupId, sourceItem, startX, startY, moveEvent.clientX, moveEvent.clientY)
            );
          };

          const handlePointerUp = () => {
            suppressNextMapClickRef.current = true;
            setAutoPlacingGroupId(null);
            window.removeEventListener("pointermove", handlePointerMove);
          };

          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp, { once: true });
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        suppressNextMapClickRef.current = true;

        const startX = event.clientX;
        const startY = event.clientY;
        setSelectionDrag({ startX, startY, currentX: startX, currentY: startY });

        const selectInRect = (rect: ClientRect) => {
          const nextIds = placedEquipment
            .filter((item) => {
              const itemRect = getEquipmentClientRect(item);
              return !!itemRect && rectsOverlap(rect, itemRect);
            })
            .map((item) => item.id);
          setSelectedPlacedIds(nextIds);
        };

        selectInRect(normalizeClientRect(startX, startY, startX, startY));

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const nextRect = normalizeClientRect(startX, startY, moveEvent.clientX, moveEvent.clientY);
          setSelectionDrag({ startX, startY, currentX: moveEvent.clientX, currentY: moveEvent.clientY });
          selectInRect(nextRect);
        };

        const handlePointerUp = () => {
          suppressNextMapClickRef.current = true;
          setSelectionDrag(null);
          window.removeEventListener("pointermove", handlePointerMove);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp, { once: true });
        return;
      }

      if (!selectedEquipment || activeTool === "measure" || activeTool === "area") return;
      if (target instanceof Element && target.closest("[data-equipment-overlay]")) return;
      if (!clientPointIsInsideFixedZone(event.clientX, event.clientY)) return;

      event.preventDefault();
      event.stopPropagation();
      suppressNextMapClickRef.current = true;
      setSelectedPlacedIds([]);

      const groupId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const startX = event.clientX;
      const startY = event.clientY;
      setAutoPlacingGroupId(groupId);
      onPlaceEquipmentGroup(groupId, selectedEquipment, buildSideBySidePositions(groupId, selectedEquipment, startX, startY, startX, startY));

      const handlePointerMove = (moveEvent: PointerEvent) => {
        onPlaceEquipmentGroup(
          groupId,
          selectedEquipment,
          buildSideBySidePositions(groupId, selectedEquipment, startX, startY, moveEvent.clientX, moveEvent.clientY)
        );
      };

      const handlePointerUp = () => {
        suppressNextMapClickRef.current = true;
        setAutoPlacingGroupId(null);
        window.removeEventListener("pointermove", handlePointerMove);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [activeTool, buildDraggedCopyPositions, buildSideBySidePositions, clientPointIsInsideFixedZone, getEquipmentClientRect, onPlaceEquipmentGroup, placedEquipment, selectedEquipment]
  );

  const selectedEquipmentItems = placedEquipment.filter((item) => selectedPlacedIds.includes(item.id));
  const multiSelectionToolbar = useMemo(() => {
    if (selectedEquipmentItems.length < 2) return null;
    const shell = mapShellRef.current;
    if (!shell) return null;

    const itemRects = selectedEquipmentItems
      .map((item) => getEquipmentClientRect(item))
      .filter((rect): rect is ClientRect => !!rect);
    if (itemRects.length === 0) return null;

    const shellRect = shell.getBoundingClientRect();
    const union = itemRects.reduce(
      (acc, rect) => ({
        left: Math.min(acc.left, rect.left),
        right: Math.max(acc.right, rect.right),
        top: Math.min(acc.top, rect.top),
        bottom: Math.max(acc.bottom, rect.bottom),
      }),
      itemRects[0]
    );

    return {
      left: (union.left + union.right) / 2 - shellRect.left,
      top: union.top - shellRect.top,
    };
  }, [getEquipmentClientRect, selectedEquipmentItems]);
  const selectionDragRect = selectionDrag
    ? normalizeClientRect(selectionDrag.startX, selectionDrag.startY, selectionDrag.currentX, selectionDrag.currentY)
    : null;
  const shellRect = mapShellRef.current?.getBoundingClientRect();

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
    <div
      ref={mapShellRef}
      className="flex-1 relative overflow-hidden"
      onPointerDownCapture={handleMapPointerDown}
      style={{
        cursor: activeTool === "measure" ? "crosshair" : activeTool === "area" ? "crosshair" : selectedEquipment ? "copy" : "grab",
      }}
    >
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

        {/* Drawn areas */}
        {areas.map((area) => {
          if (!area.bounds) return null;
          const isSelected = selectedArea?.id && area.id ? selectedArea.id === area.id : sameArea(selectedArea, area);
          return (
            <Rectangle
              key={area.id ?? `${area.label}-${area.areaM2}`}
              bounds={area.bounds}
              options={{
                fillColor: isSelected ? "#f59e0b" : "#e3e3e3",
                fillOpacity: 0.12,
                strokeColor: isSelected ? "#f59e0b" : "#e3e3e3",
                strokeWeight: isSelected ? 2 : 1,
                strokeOpacity: 0.9,
              }}
              onClick={() => onAreaSelected(area)}
            />
          );
        })}

        {/* Placed equipment */}
        {placedEquipment.map((item) => {
          const mpp = metersPerPixel(item.lat, zoom);
          const widthPx = clampVisualSize(item.equipment.lengthM / mpp);
          const heightPx = clampVisualSize(item.equipment.widthM / mpp);
          const isSelected = selectedPlacedIds.includes(item.id);
          const hasMultiSelection = selectedPlacedIds.length > 1;
          return (
            <OverlayView
              key={item.id}
              position={{ lat: item.lat, lng: item.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                data-equipment-overlay
                data-equipment-id={item.id}
                className="absolute select-none"
                style={{
                  width: widthPx,
                  height: heightPx,
                  transform: "translate(-50%, -50%)",
                  transformOrigin: "center",
                  zIndex: draggingPlacedId === item.id || isSelected || item.placementGroupId === autoPlacingGroupId ? 50 : 20,
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
                    if (event.ctrlKey) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedPlacedIds([item.id]);
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
                {isSelected && !hasMultiSelection && (
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
                        if (canRotateItems([item.id])) {
                          onRotateEquipment(item.id);
                        }
                      }}
                    >
                      <RotateCw size={13} />
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

      {selectionDragRect && shellRect && (
        <div
          className="absolute border border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.12)] pointer-events-none"
          style={{
            left: selectionDragRect.left - shellRect.left,
            top: selectionDragRect.top - shellRect.top,
            width: selectionDragRect.right - selectionDragRect.left,
            height: selectionDragRect.bottom - selectionDragRect.top,
          }}
        />
      )}

      {multiSelectionToolbar && (
        <div
          data-equipment-selection-toolbar
          className="absolute z-[70] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-[var(--border)] bg-[rgba(10,14,26,0.94)] px-1 py-0.5 shadow-xl"
          style={{ left: multiSelectionToolbar.left, top: multiSelectionToolbar.top - 8 }}
        >
          <span className="px-2 text-[10px] font-mono font-semibold text-white">
            {selectedPlacedIds.length} selected
          </span> 
          <button
            className="tooltip grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--accent-red)]"
            data-tip="Delete selected"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              selectedPlacedIds.forEach((id) => onDeleteEquipment(id));
              setSelectedPlacedIds([]);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

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
      {selectedEquipment && activeTool !== "measure" && activeTool !== "area" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[rgba(10,14,26,0.9)] border border-[var(--accent-cyan)] rounded-xl px-4 py-2 text-sm text-[var(--accent-cyan)] font-mono pointer-events-none animate-fade-in shadow-lg">
          Drag inside the square to place {selectedEquipment.name} side by side
        </div>
      )}

      {/* Fixed square zone overlay */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: FIXED_ZONE_SIZE_PX,
          height: FIXED_ZONE_SIZE_PX,
          border: "2px dashed rgba(255, 255, 255)",
          borderRadius: "2px", 
          backgroundColor: "rgba(255, 255, 255, 0.09)",
        }}
      />
    </div>
  );
}
