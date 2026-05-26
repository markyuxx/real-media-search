# Real Media Search v3

**Motor de búsqueda deep-search para proyectos educativos -- 12 fuentes, scoring didáctico, sin IA generativa.**

Encuentra diagramas SVG, cortes transversales, despieces, esquemas, videos educativos y documentos históricos en 12 fuentes libres. Cada resultado incluye score de relevancia didáctica, atribución al autor y tipo de licencia.

## Que hace

Dado un índice markdown con tu temario (capítulos numerados), el script consulta **12 fuentes en paralelo**:

| Fuente | Que encuentra | API Key |
|--------|---------------|---------|
| **Wikimedia Commons** | SVG diagrams, cross-sections, schematics | No |
| **Openverse** | Flickr, RawPixel, Smithsonian, Europeana CC | No |
| **Flickr** | Imágenes CC con licencia | No |
| **SearXNG** (3 instancias) | Google + Bing + DuckDuckGo + Wikipedia... | No |
| **ArXiv** | Papers científicos con diagramas | No |
| **Core.ac.uk** | 250M+ open access research | No |
| **Zenodo** | Research data, posters, slides técnicas | No |
| **GitHub** | Repos con SVG/diagramas en README | No (60 req/h) |
| **Internet Archive** | Documentos y videos históricos | No |
| **Wikimedia Video** | Videos .webm/.ogv educativos | No |
| **YouTube** | Búsqueda contextual EN + ES | No |
| **Flickr public feed** | Fotos técnicas CC | No |

**Cada resultado incluye:**
- **Score** de relevancia didáctica (SVG: +8, cross section: +6, diagrama: +5)
- **Badges**: [SVG] [DIAGRAMA] [CORTE] [DESPIECE] [PLANO] [FUNCIONAMIENTO]
- **Atribución** verificable (autor, licencia, fuente)
- **Filtrado de ruido**: entrevistas, logos, podcasts, testimonios penalizados con -20

**Ideal para:**
- Libros técnicos y documentación
- Plataformas educativas interactivas
- Wikis y bases de conocimiento
- Cursos con contenido didáctico real
- Proyectos open-source con documentación visual

## Instalación

```bash
git clone https://github.com/markyuxx/real-media-search.git
cd real-media-search

# Sin dependencias externas -- solo Node.js >= 14
node bin/search-real-media.js --help
```

O usarlo directamente sin clonar:

```bash
npx github:markyuxx/real-media-search --index ./mi_indice.md
```

## Uso rápido

### 1. Crea tu índice maestro (`mi_indice.md`)

```markdown
## Fundamentos de mecánica
1. Herramientas basicas y seguridad
2. Metrologia: medir antes de tocar
3. Materiales y tornilleria

## Motor
4. Ciclo Otto y Diesel
5. Bloque, culata y juntas
6. Sistema de lubricacion
```

### 2. Ejecuta la búsqueda

```bash
# Búsqueda completa (12 fuentes)
node bin/search-real-media.js --index ./mi_indice.md

# Solo un capítulo
node bin/search-real-media.js --index ./mi_indice.md --chapter 5

# Solo fuentes específicas
node bin/search-real-media.js --index ./mi_indice.md --sources wikimedia,openverse,flickr

# Sin caché (búsqueda fresca)
node bin/search-real-media.js --index ./mi_indice.md --no-cache --chapter 16
```

### 3. Revisa los resultados

Se generan tres archivos en `./real_media_output/`:

- `real_media.json` — JSON completo con URLs, thumbnails, scores, badges, licencias
- `real_media.md` — Versión markdown legible para humanos
- `search_cache.json` — Caché para búsquedas incrementales (guarda cada 5 capítulos)

## Opciones completas

```bash
node bin/search-real-media.js --index <ruta> [opciones]
```

| Opción | Descripción | Default |
|--------|-------------|---------|
| `--index <ruta>` | Ruta al índice maestro markdown | *requerido* |
| `--output <dir>` | Directorio de salida | `./real_media_output` |
| `--chapter <N>` | Buscar solo un capítulo | Todos |
| `--no-cache` | Ignorar caché y re-buscar todo | Caché activa |
| `--sources <lista>` | Fuentes: `wikimedia,openverse,flickr,searxng,arxiv,core,zenodo,github,archive,youtube` | Todas |
| `--delay <ms>` | Retardo entre búsquedas (sé amable con las APIs) | `1500` |
| `--help` | Mostrar ayuda | -- |

## Sistema de Scoring Didáctico

Cada imagen y video recibe una puntuación de relevancia. El score se calcula así:

### Señales positivas

