import { buildGraph } from "./graph";
import { dijkstra } from "./dijkstra";
import { haversineDistance, WALK_RADIUS_M, WALK_SPEED_MPM } from "./geo";
import type {
  CustomPoint,
  GraphEdge,
  LineNode,
  RouteEndpoint,
  RouteResult,
  RouteSegment,
  StationNode,
} from "./types";
import { isCustomPoint } from "./types";

const CUSTOM_LINEA = "__custom__";

/** Convierte un CustomPoint en un pseudo-StationNode para inyectarlo en el grafo. */
function customToStation(point: CustomPoint): StationNode {
  return {
    _id: point._id,
    nombre: point.nombre,
    linea: CUSTOM_LINEA,
    numero_linea: 0,
    color: "#888888",
    estado: "operativa",
    orden: 0,
    distrito: "",
    location: { type: "Point", coordinates: point.coordinates },
  };
}

/** Agrega aristas de caminata desde un punto arbitrario hacia todas las estaciones cercanas. */
function injectCustomNode(
  graph: ReturnType<typeof buildGraph>,
  pseudo: StationNode,
  stations: StationNode[]
) {
  const edges: GraphEdge[] = [];
  for (const s of stations) {
    if (s.linea === CUSTOM_LINEA) continue;
    const distM = haversineDistance(pseudo.location.coordinates, s.location.coordinates);
    if (distM <= WALK_RADIUS_M) {
      const weight = distM / WALK_SPEED_MPM;
      edges.push({ to: s._id, weight, type: "walk" });
      // Arista inversa: estación → punto personalizado
      const reverse = graph.get(s._id) ?? [];
      reverse.push({ to: pseudo._id, weight, type: "walk" });
      graph.set(s._id, reverse);
    }
  }
  graph.set(pseudo._id, edges);
}

export function findRoute(
  stations: StationNode[],
  lines: LineNode[],
  origin: RouteEndpoint,
  dest: RouteEndpoint,
  prebuiltGraph?: ReturnType<typeof buildGraph>
): RouteResult | null {
  if (origin._id === dest._id) {
    return {
      segments: [],
      totalMinutes: 0,
      waitMinutes: 0,
      travelMinutes: 0,
      walkMinutes: 0,
      transfers: 0,
      stationIds: [origin._id],
    };
  }

  // Construir lista de estaciones enriquecida con pseudo-nodos si aplica
  const allStations = [...stations];
  if (isCustomPoint(origin)) allStations.push(customToStation(origin));
  if (isCustomPoint(dest)) allStations.push(customToStation(dest));

  const stationMap = new globalThis.Map(allStations.map((s) => [s._id, s]));
  const lineMap = new globalThis.Map(lines.map((l) => [l.nombre, l]));
  // Usar grafo pre-construido si se provee; clonar para no mutar el original
  const graph: ReturnType<typeof buildGraph> = prebuiltGraph
    ? new globalThis.Map(Array.from(prebuiltGraph.entries()).map(([k, v]) => [k, [...v]]))
    : buildGraph(stations, lines);

  // Inyectar nodos virtuales con sus aristas de caminata
  if (isCustomPoint(origin)) injectCustomNode(graph, customToStation(origin), stations);
  if (isCustomPoint(dest)) injectCustomNode(graph, customToStation(dest), stations);

  const result = dijkstra(graph, origin._id, dest._id);
  if (!result) return null;

  const { path } = result;

  // Espera inicial: solo aplica si el primer segmento es metro (no walk desde custom point)
  const firstStation = stationMap.get(path[0]);
  const firstIsCustom = firstStation?.linea === CUSTOM_LINEA;
  const firstLine = firstStation && !firstIsCustom ? lineMap.get(firstStation.linea) : null;
  const initialWait = firstLine ? firstLine.frecuencia_min / 2 : 0;

  const segments: RouteSegment[] = [];
  let currentSegment: RouteSegment | null = null;
  let travelMinutes = 0;
  let walkMinutes = 0;
  let waitMinutes = initialWait;
  let transfers = 0;
  let boardedLine: string | null = firstIsCustom ? null : (firstStation?.linea ?? null);

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];
    const fromStation = stationMap.get(fromId)!;
    const toStation = stationMap.get(toId)!;

    const edge = (graph.get(fromId) ?? []).find((e) => e.to === toId);
    if (!edge) continue;

    if (edge.type === "transfer") {
      // Cerrar segmento actual
      if (currentSegment) {
        if (!currentSegment.stations.includes(fromStation)) {
          currentSegment.stations.push(fromStation);
        }
        segments.push(currentSegment);
        currentSegment = null;
      }
      const toLine = lineMap.get(toStation.linea);
      const newLineWait = toLine ? toLine.frecuencia_min / 2 : 3;
      waitMinutes += newLineWait;
      boardedLine = toStation.linea;
      transfers++;
      continue;
    }

    // Si es el primer segmento metro y venimos de walk (custom origin), sumar espera de boarding
    if (edge.type === "metro" && boardedLine === null) {
      const line = lineMap.get(fromStation.linea);
      waitMinutes += line ? line.frecuencia_min / 2 : 3;
      boardedLine = fromStation.linea;
    }

    const edgeType: "metro" | "walk" = edge.type === "metro" ? "metro" : "walk";
    const segLinea = edgeType === "metro" ? fromStation.linea : undefined;
    const segColor = edgeType === "metro"
      ? (lineMap.get(fromStation.linea)?.color ?? fromStation.color)
      : undefined;

    if (
      currentSegment &&
      currentSegment.type === edgeType &&
      currentSegment.linea === segLinea
    ) {
      if (!currentSegment.stations.includes(fromStation)) {
        currentSegment.stations.push(fromStation);
      }
      currentSegment.durationMinutes += edge.weight;
    } else {
      if (currentSegment) {
        if (!currentSegment.stations.includes(fromStation)) {
          currentSegment.stations.push(fromStation);
        }
        segments.push(currentSegment);
      }
      currentSegment = {
        type: edgeType,
        linea: segLinea,
        color: segColor,
        stations: [fromStation],
        durationMinutes: edge.weight,
      };
    }

    if (edge.type === "metro") travelMinutes += edge.weight;
    if (edge.type === "walk") walkMinutes += edge.weight;
  }

  // Cerrar último segmento
  if (currentSegment) {
    const lastStation = stationMap.get(path[path.length - 1]);
    if (lastStation && !currentSegment.stations.includes(lastStation)) {
      currentSegment.stations.push(lastStation);
    }
    segments.push(currentSegment);
  }

  const totalMinutes = waitMinutes + travelMinutes + walkMinutes;

  return {
    segments,
    totalMinutes,
    waitMinutes,
    travelMinutes,
    walkMinutes,
    transfers,
    stationIds: path,
  };
}

