# Mapa Interactivo del Metro de Lima

Aplicación web interactiva que muestra las 6 líneas del Metro de Lima (operativas y proyectadas) con todas sus estaciones, más proyectos inmobiliarios cercanos. El objetivo es ayudar a decidir dónde comprar un departamento en Lima según la proximidad al metro.

## Stack

- **Frontend + Backend**: Next.js 14 (App Router) + tRPC v11
- **Base de datos**: MongoDB Atlas free tier + Mongoose
- **Mapa**: MapLibre GL JS + react-map-gl (open source, sin API key)
- **Tiles**: Protomaps o MapTiler free tier
- **Hosting**: Vercel (auto-deploy desde GitHub)
- **AI**: Claude Haiku API (scraper Fase 2)

## Estructura del proyecto

```
src/
├── server/
│   ├── routers/
│   │   ├── lineas.ts          # getAll
│   │   ├── estaciones.ts      # getAll, getByLinea, getById
│   │   └── proyectos.ts       # getAll, getByEstacion (Fase 2)
│   └── models/
│       ├── Linea.ts
│       ├── Estacion.ts
│       ├── SistemaTransporte.ts
│       └── Proyecto.ts        # Fase 2
├── components/
│   ├── MapView.tsx            # Contenedor principal full-screen
│   ├── MetroLayer.tsx         # Líneas y estaciones del metro
│   ├── BRTLayer.tsx           # Metropolitano y corredores
│   ├── Sidebar.tsx            # Info al hacer click en estación/proyecto
│   └── LineToggles.tsx        # Mostrar/ocultar líneas individualmente
└── scripts/
    └── seed/                  # Scripts para poblar MongoDB
```

## Modelos de datos

### Linea
```typescript
{
  nombre: string           // "Línea 1"
  tipo: "metro" | "brt" | "corredor"
  numero: number           // 1-6
  color: string            // hex oficial "#47AA42"
  estado: "operativa" | "en_construccion" | "proyectada"
  ruta: GeoJSON.LineString
  estilo_linea: "solid" | "dashed"  // dashed para proyectadas
}
```

### Estacion
```typescript
{
  nombre: string
  linea_ref: ObjectId
  estado: "operativa" | "en_construccion" | "proyectada"
  location: GeoJSON.Point  // índice 2dsphere obligatorio
  apertura_estimada?: string  // "2026-Q2"
  conexiones?: string[]    // ["linea_1", "metropolitano"]
}
```

### Proyecto (Fase 2)
```typescript
{
  nombre: string
  inmobiliaria: string
  location: GeoJSON.Point  // índice 2dsphere obligatorio
  estado: "en_planos" | "en_construccion" | "entregado"
  precio_desde: number     // USD
  precio_m2: number
  area_desde: number       // m²
  dormitorios: number[]
  entrega_estimada?: string
  amenities: string[]
  estacion_mas_cercana: {
    estacion_id: ObjectId
    distancia_metros: number
  }
  fotos: string[]
  url_fuente: string
  ultimo_scrape: Date
  activo: boolean
}
```

## Líneas del metro — colores oficiales

| Línea | Color | Hex | Estado |
|-------|-------|-----|--------|
| L1 | Verde | `#47AA42` | Operativa (26 est.) |
| L2 | Amarillo | `#F5D800` | En construcción (27 est.) |
| L3 | Celeste | `#00AEEF` | Proyectada (28 est.) |
| L4 | Rojo | `#E30613` | En construcción (8 est.) |
| L5 | Rosa | `#F5A0C8` | Proyectada |
| L6 | Violeta | `#8B008B` | Proyectada |
| Metropolitano | Rojo oscuro | `#C8102E` | Operativo (44 est.) |

Líneas proyectadas y en construcción se renderizan con `dasharray` en MapLibre.

## Trazos oficiales por avenida (DS 059-2010-MTC)

- **L2**: Av. Javier Prado → Av. La Marina → Callao
- **L3**: Av. Benavides → Av. Larco → Av. Arequipa → Av. Garcilaso → Av. Tacna → Av. Túpac Amaru
- **L4**: Av. Faucett → Av. La Marina → Av. Sánchez Carrión → Av. Salaverry → Av. Javier Prado → Av. Circunvalación
- **L5**: Costa Verde → Av. Huaylas → Av. Paseo de la República
- **L6**: Av. Universitaria (norte-sur)

## Índices MongoDB requeridos

```javascript
db.estaciones.createIndex({ location: "2dsphere" })
db.proyectos.createIndex({ location: "2dsphere" })
```

## Variables de entorno

```env
MONGODB_URI=mongodb+srv://...
```

## Fuentes de datos

- **L1 y Metropolitano**: Extraer de OpenStreetMap via Overpass Turbo (datos completos disponibles)
- **L2–L6**: Geocodificar estaciones via Nominatim API, trazar sobre avenidas oficiales
- **Proyectos inmobiliarios** (Fase 2): Scraper con Playwright sobre Urbania, Nexo Inmobiliario, A Donde Vivir

## Fases de desarrollo

### Fase 1 — Metro en el mapa
1. **1A** Setup: Better T Stack + Mongoose + MapLibre + mapa base de Lima
2. **1B** Datos: Geocodificar las 6 líneas, revisar en geojson.io
3. **1C** Seeds: Modelos Mongoose + poblar MongoDB
4. **1D** Backend: 4 routers tRPC (lineas + estaciones)
5. **1E** Frontend: MetroLayer + BRTLayer + Sidebar + Toggles + Responsive
6. **1F** Deploy: Vercel + variables de entorno

**Done cuando**: URL pública muestra Lima con 6 líneas en colores oficiales, click en estación muestra info, toggles funcionan en mobile y desktop.

### Fase 2 — Proyectos inmobiliarios
- Modelo Proyecto en MongoDB
- Scraper quincenal: Playwright + Claude Haiku API → parsear HTML → JSON → MongoDB
- Cálculo automático de estación más cercana ($near query)
- Capa de proyectos en mapa con clustering y filtros
- GitHub Actions cron (sin servidores propios)

**Costo operativo**: ~$0.50/mes (Claude Haiku, 150 proyectos × 2 veces/mes)

## Decisiones técnicas

- **MapLibre sobre Google Maps**: open source, sin API key, soporta WebGL para muchos markers
- **MongoDB sobre PostgreSQL+PostGIS**: schema flexible para proyectos inmobiliarios con campos variables; índice 2dsphere suficiente para este caso
- **Vercel + Atlas + GitHub Actions**: cero servidores propios, cero mantenimiento, ~$0.50/mes total
- **tRPC sobre REST**: type-safety end-to-end sin código extra, integración nativa con Next.js
