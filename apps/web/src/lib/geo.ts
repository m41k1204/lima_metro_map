export const METRO_SPEED_KMH = 35;
export const BRT_SPEED_KMH = 20;
export const WALK_SPEED_MPM = 83.33; // metros por minuto (5 km/h)
export const TRANSFER_RADIUS_M = 100;
export const WALK_RADIUS_M = 1200;
export const TRANSFER_PENALTY_MIN = 5;
export const STATION_DWELL_MIN = 0.75; // ~45 seg de parada en cada estación

/** Distancia en metros entre dos puntos [lon, lat] usando la fórmula de Haversine. */
export function haversineDistance(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Tiempo en minutos para recorrer una distancia a velocidad dada en km/h. */
export function travelTime(distanceM: number, speedKmh: number): number {
  return distanceM / (speedKmh * 1000 / 60);
}