type LinePosition = { segIdx: number; t: number };

function closestPositionOnLine(
  lineCoords: [number, number][],
  point: [number, number]
): LinePosition {
  let minDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = lineCoords[i];
    const b = lineCoords[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));
    const cx = a[0] + t * dx;
    const cy = a[1] + t * dy;
    const dist = Math.hypot(point[0] - cx, point[1] - cy);
    if (dist < minDist) { minDist = dist; bestSeg = i; bestT = t; }
  }
  return { segIdx: bestSeg, t: bestT };
}

function sliceLineString(
  coords: [number, number][],
  from: LinePosition,
  to: LinePosition
): [number, number][] {
  const fromParam = from.segIdx + from.t;
  const toParam = to.segIdx + to.t;
  const [startPos, endPos, reverse] =
    fromParam <= toParam ? [from, to, false] : [to, from, true];

  const result: [number, number][] = [];
  const startCoord = coords[startPos.segIdx];
  const startNext = coords[startPos.segIdx + 1];
  result.push([
    startCoord[0] + startPos.t * (startNext[0] - startCoord[0]),
    startCoord[1] + startPos.t * (startNext[1] - startCoord[1]),
  ]);
  for (let i = startPos.segIdx + 1; i <= endPos.segIdx; i++) result.push(coords[i]);
  if (endPos.t > 0 && endPos.segIdx < coords.length - 1) {
    const endCoord = coords[endPos.segIdx];
    const endNext = coords[endPos.segIdx + 1];
    result.push([
      endCoord[0] + endPos.t * (endNext[0] - endCoord[0]),
      endCoord[1] + endPos.t * (endNext[1] - endCoord[1]),
    ]);
  }
  return reverse ? result.reverse() : result;
}

/** Construye un GeoJSON FeatureCollection para renderizar la ruta en el mapa.
 *  - walkGeometries: Map<segmentIndex, coordinates[]> con rutas reales de OSRM.
 *  - lineMap: Map<lineNombre, LineNode> para usar la geometría ruta real en segmentos metro.
 */
export function buildRouteGeoJSON(
  result: RouteResult,
  stationMap: globalThis.Map<string, StationNode>,
  walkGeometries: globalThis.Map<number, { coordinates: [number, number][] }> = new globalThis.Map(),
  lineMap: globalThis.Map<string, import("./types").LineNode> = new globalThis.Map()
) {
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];
    if (segment.stations.length < 2) continue;

    let coordinates: [number, number][];

    if (segment.type === "walk") {
      const osrm = walkGeometries.get(i);
      coordinates = osrm?.coordinates ??
        segment.stations.map((s) => s.location.coordinates as [number, number]);
    } else {
      // Use the actual ruta geometry clipped between first and last station
      const line = segment.linea ? lineMap.get(segment.linea) : undefined;
      const ruta = line?.ruta?.coordinates;
      if (ruta && ruta.length >= 2) {
        const first = segment.stations[0].location.coordinates as [number, number];
        const last = segment.stations[segment.stations.length - 1].location.coordinates as [number, number];
        const posFrom = closestPositionOnLine(ruta, first);
        const posTo = closestPositionOnLine(ruta, last);
        coordinates = sliceLineString(ruta, posFrom, posTo);
      } else {
        coordinates = segment.stations.map((s) => s.location.coordinates as [number, number]);
      }
    }

    features.push({
      type: "Feature",
      properties: {
        type: segment.type,
        color: segment.color ?? "#888888",
        linea: segment.linea ?? "",
      },
      geometry: { type: "LineString", coordinates },
    });
  }

  // Marcadores de origen y destino
  const originId = result.stationIds[0];
  const destId = result.stationIds[result.stationIds.length - 1];
  for (const [role, id] of [["origin", originId], ["destination", destId]] as const) {
    const s = stationMap.get(id);
    if (s) {
      features.push({
        type: "Feature",
        properties: { type: "endpoint", role },
        geometry: { type: "Point", coordinates: s.location.coordinates },
      });
    }
  }

  return { type: "FeatureCollection" as const, features };
}
