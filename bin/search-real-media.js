#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const USER_AGENT = "RealMediaSearch/1.0 (educational; open-source media finder)";

const DOMAIN_RULES = [
  [1, 8, "fundamentos"],
  [9, 20, "motor"],
  [21, 29, "combustion"],
  [30, 37, "sobrealimentacion"],
  [38, 47, "electronica"],
  [48, 56, "transmision"],
  [57, 66, "chasis"],
  [67, 74, "dinamica"],
  [75, 83, "electrificacion"],
  [84, 100, "calibracion"],
  [101, 112, "preparacion"],
  [113, 120, "profesion"]
];

const SOURCE_CONFIG = {
  wikimedia: {
    name: "Wikimedia Commons",
    base: "https://commons.wikimedia.org/w/api.php",
    license: "CC / Public Domain",
    label: "Diagrama / foto libre",
    priority: 1
  },
  youtube: {
    name: "YouTube",
    base: "https://www.youtube.com/results",
    license: "Standard YouTube",
    label: "Video educativo / animacion",
    priority: 2
  },
  internetarchive: {
    name: "Internet Archive",
    base: "https://archive.org/advancedsearch.php",
    license: "Variable / Dominio publico",
    label: "Manual / documento historico",
    priority: 3
  }
};

const WIKIMEDIA_KEYWORDS = {
  turbo: "turbocharger",
  refrigeracion: "engine cooling system",
  lubricacion: "engine lubrication oil",
  compresion: "compression piston engine",
  obd: "OBD2 diagnostic",
  frenos: "brake disc caliper",
  suspension: "car suspension",
  neumaticos: "tyre",
  neumatico: "tyre",
  electricidad: "automotive electrical",
  bateria: "car battery alternator",
  inyeccion: "fuel injection",
  encendido: "ignition spark plug",
  hibridos: "hybrid vehicle",
  distribucion: "timing belt engine",
  admision: "intake manifold engine",
  escape: "exhaust catalyst",
  transmision: "gearbox transmission",
  diferencial: "differential gear",
  aerodinamica: "automotive aerodynamics",
  chasis: "car chassis",
  direccion: "steering system car",
  embrague: "clutch",
  calibracion: "ECU engine",
  mapa: "compressor map turbo",
  motor: "engine",
  arquitectura: "vehicle architecture",
  herramienta: "workshop tools",
  metrologia: "measurement automotive",
  material: "automotive materials",
  tornilleria: "bolt fastener automotive",
  lubricante: "engine oil fluid",
  lectura: "service manual",
  ciclo: "engine cycle otto diesel",
  bloque: "engine block cylinder head",
  pistones: "piston connecting rod",
  levas: "camshaft engine",
  mariposa: "throttle body",
  catalizadores: "catalytic converter",
  fugas: "engine leak compression",
  averias: "engine failure",
  reconstruccion: "engine rebuild",
  estequiometria: "air fuel ratio lambda",
  gasolina: "gasoline engine",
  diesel: "diesel engine",
  bombas: "fuel pump injection",
  sensores: "automotive sensor",
  knock: "knock sensor engine",
  egr: "EGR valve",
  pcv: "PCV valve",
  intercoolers: "intercooler",
  wastegate: "turbo wastegate",
  lag: "turbo lag",
  fiabilidad: "turbo reliability",
  sobrepresion: "turbo overboost",
  modulos: "automotive ECU module",
  can: "CAN bus automotive",
  osciloscopio: "oscilloscope automotive",
  reprogramacion: "ECU coding",
  ciberseguridad: "automotive cybersecurity",
  cajas: "gearbox manual",
  convertidor: "torque converter automatic",
  dct: "dual clutch transmission",
  cvt: "CVT transmission",
  palieres: "driveshaft CV joint",
  traccion: "vehicle drivetrain",
  relaciones: "gear ratio transmission",
  mantenimiento: "transmission maintenance",
  geometria: "chassis geometry",
  muelles: "coil spring suspension",
  silentblocks: "suspension bushing",
  alineacion: "wheel alignment",
  abs: "ABS brake system",
  esp: "electronic stability control",
  peso: "vehicle weight distribution",
  setup: "vehicle setup track",
  resistencia: "aerodynamic drag",
  sustentacion: "downforce aerodynamics",
  splitters: "front splitter",
  difusores: "rear diffuser",
  flujo: "airflow vehicle",
  dinamica: "vehicle dynamics",
  subviraje: "understeer oversteer",
  telemetria: "racing telemetry",
  interpretacion: "data analysis racing",
  motores: "electric motor automotive",
  baterias: "battery pack electric vehicle",
  regeneracion: "regenerative braking",
  carga: "EV charging",
  adas: "ADAS driver assistance",
  vehiculo: "software defined vehicle",
  logs: "engine data log tuning",
  banco: "dyno dynamometer",
  wideband: "wideband lambda sensor",
  egt: "EGT exhaust temperature",
  stage: "stage tuning",
  homologacion: "vehicle homologation",
  etica: "responsible tuning",
  admisiones: "performance intake",
  inyectores: "fuel injector upgrade",
  forjados: "forged engine internals",
  coilover: "coilover suspension",
  track: "track day preparation",
  rally: "rally car preparation",
  presupuesto: "project budget automotive",
  metodo: "diagnostic method",
  documentar: "workshop documentation",
  recambios: "auto parts quality",
  restauracion: "car restoration",
  historia: "automotive history",
  aprender: "automotive learning"
};

