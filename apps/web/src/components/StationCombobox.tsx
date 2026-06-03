"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { StationNode } from "@/lib/types";

type Props = {
  stations: StationNode[];
  value: StationNode | null;
  onChange: (s: StationNode | null) => void;
  placeholder: string;
  disabled?: boolean;
  active?: boolean; // slot activo esperando click del mapa
};

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function StationCombobox({ stations, value, onChange, placeholder, disabled, active }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.length === 0
    ? []
    : stations.filter((s) => normalize(s.nombre).includes(normalize(query))).slice(0, 10);

  // Sincronizar input con valor externo
  useEffect(() => {
    if (value) setQuery(value.nombre);
    else setQuery("");
  }, [value]);

  const select = useCallback((s: StationNode) => {
    onChange(s);
    setOpen(false);
    setFocusedIndex(-1);
  }, [onChange]);

  const clear = useCallback(() => {
    onChange(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      select(filtered[focusedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={cn(
        "flex items-center gap-2 rounded border bg-background px-2.5 h-8 transition-colors",
        active && "border-blue-500 ring-1 ring-blue-500/50",
        disabled && "opacity-50 pointer-events-none"
      )}>
        {value && (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: value.color }}
          />
        )}
        <input
          ref={inputRef}
          className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder={active ? "Haz click en el mapa..." : placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => { if (query && !value) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground text-xs leading-none"
            aria-label="Limpiar"
          >
            ✕
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded border bg-popover shadow-md max-h-52 overflow-y-auto">
          {filtered.map((s, i) => (
            <li
              key={s._id}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer",
                i === focusedIndex ? "bg-accent" : "hover:bg-accent"
              )}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.nombre}</span>
              <span className="ml-auto text-muted-foreground truncate">{s.linea}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
