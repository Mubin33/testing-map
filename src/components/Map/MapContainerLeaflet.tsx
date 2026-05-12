"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer as RawMapContainer,
  TileLayer as RawTileLayer,
  Marker as RawMarker,
  Popup as RawPopup,
  Polyline as RawPolyline,
  Polygon as RawPolygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.pm";
import "leaflet/dist/leaflet.css";
import { CopyPlus, RotateCw, Trash2 } from "lucide-react";
import { boundsToAreaMeters } from "@/utils/geoUtils";

import type { MapView, PlacedEquipment } from "../../types";

const LeafletMap: any = RawMapContainer;
const TileLayer: any = RawTileLayer;
const Marker: any = RawMarker;
const Popup: any = RawPopup;
const Polyline: any = RawPolyline;
const Polygon: any = RawPolygon;

interface Props {
  [key: string]: any;
  mapView?: MapView;
  onMapViewChange?: (v: MapView) => void;
  placedEquipment?: PlacedEquipment[];
  activeTool?: string;
}

function MapSetter({ mapView }: { mapView?: MapView }) {
  const map = useMap();

  useEffect(() => {
    if (!mapView) return;
    map.setView([mapView.center.lat, mapView.center.lng], mapView.zoom);
  }, [map, mapView?.center?.lat, mapView?.center?.lng, mapView?.zoom]);

  return null;
}

function MapEvents({ onMapViewChange }: { onMapViewChange?: (v: MapView) => void }) {
  useMapEvents({
    moveend(e: any) {
      const m = e.target;
      const center = m.getCenter();
      onMapViewChange?.({ center: { lat: center.lat, lng: center.lng }, zoom: m.getZoom() });
    },
    zoomend(e: any) {
      const m = e.target;
      const center = m.getCenter();
      onMapViewChange?.({ center: { lat: center.lat, lng: center.lng }, zoom: m.getZoom() });
    },
  });

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (e: any) => void }) {
  useMapEvents({
    click(e: any) {
      onMapClick?.(e);
    },
  });

  return null;
}

function AreaDrawingLayer({
  activeTool,
  onAreaSelected,
}: {
  activeTool?: string;
  onAreaSelected?: (area: any) => void;
}) {
  const map = useMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<any | null>(null);
  const rectRef = useRef<any | null>(null);

  useEffect(() => {
    if (activeTool === "area") map.dragging.disable();
    else map.dragging.enable();
    return () => map.dragging.enable();
  }, [activeTool, map]);

  useMapEvents({
    mousedown(e: any) {
      if (activeTool !== "area") return;
      e.originalEvent.preventDefault();
      setIsDrawing(true);
      setDrawStart(e.latlng);
    },
    mousemove(e: any) {
      if (!isDrawing || !drawStart) return;
      const bounds = L.latLngBounds(drawStart, e.latlng);
      if (rectRef.current) map.removeLayer(rectRef.current);
      rectRef.current = L.rectangle(bounds, { color: "#f59e0b", weight: 2, fillOpacity: 0.15 });
      rectRef.current.addTo(map);
    },
    mouseup() {
      if (!isDrawing || !rectRef.current) return;
      setIsDrawing(false);
      setDrawStart(null);

      const bounds = rectRef.current.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const computed = boundsToAreaMeters(
        { lat: ne.lat, lng: ne.lng },
        { lat: sw.lat, lng: sw.lng }
      );

      onAreaSelected?.({
        type: "rectangle",
        areaM2: computed.areaM2,
        widthM: computed.widthM,
        heightM: computed.heightM,
        label: `${Math.max(computed.widthM, computed.heightM).toFixed(1)}m x ${Math.min(
          computed.widthM,
          computed.heightM
        ).toFixed(1)}m`,
        bounds: { north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng },
        center: { lat: bounds.getCenter().lat, lng: bounds.getCenter().lng },
      });

      map.removeLayer(rectRef.current);
      rectRef.current = null;
    },
  });

  return null;
}