function showHelp() {
  console.log(`
  Real Media Search - Buscador de medios educativos sin IA generativa
  ===================================================================

  Busca imagenes, diagramas, videos y documentos historicos en fuentes libres
  (Wikimedia Commons, YouTube e Internet Archive) para cualquier temario tecnico.

  USO:
    node search-real-media.js --index <ruta> [opciones]

  OPCIONES:
    --index <ruta>       Ruta al indice maestro markdown (requerido)
    --output <dir>       Directorio de salida (default: ./real_media_output)
    --chapter <N>        Buscar solo un capitulo especifico
    --no-cache           Ignorar cache y re-buscar todo
    --sources <lista>    Fuentes a usar: wikimedia,youtube,archive (default: todas)
    --delay <ms>         Retardo entre busquedas en ms (default: 800)
    --help               Mostrar esta ayuda

  FORMATO DEL INDICE:
    El indice debe ser un archivo markdown con lineas como:
      ## Nombre del libro/seccion
      1. Titulo del capitulo 1
      2. Titulo del capitulo 2

  EJEMPLOS:
    # Buscar todos los capitulos
    node search-real-media.js --index ./mi_indice.md

    # Buscar solo el capitulo 5
    node search-real-media.js --index ./mi_indice.md --chapter 5

    # Solo Wikimedia, sin cache
    node search-real-media.js --index ./mi_indice.md --sources wikimedia --no-cache

  SALIDA:
    - real_media.json        Resultados completos en JSON
    - real_media.md          Version markdown legible
    - search_cache.json      Cache de respuestas API

  SIN IA GENERATIVA:
    Este script solo encuentra medios reales creados por humanos.
    Cada resultado incluye atribucion al autor y tipo de licencia.
  `);
}

function parseArgs(argv) {
  const args = { sources: null, delay: 800 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") { args.help = true; }
    else if (argv[i] === "--index" && argv[i + 1]) { args.index = argv[++i]; }
    else if (argv[i] === "--output" && argv[i + 1]) { args.output = argv[++i]; }
    else if (argv[i] === "--chapter" && argv[i + 1]) { args.chapter = Number(argv[++i]); }
    else if (argv[i] === "--sources" && argv[i + 1]) { args.sources = argv[++i].split(",").map((s) => s.trim().toLowerCase()); }
    else if (argv[i] === "--delay" && argv[i + 1]) { args.delay = Number(argv[++i]); }
    else if (argv[i] === "--no-cache") { args.noCache = true; }
  }
  return args;
}

function domainFor(number) {
  return DOMAIN_RULES.find(([from, to]) => number >= from && number <= to) || DOMAIN_RULES[0];
}

function buildSearchQueries(chapter) {
  const t = chapter.title.toLowerCase();
  let wmQuery = chapter.title;
  for (const [kw, en] of Object.entries(WIKIMEDIA_KEYWORDS)) {
    if (t.includes(kw)) { wmQuery = en; break; }
  }
  const ytQueryEN = `${wmQuery} engineering how it works`;
  const ytQuery = chapter.title.replace(/:/g, "").replace(/\s+/g, " ").trim();
  return {
    wikimedia: wmQuery,
    wikimedia_es: chapter.title.replace(/:/g, "").replace(/\s+/g, " ").trim(),
    youtube: ytQueryEN,
    youtube_es: ytQuery,
    archive: wmQuery
  };
}