| Señal | Puntos |
|-------|--------|
| Extensión `.svg` | +8 |
| `diagram`, `schematic` | +5 |
| `cross section`, `cutaway` | +6 |
| `exploded view` | +5 |
| `labeled`, `blueprint` | +4 |
| `working principle`, `how it works` | +4 |
| `wiring diagram`, `circuit diagram` | +5 |
| `mechanical drawing` | +4 |
| Video: `animation`, `3d` | +5 |
| Fuente ArXiv, Core, Zenodo | +4 |

### Señales negativas (ruido eliminado)

| Señal | Penalización |
|-------|-------------|
| `logo`, `interview`, `podcast`, `promo` | -20 |
| `testimonial`, `testimony`, `guest` | -20 |
| `wedding`, `birthday`, `family`, `vacation` | -20 |
| `warm up`, `scenic drive`, `ride onboard` | -10 |
| `selfie`, `portrait` | -10 |
| `crispr`, `gene editing` | -20 |

**Solo se incluyen resultados con score > 0**, ordenados de mayor a menor.

## Formato del JSON de salida

Cada capítulo produce esta estructura:

```json
{
  "number": 16,
  "title": "Refrigeracion y gestion termica",
  "book": "Libro 2: Motores de combustion",
  "sources": {
    "wikimedia": {
      "label": "Diagramas / esquemas",
      "license": "CC / Public Domain",
      "items": [
        {
          "title": "Fully closed IC engine cooling system.svg",
          "url": "https://commons.wikimedia.org/wiki/File:...",
          "thumbnail": "https://upload.wikimedia.org/...",
          "full": "https://upload.wikimedia.org/...",
          "attribution": "Lokal_Profil",
          "license": "CC BY-SA 2.5",
          "score": 9,
          "badges": ["SVG"],
          "source": "wikimedia",
          "type": "image"
        }
      ]
    },
    "flickr": { "items": [...] },
    "openverse": { "items": [...] },
    "arxiv": { "items": [...] },
    "core": { "items": [...] },
    "zenodo": { "items": [...] },
    "github": { "items": [...] },
    "internetarchive": {
      "items": [{
        "title": "Keep an eye on your coolant levels",
        "embed_url": "https://archive.org/embed/...",
        "type": "video",
        "score": 3
      }]
    },
    "wikimedia_video": { "items": [...] },
    "youtube": {
      "search_url": "https://www.youtube.com/results?...",
      "search_url_es": "https://www.youtube.com/results?..."
    }
  }
}
```

## Integración web

El JSON de salida se puede consumir directamente desde una web app. Ejemplo mínimo:

```html
<script>
fetch('./real_media_output/real_media.json')
  .then(r => r.json())
  .then(data => {
    const chapter16 = data.find(c => c.number === 16);
    const items = chapter16.sources.wikimedia.items
      .sort((a, b) => b.score - a.score);
    
    items.forEach(img => {
      document.body.innerHTML += `
        <figure>
          <img src="${img.thumbnail}" alt="${img.title}" loading="lazy">
          <figcaption>
            ${img.title}
            <span class="badge badge-${img.badges[0]}">${img.badges[0]}</span>
            <small>Fuente: ${img.attribution} · ${img.license} · score: ${img.score}</small>
          </figcaption>
        </figure>
      `;
    });
  });
</script>
```

## Fuentes técnicas

### SearXNG (metabuscador)
Consulta 70+ motores de búsqueda simultáneamente (Google, Bing, DuckDuckGo, Wikipedia, etc.) a través de 3 instancias públicas con round-robin automático para máxima disponibilidad.

### Filtrado de Internet Archive
Pre-filtra resultados por **keyword en el título** del capítulo, eliminando automáticamente entrevistas, logos, podcasts y contenido no técnico.

### Guardado incremental
Los resultados se guardan cada 5 capítulos. Si la búsqueda se interrumpe, al reanudar continúa desde donde quedó usando la caché.

## Resultados reales (Biblia de la Automoción)

Ejecución completa sobre 120 capítulos de ingeniería automotriz:

| Métrica | Valor |
|---------|-------|
| Capítulos procesados | 120 |
| Imágenes didácticas | 1,313 |
| Videos embebibles | 104 |
| YouTube search links | 120 |
| Fuentes consultadas | 12 por capítulo |
| Tiempo estimado | ~15 minutos (con caché) |

## Sin IA generativa

Este script **no genera imágenes con IA**. Solo encuentra medios reales creados por personas, con atribución verificable a su autor original y tipo de licencia.

## GitHub

- **Repo**: [github.com/markyuxx/real-media-search](https://github.com/markyuxx/real-media-search)
- **Autor**: Marco Fernandez
- **Licencia**: MIT