export default function MapContainerLeaflet({
  mapView,
  onMapViewChange,
  placedEquipment = [],
  activeTool = "pan",
  onMapClick,
  onAreaSelected,
  measurePoints = [],
  selectedArea,
  onMoveEquipment,
  onPlaceEquipment,
  onRotateEquipment,
  onDuplicateEquipment,
  onDeleteEquipment,
  pendingEquipmentDrop,
  onPendingEquipmentDropHandled,
  onMeasurePointClick,
}: Props) {
  const defaultCenter = mapView?.center ?? { lat: 0, lng: 0 };
  const defaultZoom = mapView?.zoom ?? 2;
  const mapRef = useRef<any | null>(null);
  const rectRef = useRef<any | null>(null);
  const [draggingPlacedId, setDraggingPlacedId] = useState<string | null>(null);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);

  const pointIsInsideSelectedArea = useCallback(
    (point: { lat: number; lng: number }) => {
      if (!selectedArea?.bounds) return true;
      return (
        point.lat <= selectedArea.bounds.north &&
        point.lat >= selectedArea.bounds.south &&
        point.lng <= selectedArea.bounds.east &&
        point.lng >= selectedArea.bounds.west
      );
    },
    [selectedArea]
  );

  const handleMapClick = useCallback(
    (e: any) => {
      setSelectedPlacedId(null);
      if (activeTool !== "measure") return;
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
    [activeTool, onMapClick]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!selectedArea || selectedArea.type !== "rectangle" || !selectedArea.bounds) {
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
      return;
    }

    const bounds = L.latLngBounds(
      [selectedArea.bounds.south, selectedArea.bounds.west],
      [selectedArea.bounds.north, selectedArea.bounds.east]
    );

    if (!rectRef.current) {
      const rect = L.rectangle(bounds, {
        color: "#e3e3e3",
        weight: 2,
        fillOpacity: 0.15,
      });
      rect.addTo(map);
      rectRef.current = rect;

      try {
        (rect as any).pm?.enable({ snappable: false });
      } catch (err) {}

      const syncHandler = () => {
        const b = rect.getBounds();
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const computed = boundsToAreaMeters(
          { lat: ne.lat, lng: ne.lng },
          { lat: sw.lat, lng: sw.lng }
        );
        onAreaSelected?.({
          type: "rectangle",
          areaM2: computed.areaM2,
          widthM: computed.widthM,
          heightM: computed.heightM,
          label: `${Math.max(computed.widthM, computed.heightM).toFixed(1)}m x ${Math.min(
            computed.widthM,
            computed.heightM
          ).toFixed(1)}m`,
          bounds: { north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng },
          center: { lat: b.getCenter().lat, lng: b.getCenter().lng },
        });
      };

      rect.on("drag", syncHandler);
      rect.on("edit", syncHandler);
    } else {
      rectRef.current.setBounds(bounds);
      try {
        (rectRef.current as any).pm?.enable({ snappable: false });
      } catch (err) {}
    }
  }, [selectedArea, onAreaSelected]);

  useEffect(() => {
    if (!pendingEquipmentDrop || !mapRef.current) return;
    const map = mapRef.current;
    const rect = map.getContainer().getBoundingClientRect();
    const latlng = map.containerPointToLatLng([
      pendingEquipmentDrop.clientX - rect.left,
      pendingEquipmentDrop.clientY - rect.top,
    ]);

    if (latlng) {
      const pt = { lat: latlng.lat, lng: latlng.lng };
      if (pointIsInsideSelectedArea(pt)) {
        onPlaceEquipment?.(pendingEquipmentDrop.equipment, pt.lat, pt.lng);
      }
    }

    onPendingEquipmentDropHandled?.();
  }, [pendingEquipmentDrop, pointIsInsideSelectedArea, onPlaceEquipment, onPendingEquipmentDropHandled]);

  useEffect(() => {
    if (!draggingPlacedId || !mapRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      const rect = map.getContainer().getBoundingClientRect();
      const latlng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
      if (latlng && pointIsInsideSelectedArea({ lat: latlng.lat, lng: latlng.lng })) {
        onMoveEquipment?.(draggingPlacedId, latlng.lat, latlng.lng);
      }
    };

    const handleMouseUp = () => setDraggingPlacedId(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingPlacedId, pointIsInsideSelectedArea, onMoveEquipment]);

  return (
    <div className="h-full w-full" style={{ position: "relative", zIndex: 0 }}>
      <LeafletMap
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={defaultZoom}
        className="h-full w-full"
        style={{ position: "relative", zIndex: 0 }}
        whenCreated={(m: any) => (mapRef.current = m)}
      >
        <MapSetter mapView={mapView} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents onMapViewChange={onMapViewChange} />
        <AreaDrawingLayer activeTool={activeTool} onAreaSelected={onAreaSelected} />
        <MapClickHandler onMapClick={handleMapClick} />

        {measurePoints.length >= 2 && (
          <Polyline
            positions={measurePoints.map((p: any) => [p.lat, p.lng])}
            pathOptions={{ color: "#f59e0b", weight: 2.5 }}
          />
        )}
        {measurePoints.length >= 3 && (
          <Polygon
            positions={measurePoints.map((p: any) => [p.lat, p.lng])}
            pathOptions={{ color: "#f59e0b", weight: 2.5, fill: false }}
          />
        )}

        {measurePoints.map((pt: any, i: number) => (
          <Marker
            key={pt.id}
            position={[pt.lat, pt.lng]}
            icon={L.divIcon({
              className: "measure-marker",
              html: `<div style="width: 14px; height: 14px; background: ${
                i === 0 ? "#06b6d4" : "#f59e0b"
              }; border: 2px solid #0a0e1a; border-radius: 50%; cursor: pointer;"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }) as any}
            eventHandlers={{
              click: () => {
                if (activeTool === "measure" && measurePoints.length >= 3) {
                  onMeasurePointClick?.(pt.id);
                }
              },
            }}
          />
        ))}

        {placedEquipment.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            draggable={true as any}
            icon={L.divIcon({
              className: "equipment-marker",
              html: `<div style="font-size: 20px; line-height: 1;">${item.equipment?.emoji ?? "📍"}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            }) as any}
            eventHandlers={{
              dragstart: () => {
                setSelectedPlacedId(item.id);
                setDraggingPlacedId(item.id);
              },
              dragend: (e: any) => {
                const latlng = e.target.getLatLng();
                onMoveEquipment?.(item.id, latlng.lat, latlng.lng);
                setDraggingPlacedId(null);
              },
              click: () => setSelectedPlacedId(item.id),
            }}
          >
            {selectedPlacedId === item.id && (
              <Popup closeButton={false as any} autoClose={false as any}>
                <div className="flex gap-1 p-1">
                  <button onClick={() => onRotateEquipment?.(item.id)} className="p-1 hover:bg-gray-200 rounded" title="Rotate">
                    <RotateCw size={14} />
                  </button>
                  <button onClick={() => onDuplicateEquipment?.(item.id)} className="p-1 hover:bg-gray-200 rounded" title="Duplicate">
                    <CopyPlus size={14} />
                  </button>
                  <button onClick={() => onDeleteEquipment?.(item.id)} className="p-1 hover:bg-gray-200 rounded" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </LeafletMap>
    </div>
  );
}
