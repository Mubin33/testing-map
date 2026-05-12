import { useCallback, useState } from "react";
import type { Equipment, EquipmentCategory } from "@/types";

const PRESETS: Equipment[] = [
  { id: "shipping-container", name: "Shipping Container", emoji: "📦", lengthM: 6.1, widthM: 2.44, color: "#f59e0b", category: "container" },
  { id: "large-container", name: "Large Container (40ft)", emoji: "🗃️", lengthM: 12.2, widthM: 2.44, color: "#f97316", category: "container" },
  { id: "suv", name: "SUV / Car", emoji: "🚗", imageSrc: "/car.png", lengthM: 4.5, widthM: 1.9, color: "#06b6d4", category: "vehicle" },
  { id: "truck", name: "Delivery Truck", emoji: "🚛", lengthM: 8.0, widthM: 2.6, color: "#3b82f6", category: "vehicle" },
  { id: "tent-small", name: "Event Tent (5×5)", emoji: "⛺", lengthM: 5.0, widthM: 5.0, color: "#8b5cf6", category: "structure" },
  { id: "tent-large", name: "Event Tent (10×10)", emoji: "🎪", lengthM: 10.0, widthM: 10.0, color: "#a855f7", category: "structure" },
  { id: "rack", name: "Warehouse Rack", emoji: "🗄️", lengthM: 2.7, widthM: 1.0, color: "#10b981", category: "storage" },
  { id: "pallet", name: "Euro Pallet", emoji: "📋", lengthM: 1.2, widthM: 0.8, color: "#84cc16", category: "storage" },
];

let cid = 0;

export function useEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>(PRESETS);
  const [selected, setSelected] = useState<Equipment | null>(null);

  const select = useCallback((eq: Equipment) => setSelected(eq), []);
  const deselect = useCallback(() => setSelected(null), []);

  const addCustom = useCallback(
    (name: string, lengthM: number, widthM: number, emoji = "📐") => {
      const id = `custom-${++cid}`;
      const item: Equipment = {
        id,
        name,
        emoji,
        lengthM,
        widthM,
        color: "#e2e8f0",
        category: "custom" as EquipmentCategory,
      };
      setEquipment((prev) => [...prev, item]);
      setSelected(item);
    },
    []
  );

  const remove = useCallback((id: string) => {
    setEquipment((prev) => prev.filter((e) => e.id !== id));
    setSelected((prev) => (prev?.id === id ? null : prev));
  }, []);

  const update = useCallback((id: string, patch: Partial<Equipment>) => {
    setEquipment((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const hydrate = useCallback((nextEquipment: Equipment[], selectedEquipmentId: string | null) => {
    setEquipment(nextEquipment);
    setSelected(nextEquipment.find((e) => e.id === selectedEquipmentId) ?? null);
  }, []);

  const categorized = {
    container: equipment.filter((e) => e.category === "container"),
    vehicle: equipment.filter((e) => e.category === "vehicle"),
    structure: equipment.filter((e) => e.category === "structure"),
    storage: equipment.filter((e) => e.category === "storage"),
    custom: equipment.filter((e) => e.category === "custom"),
  };

  return { equipment, selected, categorized, select, deselect, addCustom, remove, update, hydrate };
}
