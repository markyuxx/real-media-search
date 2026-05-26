# Real Media Search

**Busca medios reales para tus proyectos educativos -- sin IA generativa.**

Encuentra imagenes, diagramas, animaciones, videos y documentos historicos en fuentes libres: Wikimedia Commons, YouTube e Internet Archive. Cada resultado incluye atribucion al autor y licencia.

---

## Que hace

Dado un indice markdown con tu temario (capitulos numerados), el script consulta tres fuentes:

| Fuente | Que encuentra | Licencia |
|--------|---------------|----------|
| **Wikimedia Commons** | Diagramas tecnicos, fotos de componentes, esquemas | CC / Dominio Publico |
| **YouTube** | Animaciones, videos educativos, documentales | Standard YouTube |
| **Internet Archive** | Manuales historicos, documentos, peliculas | Dominio Publico / Variable |

**Ideal para:**
- Libros tecnicos y documentacion
- Plataformas educativas
- Wikis y bases de conocimiento
- Cursos y temarios interactivos

---

## Instalacion

```bash
# Clonar el repositorio
git clone https://github.com/markyuxx/real-media-search.git
cd real-media-search

# No requiere dependencias externas -- solo Node.js >= 14
node bin/search-real-media.js --help
```

O usarlo directamente sin clonar:

```bash
npx github:markyuxx/real-media-search --index ./mi_indice.md
```

---

## Uso rapido

### 1. Crea tu indice maestro (`mi_indice.md`)

```markdown
## Fundamentos de mecanica
1. Herramientas basicas y seguridad
2. Metrologia: medir antes de tocar
3. Materiales y tornilleria

## Motor
4. Ciclo Otto y Diesel
5. Bloque, culata y juntas
6. Sistema de lubricacion
```

### 2. Ejecuta la busqueda

```bash
node bin/search-real-media.js --index ./mi_indice.md
```

### 3. Revisa los resultados

Se generan tres archivos en `./real_media_output/`:

- `real_media.json` -- JSON completo con URLs, thumbnails, atribucion y licencias
- `real_media.md` -- Version markdown legible para humanos
- `search_cache.json` -- Cache de respuestas API (para no repetir busquedas)

---

## Opciones completas

```bash
node bin/search-real-media.js --index <ruta> [opciones]
```

| Opcion | Descripcion | Default |
|--------|-------------|---------|
| `--index <ruta>` | Ruta al indice maestro markdown | *requerido* |
| `--output <dir>` | Directorio de salida | `./real_media_output` |
| `--chapter <N>` | Buscar solo un capitulo especifico | Todos |
| `--no-cache` | Ignorar cache y re-buscar todo | Cache activa |
| `--sources <lista>` | Fuentes: `wikimedia,youtube,archive` | Todas |
| `--delay <ms>` | Retardo entre busquedas (se amable con las APIs) | `800` |
| `--help` | Mostrar ayuda | -- |

### Ejemplos

```bash
# Buscar solo el capitulo 16
node bin/search-real-media.js --index ./mi_indice.md --chapter 16

# Solo Wikimedia, sin cache, mas lento para no saturar
node bin/search-real-media.js --index ./mi_indice.md --sources wikimedia --no-cache --delay 1500

# Buscar en Wikimedia + Internet Archive (sin YouTube)
node bin/search-real-media.js --index ./mi_indice.md --sources wikimedia,archive

# Salida personalizada
node bin/search-real-media.js --index ./mi_indice.md --output ./medios_encontrados
```

---

## Formato del JSON de salida

Cada capitulo produce esta estructura:

```json
{
  "number": 16,
  "title": "Refrigeracion y gestion termica",
  "book": "Libro 2: Motores",
  "domain": "motor",
  "sources": {
    "wikimedia": {
      "label": "Diagrama / foto libre",
      "license": "CC / Public Domain",
      "items": [
        {
          "title": "Cooling system diagram.svg",
          "url": "https://commons.wikimedia.org/wiki/File:...",
          "thumbnail": "https://upload.wikimedia.org/...",
          "full": "https://upload.wikimedia.org/...",
          "width": 1892,
          "height": 1050,
          "attribution": "Lokal_Profil",
          "license": "CC BY-SA 2.5"
        }
      ]
    },
    "internetarchive": {
      "label": "Manual / documento historico",
      "license": "Variable / Dominio publico",
      "items": [
        {
          "identifier": "manual-motor-1950",
          "title": "Manual de reparacion de motores",
          "description": "Manual completo de reparacion...",
          "year": 1950,
          "type": "image",
          "url": "https://archive.org/details/...",
          "thumbnail": "https://archive.org/services/img/..."
        }
      ]
    },
    "youtube": {
      "label": "Video educativo / animacion",
      "license": "Standard YouTube",
      "search_url": "https://www.youtube.com/results?search_query=...",
      "search_url_es": "https://www.youtube.com/results?search_query=..."
    }
  }
}
```

