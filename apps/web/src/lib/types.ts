export type StationNode = {
  _id: string;
  nombre: string;
  linea: string;
  numero_linea: number;
  color: string;
  estado: string;
  orden: number;
  distrito: string;
  duracion_sig_min?: number;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
};

/** Punto arbitrario seleccionado con click en el mapa. */
export type CustomPoint = {
  _id: string;
  nombre: string;
  coordinates: [number, number]; // [lon, lat]
  isCustom: true;
};

export type RouteEndpoint = StationNode | CustomPoint;

export function isCustomPoint(e: RouteEndpoint): e is CustomPoint {
  return (e as CustomPoint).isCustom === true;
}

export type LineNode = {
  _id: string;
  nombre: string;
  tipo: "metro" | "brt";
  numero: number;
  color: string;
  frecuencia_min: number;
  ruta?: { type: "LineString"; coordinates: [number, number][] };
};

export type EdgeType = "metro" | "transfer" | "walk";

export type GraphEdge = {
  to: string;
  weight: number; // minutos
  type: EdgeType;
  linea?: string;
};

export type Graph = Map<string, GraphEdge[]>;

export type RouteSegment = {
  type: "metro" | "walk";
  linea?: string;
  color?: string;
  stations: StationNode[];
  durationMinutes: number;
};

export type RouteResult = {
  segments: RouteSegment[];
  totalMinutes: number;
  waitMinutes: number;    // espera inicial + esperas en transbordos
  travelMinutes: number;  // tiempo en vehículo
  walkMinutes: number;    // tiempo caminando
  transfers: number;
  stationIds: string[];   // orden completo para highlighting en el mapa
};
