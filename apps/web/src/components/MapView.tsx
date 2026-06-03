"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import { trpc } from "@/utils/trpc";
import { buildRouteGeoJSON } from "@/lib/routing";
import type { CustomPoint, RouteEndpoint, RouteResult, StationNode } from "@/lib/types";
import { isCustomPoint } from "@/lib/types";
import type { WalkGeometries } from "@/hooks/useWalkingRoutes";

const LIMA_CENTER = {
  longitude: -77.0428,
  latitude: -12.0464,
  zoom: 12,
};

const TILE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type HoverInfo = {
  longitude: number;
  latitude: number;
  nombre: string;
};

type StationInfo = {
  longitude: number;
  latitude: number;
  nombre: string;
  linea: string;
  color: string;
  estado: string;
  distrito: string;
  stationNode: StationNode;
};

type Props = {
  route: RouteResult | null;
  origin: RouteEndpoint | null;
  destination: RouteEndpoint | null;
  activeSlot: "origin" | "destination";
  walkGeometries: WalkGeometries;
  onStationClick: (station: StationNode) => void;
  onMapPointClick: (coords: [number, number]) => void;
};

export function MapView({ route, origin, destination, activeSlot, walkGeometries, onStationClick, onMapPointClick }: Props) {
  const mapRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);

  const { data: linesData } = useQuery(trpc.lines.getAll.queryOptions());
  const { data: stationsData } = useQuery(trpc.stations.getAll.queryOptions());

  const stationMap = useMemo(() => {
    const result = new globalThis.Map<string, StationNode>();
    if (!stationsData) return result;
    for (const s of stationsData as any[]) {
      const node: StationNode = {
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
      };
      result.set(node._id, node);
    }
    return result;
  }, [stationsData]);

  const lineMap = useMemo(() => {
    const result = new globalThis.Map<string, import("@/lib/types").LineNode>();
    if (!linesData) return result;
    for (const l of linesData as any[]) {
      result.set(l.nombre, {
        _id: l._id?.toString() ?? l.id,
        nombre: l.nombre,
        tipo: l.tipo,
        numero: l.numero,
        color: l.color,
        frecuencia_min: l.frecuencia_min ?? 6,
        ruta: l.ruta,
      });
    }
    return result;
  }, [linesData]);

  const linesGeoJSON = useMemo(() => {
    if (!linesData) return null;
    return {
      type: "FeatureCollection" as const,
      features: (linesData as any[]).map((line) => ({
        type: "Feature" as const,
        properties: {
          nombre: line.nombre,
          tipo: line.tipo,
          numero: line.numero,
          color: line.color,
          estado: line.estado,
          estilo_linea: line.estilo_linea,
        },
        geometry: line.ruta,
      })),
    };
  }, [linesData]);

  const stationsGeoJSON = useMemo(() => {
    if (!stationsData) return null;
    return {
      type: "FeatureCollection" as const,
      features: (stationsData as any[]).map((station) => ({
        type: "Feature" as const,
        properties: {
          id: station._id?.toString() ?? station.id,
          nombre: station.nombre,
          linea: station.linea,
          color: station.color,
          estado: station.estado,
          distrito: station.distrito,
          isOrigin: origin?._id === (station._id?.toString() ?? station.id),
          isDestination: destination?._id === (station._id?.toString() ?? station.id),
        },
        geometry: station.location,
      })),
    };
  }, [stationsData, origin, destination]);

  // GeoJSON de pins personalizados (origen/destino no-estación)
  const customPinsGeoJSON = useMemo(() => {
    const features: GeoJSON.Feature[] = [];
    if (origin && isCustomPoint(origin)) {
      features.push({
        type: "Feature",
        properties: { role: "origin" },
        geometry: { type: "Point", coordinates: origin.coordinates },
      });
    }
    if (destination && isCustomPoint(destination)) {
      features.push({
        type: "Feature",
        properties: { role: "destination" },
        geometry: { type: "Point", coordinates: destination.coordinates },
      });
    }
    return features.length > 0
      ? { type: "FeatureCollection" as const, features }
      : null;
  }, [origin, destination]);

  // GeoJSON de la ruta activa — usa OSRM para walks cuando está disponible
  const routeGeoJSON = useMemo(() => {
    if (!route) return null;
    return buildRouteGeoJSON(route, stationMap, walkGeometries, lineMap);
  }, [route, stationMap, walkGeometries, lineMap]);

  const onMouseEnter = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    (e.target as any).getCanvas().style.cursor = "pointer";
    setHoverInfo({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      nombre: feature.properties?.nombre,
    });
  }, []);

  const onMouseLeave = useCallback((e: MapLayerMouseEvent) => {
    (e.target as any).getCanvas().style.cursor = "";
    setHoverInfo(null);
  }, []);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      // Click en mapa vacío → punto personalizado
      setStationInfo(null);
      onMapPointClick([e.lngLat.lng, e.lngLat.lat]);
      return;
    }
    const id = feature.properties?.id;
    const node = stationMap.get(id);
    if (node) {
      onStationClick(node);
    }
    setStationInfo({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      nombre: feature.properties?.nombre,
      linea: feature.properties?.linea,
      color: feature.properties?.color,
      estado: feature.properties?.estado,
      distrito: feature.properties?.distrito,
      stationNode: node!,
    });
  }, [stationMap, onStationClick]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        initialViewState={LIMA_CENTER}
        style={{ width: "100%", height: "100%" }}
        mapStyle={TILE_STYLE}
        interactiveLayerIds={["stations-layer"]}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {/* Líneas base */}
        {linesGeoJSON && (
          <Source id="lines" type="geojson" data={linesGeoJSON}>
            <Layer
              id="lines-layer"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": route ? 0.3 : 0.8,
              }}
              layout={{ "line-join": "round", "line-cap": "round" }}
            />
          </Source>
        )}

        {/* Estaciones base */}
        {stationsGeoJSON && (
          <Source id="stations" type="geojson" data={stationsGeoJSON}>
            <Layer
              id="stations-layer"
              type="circle"
              paint={{
                "circle-radius": [
                  "case",
                  ["any", ["get", "isOrigin"], ["get", "isDestination"]], 8,
                  5,
                ],
                "circle-color": ["get", "color"],
                "circle-opacity": route ? 0.4 : 0.9,
                "circle-stroke-width": [
                  "case",
                  ["any", ["get", "isOrigin"], ["get", "isDestination"]], 3,
                  2,
                ],
                "circle-stroke-color": "#fff",
              }}
            />
          </Source>
        )}

        {/* Overlay de ruta — segmentos metro y caminata */}
        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            {/* Segmentos metro */}
            <Layer
              id="route-metro-layer"
              type="line"
              filter={["==", ["get", "type"], "metro"]}
              paint={{
                "line-color": ["get", "color"],
                "line-width": 6,
                "line-opacity": 1,
              }}
              layout={{ "line-join": "round", "line-cap": "round" }}
            />
            {/* Segmentos caminata */}
            <Layer
              id="route-walk-layer"
              type="line"
              filter={["==", ["get", "type"], "walk"]}
              paint={{
                "line-color": "#666666",
                "line-width": 4,
                "line-dasharray": [2, 2],
                "line-opacity": 0.9,
              }}
              layout={{ "line-join": "round", "line-cap": "round" }}
            />
            {/* Puntos de origen y destino */}
            <Layer
              id="route-endpoints-layer"
              type="circle"
              filter={["==", ["get", "type"], "endpoint"]}
              paint={{
                "circle-radius": 9,
                "circle-color": [
                  "case",
                  ["==", ["get", "role"], "origin"], "#22c55e",
                  "#ef4444",
                ],
                "circle-stroke-width": 3,
                "circle-stroke-color": "#fff",
                "circle-opacity": 1,
              }}
            />
          </Source>
        )}

        {/* Pins de puntos personalizados (cuando no hay ruta activa aún) */}
        {customPinsGeoJSON && (
          <Source id="custom-pins" type="geojson" data={customPinsGeoJSON}>
            <Layer
              id="custom-pins-layer"
              type="circle"
              paint={{
                "circle-radius": 10,
                "circle-color": [
                  "case",
                  ["==", ["get", "role"], "origin"], "#22c55e",
                  "#ef4444",
                ],
                "circle-stroke-width": 3,
                "circle-stroke-color": "#fff",
                "circle-opacity": 1,
              }}
            />
          </Source>
        )}

        {/* Cursor de selección activa */}
        {(origin || destination) && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 999,
              pointerEvents: "none",
            }}
          >
            {activeSlot === "destination"
              ? "Haz click en cualquier punto del mapa para el destino"
              : "Haz click en cualquier punto del mapa para el origen"}
          </div>
        )}

        {/* Hover tooltip */}
        {hoverInfo && !stationInfo && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={10}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>{hoverInfo.nombre}</span>
          </Popup>
        )}

        {/* Click popup */}
        {stationInfo && (
          <Popup
            longitude={stationInfo.longitude}
            latitude={stationInfo.latitude}
            anchor="bottom"
            offset={12}
            onClose={() => setStationInfo(null)}
          >
            <div style={{ minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: stationInfo.color,
                    flexShrink: 0,
                  }}
                />
                <strong style={{ fontSize: 14 }}>{stationInfo.nombre}</strong>
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                <div>{stationInfo.linea}</div>
                <div>{stationInfo.distrito}</div>
                <div style={{ textTransform: "capitalize" }}>
                  {stationInfo.estado.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