---

## Integracion web

El JSON de salida se puede consumir directamente desde una web app. Ejemplo minimo:

```html
<script>
fetch('./real_media_output/real_media.json')
  .then(r => r.json())
  .then(data => {
    const chapter16 = data.find(c => c.number === 16);
    chapter16.sources.wikimedia.items.forEach(img => {
      document.body.innerHTML += `
        <figure>
          <img src="${img.thumbnail}" alt="${img.title}" loading="lazy">
          <figcaption>
            ${img.title}
            <small>Fuente: ${img.attribution} · ${img.license}</small>
          </figcaption>
        </figure>
      `;
    });
  });
</script>
```

La Biblia de la Automocion ([github.com/markyuxx/biblia_automocion](https://github.com/markyuxx/biblia_automocion)) usa este mismo sistema para mostrar medios reales con atribucion en sus 120 capitulos.

---

## Sin IA generativa

Este script **no genera imagenes con IA**. Solo encuentra medios reales creados por personas, con atribucion verificable a su autor original y tipo de licencia. Esto es importante para:

- **Legalidad**: Cumplir con licencias Creative Commons y dominio publico
- **Etica**: Dar credito a los creadores originales
- **Calidad**: Usar diagramas tecnicos reales, no alucinaciones de IA
- **Educacion**: Ensenar con materiales verificables y trazables

---

## Como funciona

```
Indice markdown
     │
     ▼
┌─────────────────────────────────────┐
│  Parseo de capitulos                │
│  (numero, titulo, libro, dominio)   │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  Por cada capitulo:                 │
│                                     │
│  1. Traducir keywords ES → EN       │
│  2. Buscar en Wikimedia API         │
│  3. Obtener metadata (autor, lic.)  │
│  4. Buscar en Internet Archive      │
│  5. Generar URL de busqueda YouTube │
│  6. Guardar en cache                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  Salida:                            │
│  - real_media.json (estructurado)   │
│  - real_media.md   (legible)        │
│  - search_cache.json (cache)        │
└─────────────────────────────────────┘
```

### Traduccion de keywords

El script incluye un diccionario ES->EN con ~130 terminos tecnicos automotrices. Si tu temario usa otras palabras clave, edita el objeto `WIKIMEDIA_KEYWORDS` en el script. Por ejemplo:

```javascript
const WIKIMEDIA_KEYWORDS = {
  // Tu dominio
  celula: "cell biology",
  mitosis: "mitosis diagram",
  fotosintesis: "photosynthesis process",
  // ... mas terminos
};
```

---

## Requisitos

- **Node.js >= 14.0.0** (sin dependencias externas)
- Conexion a internet para consultar las APIs

---

## Limitaciones y buenas practicas

- **Rate limiting**: El script incluye retardo entre busquedas (800ms por defecto). Se respetuoso con las APIs publicas.
- **Cache**: Usa `--no-cache` solo cuando necesites resultados frescos.
- **Wikimedia**: Maximo 8 resultados por busqueda. Algunas imagenes pueden no ser relevantes.
- **Internet Archive**: Los resultados varian segun la query. Afina las keywords para mejor precision.
- **YouTube**: Solo genera URLs de busqueda, no resultados directos (la API requiere clave).

---

## Contribuir

Este proyecto es parte del ecosistema de herramientas abiertas de la Biblia de la Automocion.

- Reporta bugs en [GitHub Issues](https://github.com/markyuxx/real-media-search/issues)
- Sugiere mejoras de keywords en el diccionario ES->EN
- Adapta el script a otros dominios (medicina, biologia, fisica...)

---

## Licencia

MIT -- usa, modifica y comparte libremente.

---

## English Summary

**Real Media Search** finds free-licensed images, diagrams, animations, and historical documents from Wikimedia Commons, YouTube, and Internet Archive -- without generative AI. Give it a markdown index of your chapters/topics, and it returns structured JSON with attribution and license info for every result.

```bash
node bin/search-real-media.js --index ./my_index.md --chapter 5
```

Output: `real_media.json`, `real_media.md`, and API cache in your chosen directory.
