"use client";
import { useState, useRef, useEffect } from "react";
import { MapPin, X } from "lucide-react";

export const TOP_CITIES = [
  // Remote
  "Remote", "Remote - India", "Remote - USA", "Remote - UK",
  "Remote - Europe", "Remote - APAC", "Remote - Global", "Worldwide Remote",
  // India — Tier 1
  "Bangalore, India", "Mumbai, India", "Hyderabad, India", "Chennai, India",
  "Pune, India", "Delhi, India", "Gurgaon, India", "Noida, India",
  "Kolkata, India",
  // India — Tier 2
  "Ahmedabad, India", "Kochi, India", "Coimbatore, India", "Jaipur, India",
  "Chandigarh, India", "Indore, India", "Nagpur, India", "Bhubaneswar, India",
  "Visakhapatnam, India", "Mysore, India", "Surat, India", "Lucknow, India",
  "Thiruvananthapuram, India", "Mangalore, India",
  // USA
  "San Francisco, CA, USA", "New York, NY, USA", "Seattle, WA, USA",
  "Austin, TX, USA", "Boston, MA, USA", "Chicago, IL, USA",
  "Los Angeles, CA, USA", "Denver, CO, USA", "Atlanta, GA, USA",
  "San Jose, CA, USA", "Dallas, TX, USA", "Washington DC, USA",
  "Raleigh, NC, USA", "Minneapolis, MN, USA", "Portland, OR, USA",
  "Phoenix, AZ, USA", "Miami, FL, USA", "Pittsburgh, PA, USA",
  // UK
  "London, UK", "Manchester, UK", "Edinburgh, UK", "Bristol, UK",
  "Birmingham, UK", "Leeds, UK", "Cambridge, UK", "Oxford, UK",
  "Glasgow, UK", "Belfast, UK",
  // Europe
  "Amsterdam, Netherlands", "Berlin, Germany", "Munich, Germany",
  "Paris, France", "Dublin, Ireland", "Stockholm, Sweden",
  "Zurich, Switzerland", "Warsaw, Poland", "Copenhagen, Denmark",
  "Vienna, Austria", "Madrid, Spain", "Barcelona, Spain",
  "Lisbon, Portugal", "Prague, Czech Republic", "Bucharest, Romania",
  // APAC & Others
  "Singapore", "Sydney, Australia", "Melbourne, Australia",
  "Toronto, Canada", "Vancouver, Canada", "Tokyo, Japan",
  "Kuala Lumpur, Malaysia", "Dubai, UAE", "Tel Aviv, Israel",
  "Cape Town, South Africa", "São Paulo, Brazil",
];

interface LocationAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void; // fired only when user picks from dropdown
  placeholder?: string;
  className?: string;
  id?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "e.g. Bangalore, India",
  className = "",
  id,
}: LocationAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState(-1);

  // Sync external value → internal query
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = query.trim().length === 0
    ? TOP_CITIES.slice(0, 8)
    : TOP_CITIES.filter(c =>
        c.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);

  const handleSelect = (city: string) => {
    setQuery(city);
    onChange(city);
    onSelect?.(city);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          className="input pl-8 pr-7"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); onChange(""); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto rounded-xl shadow-2xl shadow-black/50 py-1"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-hover)",
            backdropFilter: "blur(20px)",
          }}
        >
          {suggestions.map((city, i) => (
            <li
              key={city}
              onMouseDown={() => handleSelect(city)}
              onMouseEnter={() => setHighlighted(i)}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors"
              style={
                i === highlighted
                  ? {
                      background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                      color: "var(--accent-bright)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--accent)" }} />
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