function fetchJSON(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    function attempt(remaining) {
      const req = proto.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              const msg = (json.error.info || json.error.code || "API error").slice(0, 100);
              if (remaining > 0 && (msg.includes("busy") || msg.includes("throttl") || msg.includes("rate"))) {
                const delay = (3 - remaining) * 1500 + Math.random() * 1000;
                setTimeout(() => attempt(remaining - 1), delay);
                return;
              }
              reject(new Error(msg));
            } else {
              resolve(json);
            }
          } catch (_) {
            if (remaining > 0) { attempt(remaining - 1); }
            else { reject(new Error("Invalid JSON response")); }
          }
        });
      });
      req.on("error", () => {
        if (remaining > 0) { setTimeout(() => attempt(remaining - 1), 800); }
        else { reject(new Error("Request failed")); }
      });
      req.setTimeout(12000, () => {
        req.destroy();
        if (remaining > 0) { setTimeout(() => attempt(remaining - 1), 800); }
        else { reject(new Error("Request timeout")); }
      });
    }
    attempt(retries);
  });
}

function wikimediaSearch(query) {
  const params = new URLSearchParams({
    action: "query", list: "search", srsearch: query,
    srnamespace: "6", srlimit: "8", format: "json", origin: "*"
  });
  return fetchJSON(`${SOURCE_CONFIG.wikimedia.base}?${params.toString()}`);
}

function wikimediaFileInfo(titles) {
  if (!titles.length) return Promise.resolve({});
  const batches = [];
  for (let i = 0; i < titles.length; i += 4) batches.push(titles.slice(i, i + 4));
  async function fetchBatch(batch) {
    const params = new URLSearchParams({
      action: "query", prop: "imageinfo", titles: batch.join("|"),
      iiprop: "url|size|extmetadata|user", iiurlwidth: "800", format: "json", origin: "*"
    });
    try {
      const json = await fetchJSON(`${SOURCE_CONFIG.wikimedia.base}?${params.toString()}`);
      return json.query ? json.query.pages : {};
    } catch (_) { return {}; }
  }
  async function fetchAll() {
    const pages = {};
    for (const batch of batches) {
      const result = await fetchBatch(batch);
      Object.assign(pages, result);
      if (batches.length > 1) await sleep(200);
    }
    return { query: { pages } };
  }
  return fetchAll();
}

function internetArchiveSearch(query, maxResults = 6) {
  const q = encodeURIComponent(`(${query}) AND (mediatype:(image OR movies))`);
  const params = new URLSearchParams({ q, fl: "identifier,title,description,year,mediatype", rows: String(maxResults), output: "json" });
  return fetchJSON(`${SOURCE_CONFIG.internetarchive.base}?${params.toString()}`);
}

