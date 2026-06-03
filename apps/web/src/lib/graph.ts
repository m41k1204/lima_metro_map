import {
  haversineDistance,
  travelTime,
  METRO_SPEED_KMH,
  BRT_SPEED_KMH,
  WALK_SPEED_MPM,
  TRANSFER_RADIUS_M,
  WALK_RADIUS_M,
  TRANSFER_PENALTY_MIN,
  STATION_DWELL_MIN,
} from "./geo";
import type { Graph, GraphEdge, LineNode, StationNode } from "./types";

export { TRANSFER_RADIUS_M, WALK_RADIUS_M };

function speedForLine(tipo: "metro" | "brt"): number {
  return tipo === "brt" ? BRT_SPEED_KMH : METRO_SPEED_KMH;
}

function addEdge(graph: Graph, from: string, edge: GraphEdge) {
  const edges = graph.get(from) ?? [];
  edges.push(edge);
  graph.set(from, edges);
}

export function buildGraph(stations: StationNode[], lines: LineNode[]): Graph {
  const graph: Graph = new Map();
  const lineMap = new Map(lines.map((l) => [l.nombre, l]));

  // Agrupar estaciones por línea, ordenadas por `orden`
  const byLine = new Map<string, StationNode[]>();
  for (const s of stations) {
    const group = byLine.get(s.linea) ?? [];
    group.push(s);
    byLine.set(s.linea, group);
  }
  for (const group of byLine.values()) {
    group.sort((a, b) => a.orden - b.orden);
  }

  // Aristas metro: estaciones consecutivas en la misma línea
  for (const [lineName, group] of byLine.entries()) {
    const line = lineMap.get(lineName);
    const speed = line ? speedForLine(line.tipo) : METRO_SPEED_KMH;

    for (let i = 0; i < group.length - 1; i++) {
      const a = group[i];
      const b = group[i + 1];
      const distM = haversineDistance(
        a.location.coordinates,
        b.location.coordinates
      );
      // Tiempo de viaje + parada en estación destino (dwell time)
      const weight =
        (a.duracion_sig_min ?? travelTime(distM, speed)) + STATION_DWELL_MIN;

      const edgeAB: GraphEdge = { to: b._id, weight, type: "metro", linea: lineName };
      const edgeBA: GraphEdge = { to: a._id, weight, type: "metro", linea: lineName };
      addEdge(graph, a._id, edgeAB);
      addEdge(graph, b._id, edgeBA);
    }
  }

  // Precomputar pares únicos para transfers y walks
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i];
      const b = stations[j];
      if (a.linea === b.linea) continue; // misma línea → ya manejado como metro

      const distM = haversineDistance(
        a.location.coordinates,
        b.location.coordinates
      );

      if (distM <= TRANSFER_RADIUS_M) {
        // Arista transfer: penalización fija + espera de la línea destino
        const lineA = lineMap.get(a.linea);
        const lineB = lineMap.get(b.linea);
        const waitB = (lineB?.frecuencia_min ?? 6) / 2;
        const waitA = (lineA?.frecuencia_min ?? 6) / 2;
        const weightAtoB = TRANSFER_PENALTY_MIN + waitB;
        const weightBtoA = TRANSFER_PENALTY_MIN + waitA;

        addEdge(graph, a._id, { to: b._id, weight: weightAtoB, type: "transfer", linea: b.linea });
        addEdge(graph, b._id, { to: a._id, weight: weightBtoA, type: "transfer", linea: a.linea });
      } else if (distM <= WALK_RADIUS_M) {
        // Arista walk: tiempo de caminata
        const weight = distM / WALK_SPEED_MPM;
        addEdge(graph, a._id, { to: b._id, weight, type: "walk" });
        addEdge(graph, b._id, { to: a._id, weight, type: "walk" });
      }
    }
  }

  return graph;
}
