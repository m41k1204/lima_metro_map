"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { MapView } from "@/components/MapView";
import { RouteSidebar } from "@/components/RouteSidebar";
import { findRoute } from "@/lib/routing";
import { buildGraph } from "@/lib/graph";
import { useWalkingRoutes } from "@/hooks/useWalkingRoutes";
import type { CustomPoint, LineNode, RouteEndpoint, RouteResult, StationNode } from "@/lib/types";

type Slot = "origin" | "destination";

export default function Home() {
  const { data: stationsData } = useQuery(trpc.stations.getAll.queryOptions());
  const { data: linesData } = useQuery(trpc.lines.getAll.queryOptions());

  const stations = useMemo<StationNode[]>(() => {
    if (!stationsData) return [];
    return (stationsData as any[]).map((s) => ({
      _id: s._id?.toString() ?? s.id,
      nombre: s.nombre,
      linea: s.linea,
      numero_linea: s.numero_linea,
      color: s.color,
      estado: s.estado,
      orden: s.orden,
      distrito: s.distrito,
      duracion_sig_min: s.duracion_sig_min,
      location: s.location,
    }));
  }, [stationsData]);

  const lines = useMemo<LineNode[]>(() => {
    if (!linesData) return [];
    return (linesData as any[]).map((l) => ({
      _id: l._id?.toString() ?? l.id,
      nombre: l.nombre,
      tipo: l.tipo,
      numero: l.numero,
      color: l.color,
      frecuencia_min: l.frecuencia_min ?? 6,
      ruta: l.ruta,
    }));
  }, [linesData]);

  // Grafo memoizado — se construye una sola vez cuando cargan los datos
  const graph = useMemo(
    () => (stations.length > 0 && lines.length > 0 ? buildGraph(stations, lines) : null),
    [stations, lines]
  );

  const [origin, setOrigin] = useState<RouteEndpoint | null>(null);
  const [destination, setDestination] = useState<RouteEndpoint | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot>("origin");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "found" | "notfound">("idle");

  useEffect(() => {
    if (origin && destination && graph) {
      const result = findRoute(stations, lines, origin, destination, graph);
      setRoute(result);
      setRouteStatus(result ? "found" : "notfound");
    } else {
      setRoute(null);
      setRouteStatus("idle");
    }
  }, [origin, destination, graph, stations, lines]);

  // OSRM walking geometries — centralizado aquí para compartir loading con el sidebar
  const { geometries: walkGeometries, loading: walkLoading } = useWalkingRoutes(route);

  // Reemplaza la duración de los segmentos de caminata con el tiempo real de OSRM
  const displayRoute = useMemo<RouteResult | null>(() => {
    if (!route) return null;
    if (walkGeometries.size === 0) return route;
    const segments = route.segments.map((seg, i) => {
      if (seg.type !== "walk") return seg;
      const geo = walkGeometries.get(i);
      if (!geo) return seg;
      return { ...seg, durationMinutes: geo.durationSeconds / 60 };
    });
    const walkMinutes = segments
      .filter((s) => s.type === "walk")
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    return {
      ...route,
      segments,
      walkMinutes,
      totalMinutes: route.waitMinutes + route.travelMinutes + walkMinutes,
    };
  }, [route, walkGeometries]);

  function handleStationClick(station: StationNode) {
    if (activeSlot === "origin") {
      setOrigin(station);
      setActiveSlot("destination");
    } else {
      setDestination(station);
      setActiveSlot("origin");
    }
  }

  function handleMapPointClick(coords: [number, number]) {
    const point: CustomPoint = {
      _id: activeSlot === "origin" ? "__custom_origin__" : "__custom_dest__",
      nombre: "Punto en el mapa",
      coordinates: coords,
      isCustom: true,
    };
    if (activeSlot === "origin") {
      setOrigin(point);
      setActiveSlot("destination");
    } else {
      setDestination(point);
      setActiveSlot("origin");
    }
  }

  function handleClear() {
    setOrigin(null);
    setDestination(null);
    setRoute(null);
    setActiveSlot("origin");
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <RouteSidebar
        stations={stations}
        lines={lines}
        route={displayRoute}
        routeStatus={routeStatus}
        origin={origin}
        destination={destination}
        activeSlot={activeSlot}
        walkLoading={walkLoading}
        onOriginChange={(s) => { setOrigin(s); if (s) setActiveSlot("destination"); }}
        onDestinationChange={(s) => { setDestination(s); if (s) setActiveSlot("origin"); }}
        onSlotChange={setActiveSlot}
        onClear={handleClear}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <MapView
          route={displayRoute}
          origin={origin}
          destination={destination}
          activeSlot={activeSlot}
          walkGeometries={walkGeometries}
          onStationClick={handleStationClick}
          onMapPointClick={handleMapPointClick}
        />
      </div>
    </div>
  );
}
