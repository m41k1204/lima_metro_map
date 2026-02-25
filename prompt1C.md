# Prompt — Fase 1C: Modelos Mongoose + Seed Scripts

## Contexto del proyecto

Aplicación Next.js 14 (App Router) + tRPC + MongoDB + Mongoose + MapLibre.
Mapa interactivo del Metro de Lima con 6 líneas (operativas y proyectadas).

La Fase 1B ya está completa. Tenemos dos archivos GeoJSON con datos oficiales:

- `src/data/lima_metro.geojson` — 8 trazos (LineString por línea)
- `src/data/lima_estaciones_final.geojson` — 118 estaciones (Point por estación)

## Tu tarea: Fase 1C completa

Implementa los modelos Mongoose y los seed scripts para poblar MongoDB.

---

## 1. Modelos Mongoose

Crea `src/server/models/Linea.ts`:

```typescript
{
  nombre: string              // "Linea 1"
  tipo: "metro" | "brt"
  numero: number              // 1-6, o 0 para BRT
  color: string               // hex "#47AA42"
  estado: "operativa" | "en_construccion" | "proyectada"
  estilo_linea: "solid" | "dashed"
  ruta: {
    type: "LineString"
    coordinates: [number, number][]
  }
}
```

Crea `src/server/models/Estacion.ts`:

```typescript
{
  nombre: string
  linea: string               // "Linea 1" (denormalizado para queries simples)
  linea_ref: ObjectId         // referencia a Linea
  numero_linea: number
  color: string               // heredado de la línea
  estado: "operativa" | "obras_civiles_culminadas" | "en_construccion" | "proyectada"
  orden: number               // posición en la línea (1, 2, 3...)
  ubicacion: string           // "Av. Separadora Industrial con Av. Velasco Alvarado"
  distrito: string
  location: {                 // campo obligatorio para índice 2dsphere
    type: "Point"
    coordinates: [number, number]   // [lng, lat]
  }
}
```

Requisitos de los modelos:
- Usar `mongoose.models.X || mongoose.model('X', schema)` para evitar errores en hot reload de Next.js
- Índice `2dsphere` en `Estacion.location`
- Exportar tanto el modelo como el tipo TypeScript inferido con `InferSchemaType`

---

## 2. Utilidad de conexión MongoDB

Crea `src/lib/mongodb.ts` con el patrón de conexión cached para Next.js:

```typescript
// Singleton connection — evita abrir múltiples conexiones en desarrollo
```

Usa la variable de entorno `MONGODB_URI`.

---

## 3. Seed scripts

Crea `src/scripts/seed.ts` que haga lo siguiente en orden:

### Paso 1 — Limpiar colecciones
```typescript
await Linea.deleteMany({})
await Estacion.deleteMany({})
```

### Paso 2 — Seed de líneas
Lee `src/data/lima_metro.geojson` y por cada feature crea un documento `Linea`.

Mapeo de nombres del GeoJSON → modelo:
- `"Linea 1"` → numero: 1, tipo: "metro"
- `"Linea 2"` → numero: 2, tipo: "metro"
- `"Linea 3"` → numero: 3, tipo: "metro"
- `"Linea 4"` → numero: 4, tipo: "metro"
- `"Linea 5"` → numero: 5, tipo: "metro"
- `"Linea 6"` → numero: 6, tipo: "metro"
- `"Metropolitano"` → numero: 0, tipo: "brt"
- `"Metropolitano_ramal"` → numero: 0, tipo: "brt"

### Paso 3 — Seed de estaciones
Lee `src/data/lima_estaciones_final.geojson` y por cada feature:
1. Busca el `_id` de la línea correspondiente por nombre (`feature.properties.linea`)
2. Crea el documento `Estacion` usando `feature.geometry.coordinates` como `location.coordinates`

**Importante**: el GeoJSON ya tiene el campo `estado` con estos valores exactos:
`"operativa"` | `"obras_civiles_culminadas"` | `"en_construccion"` | `"proyectada"`

### Paso 4 — Crear índices
```typescript
await Estacion.collection.createIndex({ location: "2dsphere" })
```

### Paso 5 — Log de verificación
Al finalizar imprime:
```
✅ Líneas insertadas: 8
✅ Estaciones insertadas: 118
✅ Índice 2dsphere creado
```

---

## 4. Script npm

Agrega en `package.json`:
```json
"scripts": {
  "seed": "tsx src/scripts/seed.ts"
}
```

---

## Estructura de archivos a crear

```
src/
├── lib/
│   └── mongodb.ts
├── server/
│   └── models/
│       ├── Linea.ts
│       └── Estacion.ts
├── data/
│   ├── lima_metro.geojson          ← ya existe, no tocar
│   └── lima_estaciones_final.geojson  ← ya existe, no tocar
└── scripts/
    └── seed.ts
```

---

## Restricciones importantes

- NO modifiques los archivos GeoJSON
- NO uses `require()`, todo ES modules con `import`
- NO hardcodees el MONGODB_URI, siempre desde `process.env.MONGODB_URI`
- El seed debe ser **idempotente** — correrlo dos veces no duplica datos
- Usa `tsx` para ejecutar el script (no `ts-node`)
- Los `coordinates` en GeoJSON son `[longitude, latitude]` — no los inviertas

---

## Variables de entorno necesarias

```env
# .env.local
MONGODB_URI=mongodb://localhost:27017/lima_metro
```

---

## Lo que NO debes hacer en esta fase

- No crees routers tRPC todavía (eso es Fase 1D)
- No crees componentes React (eso es Fase 1E)
- No configures Vercel (eso es Fase 1F)