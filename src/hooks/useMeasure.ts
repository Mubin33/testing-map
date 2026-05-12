import { useCallback, useState } from "react";
import { haversineDistance, totalPathDistance } from "@/utils/geoUtils";
import type { MeasurePoint, MeasureSegment } from "@/types";

let counter = 0;
const uid = () => `mp-${++counter}`;

export function useMeasure() {
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const addPoint = useCallback((lat: number, lng: number) => {
    setPoints((prev) => (isComplete ? [{ id: uid(), lat, lng }] : [...prev, { id: uid(), lat, lng }]));
    if (isComplete) setIsComplete(false);
  }, [isComplete]);

  const closePolygon = useCallback(() => {
    setPoints((prev) => {
      if (prev.length < 3) return prev;
      setIsComplete(true);
      return prev;
    });
  }, []);

  const removeLastPoint = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
    setIsComplete(false);
  }, []);

  const clearPoints = useCallback(() => {
    setPoints([]);
    setIsComplete(false);
  }, []);

  const hydrate = useCallback((nextPoints: MeasurePoint[], nextIsComplete: boolean) => {
    setPoints(nextPoints);
    setIsComplete(nextIsComplete && nextPoints.length >= 3);
  }, []);

  const segments: MeasureSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    segments.push({
      from: points[i - 1],
      to: points[i],
      distanceM: haversineDistance(points[i - 1], points[i]),
    });
  }
  if (isComplete && points.length >= 3) {
    segments.push({
      from: points[points.length - 1],
      to: points[0],
      distanceM: haversineDistance(points[points.length - 1], points[0]),
    });
  }

  const totalM =
    totalPathDistance(points) +
    (isComplete && points.length >= 3
      ? haversineDistance(points[points.length - 1], points[0])
      : 0);

  return { points, segments, totalM, isComplete, addPoint, closePolygon, removeLastPoint, clearPoints, hydrate };
}
