/**
 * Geocodifica estaciones de Línea 4 y 5 usando Overpass API
 * Hace UN SOLO query por par de avenidas con retry y backoff,
 * y guarda resultados parciales para no perder progreso.
 *
 * Uso: bun run src/scripts/geocode-l4-l5.ts
 */

import fs from "fs";
import path from "path";

const BBOX = "-12.35,-77.25,-11.7,-76.8";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const PARTIAL_PATH = path.resolve(__dirname, "../data/geocode-l4-l5-partial.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractStreetName(raw: string): string {
  return raw
    .replace(/^(Av\.|Avenida|Ca\.|Calle|Jr\.|Jirón|Pje\.|Pasaje|Carretera)\s+/i, "")
    .trim();
}

function parseUbicacion(ubicacion: string): [string, string | null] {
  const sep = ubicacion.indexOf(" con ");
  if (sep === -1) return [ubicacion.trim(), null];
  return [ubicacion.slice(0, sep).trim(), ubicacion.slice(sep + 5).trim()];
}

async function overpassWithRetry(query: string, maxRetries = 5): Promise<any> {
  let wait = 8000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resp = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "lima-metro-map/1.0",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (resp.ok) return await resp.json();

    if (resp.status === 429 || resp.status === 504) {
      console.log(`  Rate limit / timeout (${resp.status}), esperando ${wait / 1000}s...`);
      await sleep(wait);
      wait *= 2;
    } else {
      console.error(`  Error HTTP ${resp.status}`);
      return null;
    }
  }
  return null;
}

async function findIntersection(
  calle1: string,
  calle2: string
): Promise<{ lat: number; lon: number } | null> {
  const n1 = extractStreetName(calle1);
  const n2 = extractStreetName(calle2);

  const query = `[out:json][timeout:20];
way["name"~"${n1}",i](${BBOX})->.a;
way["name"~"${n2}",i](${BBOX})->.b;
node(w.a)(w.b);
out;`;

  const json = await overpassWithRetry(query);
  if (!json?.elements?.length) return null;

  const lats = json.elements.map((n: any) => n.lat);
  const lons = json.elements.map((n: any) => n.lon);
  return {
    lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
    lon: lons.reduce((a: number, b: number) => a + b, 0) / lons.length,
  };
}

function distMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const geojsonPath = path.resolve(__dirname, "../data/lima_estaciones_final.geojson");
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));

  // Cargar progreso parcial si existe
  const partial: Record<string, any> = fs.existsSync(PARTIAL_PATH)
    ? JSON.parse(fs.readFileSync(PARTIAL_PATH, "utf-8"))
    : {};

  const stations = geojson.features.filter(
    (f: any) => f.properties.linea === "Linea 4" || f.properties.linea === "Linea 5"
  );

  console.log(`Procesando ${stations.length} estaciones de L4 y L5...\n`);

  for (const feature of stations) {
    const { linea, nombre, ubicacion } = feature.properties;
    const key = `${linea}__${nombre}`;

    if (partial[key]) {
      console.log(`[SKIP] ${nombre} (ya procesado)`);
      continue;
    }

    const [lon_old, lat_old] = feature.geometry.coordinates;
    console.log(`\n[${linea}] ${nombre}`);
    console.log(`  Ubicacion: ${ubicacion}`);

    const [calle1, calle2] = parseUbicacion(ubicacion);

    let found: { lat: number; lon: number } | null = null;
    let source = "not-found";

    if (calle2) {
      found = await findIntersection(calle1, calle2);
      if (found) source = "overpass";
      await sleep(3000); // pausa base entre requests
    }

    const dist = found ? distMeters(lat_old, lon_old, found.lat, found.lon) : null;

    if (found) {
      console.log(
        `  Nuevo:  [${found.lon.toFixed(7)}, ${found.lat.toFixed(7)}]  ` +
          `(${Math.round(dist!)}m diff) [${source}]`
      );
    } else {
      console.log(`  ⚠ No encontrado`);
    }

    partial[key] = {
      nombre,
      linea,
      ubicacion,
      old: [lon_old, lat_old],
      new: found ? [found.lon, found.lat] : null,
      dist_m: dist !== null ? Math.round(dist) : null,
      source,
    };

    // Guardar progreso parcial después de cada estación
    fs.writeFileSync(PARTIAL_PATH, JSON.stringify(partial, null, 2));
  }

  // Generar reporte final
  const results = Object.values(partial);
  const reportPath = path.resolve(__dirname, "../data/geocode-l4-l5-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  const found = results.filter((r: any) => r.new !== null);
  const notFound = results.filter((r: any) => r.new === null);
  const bigDiff = found.filter((r: any) => r.dist_m > 200);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Encontradas:   ${found.length}/${results.length}`);
  console.log(`Sin resultado: ${notFound.map((r: any) => r.nombre).join(", ") || "ninguna"}`);
  console.log(`Diff > 200m:   ${bigDiff.map((r: any) => `${r.nombre} (${r.dist_m}m)`).join(", ") || "ninguna"}`);
  console.log(`\nReporte: ${reportPath}`);
}

main().catch(console.error);