function buildYoutubeSearchURL(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}+engineering+animation`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch (_) { /* ignore */ }
  return {};
}

function saveCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

function parseIndex(markdown) {
  const chapters = [];
  let currentBook = "";
  markdown.split(/\r?\n/).forEach((line) => {
    const bookMatch = line.match(/^##\s+(.+)$/);
    if (bookMatch) currentBook = bookMatch[1].trim();
    const chMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (!chMatch) return;
    chapters.push({
      number: Number(chMatch[1]),
      title: chMatch[2].trim(),
      book: currentBook,
      domain: domainFor(Number(chMatch[1]))[2]
    });
  });
  return chapters;
}

async function searchChapter(chapter, activeSources) {
  const queries = buildSearchQueries(chapter);
  const result = {
    number: chapter.number, title: chapter.title,
    book: chapter.book, domain: chapter.domain, sources: {}
  };

  console.log(`  [${String(chapter.number).padStart(3, "0")}] Buscando: ${chapter.title}`);

  if (!activeSources || activeSources.includes("wikimedia")) {
    try {
      const wmResponse = await wikimediaSearch(queries.wikimedia);
      const wmPages = (wmResponse.query && wmResponse.query.search) ? wmResponse.query.search : [];
      if (wmPages.length) {
        const fileTitles = wmPages.map((p) => p.title).filter((t) => t.startsWith("File:"));
        if (fileTitles.length) {
          await sleep(400);
          const info = await wikimediaFileInfo(fileTitles);
          const items = [];
          if (info.query && info.query.pages) {
            for (const pageId of Object.keys(info.query.pages)) {
              const page = info.query.pages[pageId];
              const imageinfo = page.imageinfo && page.imageinfo[0];
              if (!imageinfo) continue;
              items.push({
                title: page.title.replace(/^File:/, "").replace(/_/g, " "),
                url: imageinfo.descriptionurl || `https://commons.wikimedia.org/wiki/${page.title.replace(/ /g, "_")}`,
                thumbnail: imageinfo.thumburl || imageinfo.url || null,
                full: imageinfo.url || null,
                width: imageinfo.width || null,
                height: imageinfo.height || null,
                attribution: imageinfo.extmetadata && imageinfo.extmetadata.Artist
                  ? imageinfo.extmetadata.Artist.value.replace(/<[^>]+>/g, "").trim()
                  : "Wikimedia Commons",
                license: imageinfo.extmetadata && imageinfo.extmetadata.LicenseShortName
                  ? imageinfo.extmetadata.LicenseShortName.value : "Ver en Wikimedia"
              });
            }
          }
          result.sources.wikimedia = { label: SOURCE_CONFIG.wikimedia.label, license: SOURCE_CONFIG.wikimedia.license, items };
          console.log(`    Wikimedia: ${items.length} archivos`);
        } else {
          result.sources.wikimedia = { label: SOURCE_CONFIG.wikimedia.label, license: SOURCE_CONFIG.wikimedia.license, items: [] };
          console.log(`    Wikimedia: 0 archivos (${wmPages.length} paginas, sin archivos)`);
        }
      } else {
        result.sources.wikimedia = { label: SOURCE_CONFIG.wikimedia.label, license: SOURCE_CONFIG.wikimedia.license, items: [] };
        console.log(`    Wikimedia: 0 resultados`);
      }
    } catch (e) {
      result.sources.wikimedia = { label: SOURCE_CONFIG.wikimedia.label, license: SOURCE_CONFIG.wikimedia.license, items: [], error: e.message };
      console.log(`    Wikimedia: error (${e.message})`);
    }
  }

  if (!activeSources || activeSources.includes("archive") || activeSources.includes("internetarchive")) {
    try {
      const archiveResponse = await internetArchiveSearch(queries.archive);
      if (archiveResponse.response && archiveResponse.response.docs && archiveResponse.response.docs.length) {
        const items = archiveResponse.response.docs.slice(0, 6).map((doc) => ({
          identifier: doc.identifier,
          title: doc.title || doc.identifier,
          description: (doc.description || "").slice(0, 200),
          year: doc.year || "",
          type: doc.mediatype || "image",
          url: `https://archive.org/details/${doc.identifier}`,
          thumbnail: `https://archive.org/services/img/${doc.identifier}`
        }));
        result.sources.internetarchive = { label: SOURCE_CONFIG.internetarchive.label, license: SOURCE_CONFIG.internetarchive.license, items };
        console.log(`    Internet Archive: ${items.length} resultados`);
      } else {
        result.sources.internetarchive = { label: SOURCE_CONFIG.internetarchive.label, license: SOURCE_CONFIG.internetarchive.license, items: [] };
        console.log(`    Internet Archive: 0 resultados`);
      }
    } catch (e) {
      result.sources.internetarchive = { label: SOURCE_CONFIG.internetarchive.label, license: SOURCE_CONFIG.internetarchive.license, items: [], error: e.message };
      console.log(`    Internet Archive: error (${e.message})`);
    }
  }

  if (!activeSources || activeSources.includes("youtube")) {
    result.sources.youtube = {
      label: SOURCE_CONFIG.youtube.label,
      license: SOURCE_CONFIG.youtube.license,
      search_url: buildYoutubeSearchURL(queries.youtube),
      search_url_es: buildYoutubeSearchURL(queries.youtube_es)
    };
    console.log(`    YouTube: search URLs generadas`);
  }

  return result;
}

