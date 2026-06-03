"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Footprints, Clock, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StationCombobox } from "@/components/StationCombobox";
import { cn } from "@/lib/utils";
import type { LineNode, RouteEndpoint, RouteResult, StationNode } from "@/lib/types";
import { isCustomPoint } from "@/lib/types";

type Slot = "origin" | "destination";

type Props = {
  stations: StationNode[];
  lines: LineNode[];
  route: RouteResult | null;
  routeStatus: "idle" | "found" | "notfound";
  origin: RouteEndpoint | null;
  destination: RouteEndpoint | null;
  activeSlot: Slot;
  walkLoading: boolean;
  onOriginChange: (s: StationNode | null) => void;
  onDestinationChange: (s: StationNode | null) => void;
  onSlotChange: (slot: Slot) => void;
  onClear: () => void;
};

function CustomPointSlot({ label, onClear, active }: { label: string; onClear: () => void; active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded border bg-background px-2.5 h-8 transition-colors",
      active && "border-blue-500 ring-1 ring-blue-500/50"
    )}>
      <span className="text-base leading-none">📍</span>
      <span className="flex-1 text-xs truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground text-xs leading-none"
        aria-label="Limpiar"
      >
        ✕
      </button>
    </div>
  );
}

function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function RouteSidebar({
  stations,
  lines: _lines,
  route,
  routeStatus,
  origin,
  destination,
  activeSlot,
  walkLoading,
  onOriginChange,
  onDestinationChange,
  onSlotChange,
  onClear,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex h-full shrink-0">
      {/* Panel */}
      <div
        className={cn(
          "flex flex-col bg-background border-r shadow-md transition-all duration-200 overflow-hidden",
          collapsed ? "w-0" : "w-72"
        )}
      >
        <div className="flex flex-col gap-3 p-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Planifica tu ruta
          </p>

          {/* Slot origen */}
          <div className="flex flex-col gap-1">
            <label
              className={cn(
                "text-xs font-medium flex items-center gap-1.5 cursor-pointer",
                activeSlot === "origin" && "text-blue-500"
              )}
              onClick={() => onSlotChange("origin")}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Origen
            </label>
            {origin && isCustomPoint(origin) ? (
              <CustomPointSlot
                label="Punto en el mapa"
                onClear={() => { onOriginChange(null); onSlotChange("origin"); }}
                active={activeSlot === "origin"}
              />
            ) : (
              <StationCombobox
                stations={stations}
                value={origin as StationNode | null}
                onChange={(s) => { onOriginChange(s); if (s) onSlotChange("destination"); }}
                placeholder="Buscar estación..."
                active={activeSlot === "origin"}
              />
            )}
          </div>

          {/* Slot destino */}
          <div className="flex flex-col gap-1">
            <label
              className={cn(
                "text-xs font-medium flex items-center gap-1.5 cursor-pointer",
                activeSlot === "destination" && "text-blue-500"
              )}
              onClick={() => onSlotChange("destination")}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Destino
            </label>
            {destination && isCustomPoint(destination) ? (
              <CustomPointSlot
                label="Punto en el mapa"
                onClear={() => { onDestinationChange(null); onSlotChange("destination"); }}
                active={activeSlot === "destination"}
              />
            ) : (
              <StationCombobox
                stations={stations}
                value={destination as StationNode | null}
                onChange={(s) => { onDestinationChange(s); if (s) onSlotChange("origin"); }}
                placeholder="Buscar estación..."
                active={activeSlot === "destination"}
              />
            )}
          </div>

          {(origin || destination || route) && (
            <Button variant="outline" size="sm" onClick={onClear} className="w-full">
              Limpiar
            </Button>
          )}
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto">
          {routeStatus === "idle" && !(origin && destination) && (
            <div className="p-3 text-xs text-muted-foreground leading-relaxed">
              Selecciona un origen y un destino. Puedes hacer click en cualquier punto del mapa.
            </div>
          )}

          {routeStatus === "notfound" && (
            <div className="p-3 flex flex-col gap-1.5">
              <p className="text-xs font-medium text-destructive">No se encontró una ruta</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Los puntos seleccionados pueden estar demasiado lejos de cualquier estación (más de 800 m) o en líneas sin conexión entre sí.
              </p>
            </div>
          )}

          {route && walkLoading && (
            <div className="px-3 pt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Calculando ruta peatonal…
            </div>
          )}

          {route && (
            <div className="p-3 flex flex-col gap-3">
              {/* Resumen */}
              <div className="rounded border bg-muted/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {formatMinutes(route.totalMinutes)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>🚇 {formatMinutes(route.travelMinutes)} en vehículo</span>
                  <span>⏱ {formatMinutes(route.waitMinutes)} espera</span>
                  {route.walkMinutes > 0 && (
                    <span>🚶 {formatMinutes(route.walkMinutes)} caminando</span>
                  )}
                  <span>
                    <ArrowLeftRight className="size-3 inline mr-0.5" />
                    {route.transfers} {route.transfers === 1 ? "transbordo" : "transbordos"}
                  </span>
                </div>
              </div>

              {/* Segmentos */}
              <div className="flex flex-col gap-2">
                {route.segments.map((seg, i) => (
                  <div key={i} className="flex gap-2">
                    {/* Línea vertical */}
                    <div className="flex flex-col items-center pt-1">
                      <div
                        className="h-3 w-3 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: seg.type === "walk" ? "#888" : (seg.color ?? "#888") }}
                      />
                      {i < route.segments.length - 1 && (
                        <div
                          className={cn("w-0.5 flex-1 mt-1", seg.type === "walk" && "border-l-2 border-dashed border-gray-400")}
                          style={seg.type === "metro" ? { backgroundColor: seg.color ?? "#888" } : {}}
                        />
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 pb-2">
                      {seg.type === "metro" ? (
                        <>
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: seg.color ?? "#888" }}
                            />
                            {seg.linea}
                            <span className="ml-auto text-muted-foreground">
                              {formatMinutes(seg.durationMinutes)}
                            </span>
                          </div>
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {seg.stations.map((s) => (
                              <li key={s._id} className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="size-2.5 shrink-0" />
                                {s.nombre}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Footprints className="size-3 shrink-0" />
                          Caminar hasta {seg.stations[seg.stations.length - 1]?.nombre}
                          <span className="ml-auto">{formatMinutes(seg.durationMinutes)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Destino final */}
                {route.segments.length > 0 && (() => {
                  const lastSeg = route.segments[route.segments.length - 1];
                  const lastStation = lastSeg.stations[lastSeg.stations.length - 1];
                  return lastStation ? (
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center pt-1">
                        <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                      </div>
                      <div className="text-xs font-medium pt-0.5">{lastStation.nombre}</div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 flex h-10 w-5 items-center justify-center rounded-r border border-l-0 bg-background shadow-md hover:bg-muted transition-colors"
        aria-label={collapsed ? "Abrir panel" : "Cerrar panel"}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
      </button>
    </div>
  );
}
