"use client";

import { useState, useEffect } from "react";
import type { RouteResult } from "@/lib/types";

export type WalkGeometry = {
  coordinates: [number, number][];
  durationSeconds: number;
};

export type WalkGeometries = globalThis.Map<number, WalkGeometry>;

const OSRM_TIMEOUT_MS = 4_000;

async function fetchOSRMWalk(
  from: [number, number],
  to: [number, number],
  routeSignal: AbortSignal
): Promise<WalkGeometry | null> {
  // Combinamos el signal de la ruta con un timeout propio
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), OSRM_TIMEOUT_MS);

  // AbortSignal.any no está disponible en todos los entornos; usamos la
  // primera señal que dispare via un listener manual
  const combined = new AbortController();
  const abort = () => combined.abort();
  routeSignal.addEventListener("abort", abort, { once: true });
  timeoutController.signal.addEventListener("abort", abort, { once: true });

  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
      `${from[0]},${from[1]};${to[0]},${to[1]}` +
      `?overview=full&geometries=geojson&radiuses=200;200`;

    const res = await fetch(url, { signal: combined.signal });
    if (!res.ok) return null;

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      coordinates: route.geometry.coordinates as [number, number][],
      durationSeconds: route.duration as number,
    };
  } catch {
    return null; // timeout, abort, o error de red → fallback a línea recta
  } finally {
    clearTimeout(timeoutId);
    routeSignal.removeEventListener("abort", abort);
    timeoutController.signal.removeEventListener("abort", abort);
  }
}

type HookResult = {
  geometries: WalkGeometries;
  loading: boolean;
};

export function useWalkingRoutes(route: RouteResult | null): HookResult {
  const [geometries, setGeometries] = useState<WalkGeometries>(new globalThis.Map());
  const [loading, setLoading] = useState(false);

  const routeKey = route?.stationIds.join(",") ?? null;

  useEffect(() => {
    if (!route || !routeKey) {
      setGeometries(new globalThis.Map());
      setLoading(false);
      return;
    }

    const walkSegments = route.segments
      .map((seg, i) => ({ seg, i }))
      .filter(({ seg }) => seg.type === "walk" && seg.stations.length >= 2);

    if (walkSegments.length === 0) {
      setGeometries(new globalThis.Map());
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      const results = await Promise.all(
        walkSegments.map(async ({ seg, i }) => {
          const first = seg.stations[0];
          const last = seg.stations[seg.stations.length - 1];
          const geo = await fetchOSRMWalk(
            first.location.coordinates,
            last.location.coordinates,
            controller.signal
          );
          return { i, geo };
        })
      );

      if (controller.signal.aborted) return;

      const next = new globalThis.Map<number, WalkGeometry>();
      for (const { i, geo } of results) {
        if (geo) next.set(i, geo);
      }
      setGeometries(next);
      setLoading(false);
    })();

    return () => {
      controller.abort();
      setLoading(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return { geometries, loading };
}
