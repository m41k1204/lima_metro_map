import mongoose, { Schema, InferSchemaType } from "mongoose";

const stationSchema = new Schema({
  nombre: {
    type: String,
    required: true,
  },
  linea: {
    type: String,
    required: true,
  },
  numero_linea: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  estado: {
    type: String,
    enum: ["operativa", "obras_civiles_culminadas", "en_construccion", "proyectada"],
    required: true,
  },
  orden: {
    type: Number,
    required: true,
  },
  ubicacion: {
    type: String,
    required: true,
  },
  distrito: {
    type: String,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
});

// Crear índice 2dsphere para queries geoespaciales
stationSchema.index({ location: "2dsphere" });

export type Station = InferSchemaType<typeof stationSchema>;

export const StationModel =
  mongoose.models.Station || mongoose.model("Station", stationSchema);
