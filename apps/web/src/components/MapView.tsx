"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, MapLayerMouseEvent } from "react-map-gl/maplibre";
import { trpc } from "@/utils/trpc";

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
};

export function MapView() {
  const mapRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);

  const { data: linesData } = useQuery(trpc.lines.getAll.queryOptions());
  const { data: stationsData } = useQuery(trpc.stations.getAll.queryOptions());

  const linesGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!linesData) return null;
    return {
      type: "FeatureCollection",
      features: (linesData as any[]).map((line) => ({
        type: "Feature",
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

  const stationsGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!stationsData) return null;
    return {
      type: "FeatureCollection",
      features: (stationsData as any[]).map((station) => ({
        type: "Feature",
        properties: {
          nombre: station.nombre,
          linea: station.linea,
          color: station.color,
          estado: station.estado,
          distrito: station.distrito,
        },
        geometry: station.location,
      })),
    };
  }, [stationsData]);

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
      setStationInfo(null);
      return;
    }
    setStationInfo({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      nombre: feature.properties?.nombre,
      linea: feature.properties?.linea,
      color: feature.properties?.color,
      estado: feature.properties?.estado,
      distrito: feature.properties?.distrito,
    });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
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
        {/* Lines Layer */}
        {linesGeoJSON && (
          <Source id="lines" type="geojson" data={linesGeoJSON}>
            <Layer
              id="lines-layer"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": 0.8,
              }}
              layout={{
                "line-join": "round",
                "line-cap": "round",
              }}
            />
          </Source>
        )}

        {/* Stations Layer */}
        {stationsGeoJSON && (
          <Source id="stations" type="geojson" data={stationsGeoJSON}>
            <Layer
              id="stations-layer"
              type="circle"
              paint={{
                "circle-radius": 5,
                "circle-color": ["get", "color"],
                "circle-opacity": 0.9,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              }}
            />
          </Source>
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
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {hoverInfo.nombre}
            </span>
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
