import mongoose, { Schema, InferSchemaType } from "mongoose";

const lineSchema = new Schema({
  nombre: {
    type: String,
    required: true,
  },
  tipo: {
    type: String,
    enum: ["metro", "brt"],
    required: true,
  },
  numero: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  estado: {
    type: String,
    enum: ["operativa", "en_construccion", "proyectada"],
    required: true,
  },
  estilo_linea: {
    type: String,
    enum: ["solid", "dashed"],
    required: true,
  },
  ruta: {
    type: {
      type: String,
      enum: ["LineString"],
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
    },
  },
});

export type Line = InferSchemaType<typeof lineSchema>;

export const LineModel =
  mongoose.models.Line || mongoose.model("Line", lineSchema);
