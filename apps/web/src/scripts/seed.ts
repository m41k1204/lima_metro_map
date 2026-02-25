import mongoose from "mongoose";
import { promises as fs } from "fs";
import path from "path";
import { LineModel } from "../server/models/Line";
import { StationModel } from "../server/models/Station";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined");
  process.exit(1);
}

async function seed() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Conectado a MongoDB");

    // Limpiar colecciones
    await LineModel.deleteMany({});
    await StationModel.deleteMany({});
    console.log("✓ Colecciones limpiadas");

    // Leer y parsear GeoJSON de líneas
    const lineasPath = path.join(__dirname, "../data/lima_metro_lines.geojson");
    const lineasData = await fs.readFile(lineasPath, "utf-8");
    const lineasGeoJSON = JSON.parse(lineasData);

    // Insertar líneas y guardar referencia de _id por nombre
    const lineasMap = new Map<string, string>();
    for (const feature of lineasGeoJSON.features) {
      const { nombre, tipo, numero, color, estado, estilo_linea } =
        feature.properties;
      const coordinates = feature.geometry.coordinates;

      const linea = await LineModel.create({
        nombre,
        tipo,
        numero,
        color,
        estado,
        estilo_linea,
        ruta: {
          type: "LineString",
          coordinates,
        },
      });

      lineasMap.set(nombre, linea._id.toString());
    }

    console.log(`✅ Líneas insertadas: ${lineasMap.size}`);

    // Leer y parsear GeoJSON de estaciones
    const estacionesPath = path.join(
      __dirname,
      "../data/lima_estaciones.geojson"
    );
    const estacionesData = await fs.readFile(estacionesPath, "utf-8");
    const estacionesGeoJSON = JSON.parse(estacionesData);

    // Insertar estaciones
    let estacionCount = 0;
    for (const feature of estacionesGeoJSON.features) {
      const {
        nombre,
        linea,
        numero_linea,
        color,
        estado,
        orden,
        ubicacion,
        distrito,
      } = feature.properties;
      const coordinates = feature.geometry.coordinates;

      const linea_ref = lineasMap.get(linea);
      if (!linea_ref) {
        console.warn(`⚠ Estación "${nombre}" - línea "${linea}" no encontrada`);
        continue;
      }

      try {
        await StationModel.create({
          nombre,
          linea,
          linea_ref,
          numero_linea,
          color,
          estado,
          orden,
          ubicacion,
          distrito,
          location: {
            type: "Point",
            coordinates,
          },
        });
        estacionCount++;
      } catch (error) {
        console.error(
          `❌ Error inserting estación "${nombre}":`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    console.log(`✅ Estaciones insertadas: ${estacionCount}`);

    // Crear índice 2dsphere
    await StationModel.collection.createIndex({ location: "2dsphere" });
    console.log("✅ Índice 2dsphere creado");

    console.log("\n✅ Seed completado exitosamente");
  } catch (error) {
    console.error("❌ Error durante seed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

seed();
