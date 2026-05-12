"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, MapPin, Loader } from "lucide-react";

interface LocationSearchProps {
  onLocationFound: (lat: number, lng: number, placeName: string) => void;
  mapRef: React.RefObject<google.maps.Map | null>;
}

interface PlacePredictionItem {
  place_id: string;
  description: string;
  main_text: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export default function LocationSearch({ onLocationFound, mapRef }: LocationSearchProps) {
  const [searchInput, setSearchInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlacePredictionItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize Places API services
  useEffect(() => {
    if (!mapRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new maps.places.AutocompleteService();
      placesServiceRef.current = new maps.places.PlacesService(mapRef.current);
      geocoderRef.current = new maps.Geocoder();
    }

    // Load recent searches from localStorage
    const saved = localStorage.getItem("geoplacer_recent_searches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, [mapRef]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !autocompleteServiceRef.current) {
        setSuggestions([]);
        return;
      }

      try {
        setIsLoading(true);
        const results = await autocompleteServiceRef.current.getPlacePredictions({
          input: query,
        } as any);
        setSuggestions((results.predictions as any) || []);
      } catch (error) {
        console.error("Autocomplete error:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const centerMapAndSave = useCallback(
    (lat: number, lng: number, name: string) => {
      const updated = [{ name, lat, lng }, ...recentSearches.filter((s) => s.name !== name)].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem("geoplacer_recent_searches", JSON.stringify(updated));

      if (mapRef.current) {
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(15);
      }

      onLocationFound(lat, lng, name);
      setSearchInput("");
      setSuggestions([]);
      setIsOpen(false);
    },
    [mapRef, onLocationFound, recentSearches]
  );

  const handleGeocodeSearch = useCallback(
    (query: string) => {
      if (!geocoderRef.current) return;

      setIsLoading(true);
      geocoderRef.current.geocode({ address: query }, (results, status) => {
        setIsLoading(false);
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const result = results[0];
          const lat = result.geometry.location.lat();
          const lng = result.geometry.location.lng();
          const name = result.formatted_address || query;
          centerMapAndSave(lat, lng, name);
        }
      });
    },
    [centerMapAndSave]
  );

  const handleSelectPlace = useCallback(
    (prediction: PlacePredictionItem) => {
      if (!placesServiceRef.current) return;

      setIsLoading(true);
      placesServiceRef.current.getDetails(
        { placeId: prediction.place_id, fields: ["geometry", "formatted_address"] } as any,
        (place: any, status: any) => {
          setIsLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const name = prediction.main_text;

            // Add to recent searches
            const updated = [
              { name, lat, lng },
              ...recentSearches.filter((s) => s.name !== name),
            ].slice(0, 8);
            setRecentSearches(updated);
            localStorage.setItem("geoplacer_recent_searches", JSON.stringify(updated));

            // Zoom to location
            if (mapRef.current) {
              mapRef.current.setCenter({ lat, lng });
              mapRef.current.setZoom(15);
            }

            onLocationFound(lat, lng, name);
            setSearchInput("");
            setSuggestions([]);
            setIsOpen(false);
          }
        }
      );
    },
    [centerMapAndSave]
  );

  const handleRecentClick = useCallback(
    (item: { name: string; lat: number; lng: number }) => {
      if (mapRef.current) {
        mapRef.current.setCenter({ lat: item.lat, lng: item.lng });
        mapRef.current.setZoom(15);
      }
      onLocationFound(item.lat, item.lng, item.name);
      setSearchInput("");
      setSuggestions([]);
      setIsOpen(false);
    },
    [mapRef, onLocationFound]
  );

  return (
    <div className="absolute top-4 right-4 z-10 w-96 max-w-full">
      <div className="relative">
        <form
          className="relative flex items-center bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            const query = searchInput.trim();
            if (!query) return;
            if (suggestions.length > 0) {
              handleSelectPlace(suggestions[0]);
            } else {
              handleGeocodeSearch(query);
            }
          }}
        >
          <MapPin size={16} className="ml-3 text-[var(--accent-cyan)] flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search city, road, country, or place..."
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              handleSearch(value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-[var(--text)] placeholder-[var(--muted)]"
          />
          {isLoading && <Loader size={16} className="mr-3 text-[var(--accent-cyan)] animate-spin" />}
          {searchInput && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSuggestions([]);
                setIsOpen(false);
              }}
              className="mr-2 p-1 hover:bg-[var(--surface-2)] rounded text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>
          )}
          {!searchInput && !isLoading && <Search size={16} className="mr-3 text-[var(--muted)]" />}
        </form>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg shadow-xl max-h-96 overflow-y-auto">
            {/* Recent searches */}
            {searchInput === "" && recentSearches.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider bg-[var(--surface-1)] border-b border-[var(--border)]">
                  Recent Searches
                </div>
                {recentSearches.map((item) => (
                  <button
                    key={`${item.lat}-${item.lng}`}
                    onClick={() => handleRecentClick(item)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-1)] transition-colors flex items-center gap-2 text-[var(--text)]"
                  >
                    <MapPin size={14} className="text-[var(--accent-cyan)] flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
                {suggestions.length > 0 && (
                  <div className="border-t border-[var(--border)]" />
                )}
              </>
            )}

            {/* Search results */}
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPlace(suggestion)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-1)] transition-colors flex items-center gap-2 text-[var(--text)]"
                >
                  <MapPin size={14} className="text-[var(--accent-cyan)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-[var(--text)]">{suggestion.main_text}</p>
                    <p className="truncate text-[10px] text-[var(--muted)]">{suggestion.description}</p>
                  </div>
                </button>
              ))
            ) : searchInput && !isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                Press Enter to search "{searchInput}" globally
              </div>
            ) : !searchInput && recentSearches.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                Start typing to search any place in the world
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
