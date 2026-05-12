import type { MeasurePoint } from "@/types";

/** Haversine distance between two lat/lng points in meters */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000; // Earth radius in metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Total path distance for an array of points */
export function totalPathDistance(points: MeasurePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

/** Format meters to human-readable string */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(3)} km`;
  return `${meters.toFixed(1)} m`;
}

/** Format square meters to human-readable string */
export function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(4)} km²`;
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
  return `${m2.toFixed(1)} m²`;
}

/** Metres → feet */
export function metersToFeet(m: number): number {
  return m * 3.28084;
}

/** Compute bounding box area from Google Maps bounds (approx rectangular) */
export function boundsToAreaMeters(
  ne: { lat: number; lng: number },
  sw: { lat: number; lng: number }
): { areaM2: number; widthM: number; heightM: number } {
  const nw = { lat: ne.lat, lng: sw.lng };
  const se = { lat: sw.lat, lng: ne.lng };
  const widthM = haversineDistance(sw, se);
  const heightM = haversineDistance(sw, nw);
  return { areaM2: widthM * heightM, widthM, heightM };
}

/** Shoelace formula for polygon area in m² from lat/lng path */
export function polygonArea(
  path: Array<{ lat: number; lng: number }>
): number {
  if (path.length < 3) return 0;
  // Convert to approximate flat coordinates (metres) using first point as origin
  const origin = path[0];
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pts = path.map((p) => ({
    x: (p.lng - origin.lng) * toRad(1) * R * Math.cos(toRad(origin.lat)),
    y: (p.lat - origin.lat) * toRad(1) * R,
  }));
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += pts[j].x * pts[i].y;
    area -= pts[i].x * pts[j].y;
  }
  return Math.abs(area / 2);
}

export function polygonBounds(path: Array<{ lat: number; lng: number }>) {
  return path.reduce(
    (bounds, point) => ({
      north: Math.max(bounds.north, point.lat),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      west: Math.min(bounds.west, point.lng),
    }),
    {
      north: -Infinity,
      south: Infinity,
      east: -Infinity,
      west: Infinity,
    }
  );
}

export function polygonCenter(path: Array<{ lat: number; lng: number }>) {
  if (path.length === 0) return { lat: 0, lng: 0 };
  return {
    lat: path.reduce((sum, p) => sum + p.lat, 0) / path.length,
    lng: path.reduce((sum, p) => sum + p.lng, 0) / path.length,
  };
}

export function boundsDimensionsMeters(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}) {
  const widthM = haversineDistance(
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east }
  );
  const heightM = haversineDistance(
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.north, lng: bounds.west }
  );
  return {
    widthM: Math.max(widthM, heightM),
    heightM: Math.min(widthM, heightM),
  };
}

export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Format distance with unit system support */
export function formatDistanceWithUnits(
  meters: number,
  unitSystem: "metric" | "imperial" | "mixed"
): string {
  switch (unitSystem) {
    case "metric":
      if (meters >= 1000) return `${(meters / 1000).toFixed(3)} km`;
      return `${meters.toFixed(1)} m`;

    case "imperial": {
      const feet = metersToFeet(meters);
      if (feet >= 5280) return `${(feet / 5280).toFixed(3)} mi`;
      return `${feet.toFixed(1)} ft`;
    }

    case "mixed":
      if (meters >= 1000) {
        const feet = metersToFeet(meters);
        return `${(feet / 5280).toFixed(3)} mi (${(meters / 1000).toFixed(3)} km)`;
      }
      return `${meters.toFixed(1)} m (${metersToFeet(meters).toFixed(1)} ft)`;

    default:
      return `${meters.toFixed(1)} m`;
  }
}

/** Format area with unit system support */
export function formatAreaWithUnits(
  m2: number,
  unitSystem: "metric" | "imperial" | "mixed"
): string {
  switch (unitSystem) {
    case "metric":
      if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(4)} km²`;
      if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
      return `${m2.toFixed(1)} m²`;

    case "imperial": {
      const sqFeet = m2 * 10.764;
      const sqMiles = sqFeet / 27_878_400;
      if (sqMiles >= 0.01) return `${sqMiles.toFixed(6)} mi²`;
      return `${sqFeet.toFixed(1)} ft²`;
    }

    case "mixed":
      if (m2 >= 10_000) {
        const sqFeet = m2 * 10.764;
        return `${(m2 / 10_000).toFixed(2)} ha (${(sqFeet / 43_560).toFixed(2)} acres)`;
      }
      const sqFeet = m2 * 10.764;
      return `${m2.toFixed(1)} m² (${sqFeet.toFixed(1)} ft²)`;

    default:
      return `${m2.toFixed(1)} m²`;
  }
}