function generateMarkdown(results) {
  const lines = [];
  lines.push("# Medios reales encontrados");
  lines.push("");
  lines.push("Medios encontrados sin IA generativa. Atribucion visible en cada resultado.");
  lines.push(`Generado: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");

  for (const chapter of results) {
    lines.push("---");
    lines.push(`## ${String(chapter.number).padStart(3, "0")} - ${chapter.title}`);
    lines.push(`**Libro**: ${chapter.book}`);
    lines.push("");

    for (const [sourceKey, source] of Object.entries(chapter.sources)) {
      const config = SOURCE_CONFIG[sourceKey];
      if (!config) continue;
      lines.push(`### ${config.name} (${source.label})`);
      if (source.search_url) lines.push(`- [Buscar en ${config.name}](${source.search_url})`);
      if (source.search_url_es) lines.push(`- [Buscar en ${config.name} (ES)](${source.search_url_es})`);
      if (source.items && source.items.length) {
        for (const item of source.items) {
          const title = item.title || "Sin titulo";
          const url = item.url || "#";
          const extra = item.license ? ` (${item.license})` : "";
          lines.push(`- [${title}](${url})${extra}`);
        }
      }
      if (!source.items && !source.search_url) lines.push("(sin resultados)");
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.index) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

  const INDEX_PATH = path.resolve(args.index);
  const OUT_DIR = path.resolve(args.output || "./real_media_output");
  const CACHE_PATH = path.join(OUT_DIR, "search_cache.json");
  const RESULT_PATH = path.join(OUT_DIR, "real_media.json");
  const MD_PATH = path.join(OUT_DIR, "real_media.md");

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`Error: No se encuentra el indice: ${INDEX_PATH}`);
    console.error("El indice debe ser un archivo markdown con formato:");
    console.error("  ## Nombre de seccion");
    console.error("  1. Titulo del capitulo 1");
    console.error("  2. Titulo del capitulo 2");
    process.exit(1);
  }

  console.log("Real Media Search - Buscador de medios educativos");
  console.log("=".repeat(55));
  console.log(`Fuentes: Wikimedia Commons, Internet Archive, YouTube`);
  console.log(`Indice:   ${INDEX_PATH}`);
  console.log(`Salida:   ${OUT_DIR}`);
  if (args.chapter) console.log(`Capitulo: ${args.chapter}`);
  if (args.noCache) console.log("Cache:    desactivada");
  if (args.sources) console.log(`Fuentes:  ${args.sources.join(", ")}`);
  console.log("");

  const indexMarkdown = fs.readFileSync(INDEX_PATH, "utf8");
  let chapters = parseIndex(indexMarkdown);
  if (!chapters.length) {
    console.error("Error: No se encontraron capitulos en el indice.");
    process.exit(1);
  }
  console.log(`${chapters.length} capitulos encontrados en el indice.\n`);

  if (args.chapter) {
    chapters = chapters.filter((c) => c.number === args.chapter);
    if (!chapters.length) { console.log(`Capitulo ${args.chapter} no encontrado.`); process.exit(1); }
  }

  const cache = args.noCache ? {} : loadCache(CACHE_PATH);
  const results = [];
  const errors = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const cacheKey = String(chapter.number);

    if (!args.noCache && cache[cacheKey]) {
      console.log(`  [${String(chapter.number).padStart(3, "0")}] Cache hit: ${chapter.title}`);
      results.push(cache[cacheKey]);
      continue;
    }

    try {
      const result = await searchChapter(chapter, args.sources);
      if (!args.noCache) { cache[cacheKey] = result; saveCache(CACHE_PATH, cache); }
      results.push(result);
    } catch (e) {
      console.error(`  [${String(chapter.number).padStart(3, "0")}] ERROR: ${e.message}`);
      errors.push({ chapter: chapter.number, title: chapter.title, error: e.message });
    }

    if (i < chapters.length - 1) await sleep(args.delay);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(MD_PATH, generateMarkdown(results), "utf8");

  const stats = { total: results.length, wikimedia: 0, archive: 0, youtube: 0 };
  for (const r of results) {
    if (r.sources.wikimedia && r.sources.wikimedia.items) stats.wikimedia += r.sources.wikimedia.items.length;
    if (r.sources.internetarchive && r.sources.internetarchive.items) stats.archive += r.sources.internetarchive.items.length;
    if (r.sources.youtube && r.sources.youtube.search_url) stats.youtube += 1;
  }

  console.log("");
  console.log("=".repeat(55));
  console.log("Resultados:");
  console.log(`  Capitulos procesados:   ${results.length}`);
  console.log(`  Imagenes Wikimedia:     ${stats.wikimedia}`);
  console.log(`  Internet Archive:       ${stats.archive}`);
  console.log(`  Capitulos con YouTube:  ${stats.youtube}`);
  if (errors.length) console.log(`  Errores:                ${errors.length}`);
  console.log("");
  console.log(`JSON:     ${RESULT_PATH}`);
  console.log(`Markdown: ${MD_PATH}`);

  if (errors.length) {
    console.log("\nErrores:");
    for (const e of errors) console.log(`  Capitulo ${e.chapter}: ${e.error}`);
  }
}

main().catch((e) => { console.error("Error fatal:", e.message); process.exit(1); });
