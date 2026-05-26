#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const USER_AGENT = "RealMediaSearch/2.0 (mega-search engine; educational)";

const SOURCE_CONFIG = {
  wikimedia: { name: "Wikimedia Commons", base: "https://commons.wikimedia.org/w/api.php", license: "CC / Public Domain" },
  openverse: { name: "Openverse", base: "https://api.openverse.org/v1", license: "CC / Public Domain" },
  wikimedia_video: { name: "Wikimedia Video", base: "https://commons.wikimedia.org/w/api.php", license: "CC / Public Domain" },
  internetarchive: { name: "Internet Archive", base: "https://archive.org/advancedsearch.php", license: "Dominio publico" },
  youtube: { name: "YouTube", base: "https://www.youtube.com/results", license: "Standard YouTube" }
};

const DOMAIN_RULES = [[1,8,"fundamentos"],[9,20,"motor"],[21,29,"combustion"],[30,37,"sobrealimentacion"],[38,47,"electronica"],[48,56,"transmision"],[57,66,"chasis"],[67,74,"dinamica"],[75,83,"electrificacion"],[84,100,"calibracion"],[101,112,"preparacion"],[113,120,"profesion"]];

function showHelp() {
  console.log(`
  Real Media Search v2.0 - Buscador MEGA-INTENSIVO
  ===============================================

  Busca imagenes, diagramas Y VIDEOS en 5 fuentes:
    Wikimedia Commons + Openverse + Wikimedia Video + Internet Archive + YouTube
  Sin IA generativa. Atribucion verificable de fuente y licencia.

  USO:
    node search-real-media.js --index <ruta> [opciones]

  OPCIONES:
    --index <ruta>       Ruta al indice maestro markdown (requerido)
    --output <dir>       Directorio de salida (default: ./real_media_output)
    --chapter <N>        Buscar solo un capitulo
    --no-cache           Ignorar cache y re-buscar todo
    --sources <lista>    Fuentes: wikimedia,openverse,wikimedia_video,archive,youtube
    --delay <ms>         Retardo entre busquedas ms (default: 1000)
    --help               Mostrar esta ayuda

  FORMATO DEL INDICE:
    ## Nombre del libro
    1. Titulo del capitulo 1
    2. Titulo del capitulo 2
  `);
}

function parseArgs(argv) {
  const args = { sources: null, delay: 1000 };
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

function domainFor(number) { return DOMAIN_RULES.find(([a,b]) => number>=a && number<=b) || DOMAIN_RULES[0]; }

function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    function attempt(remaining) {
      const req = proto.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          try { const json = JSON.parse(data); if (json.error) { reject(new Error((json.error.info || "API error").slice(0, 120))); } else resolve(json); }
          catch (_) { if (remaining > 0) setTimeout(() => attempt(remaining - 1), 1000); else reject(new Error("Invalid JSON")); }
        });
      });
      req.on("error", () => { if (remaining > 0) setTimeout(() => attempt(remaining - 1), 800); else reject(new Error("Request failed")); });
      req.setTimeout(18000, () => { req.destroy(); if (remaining > 0) setTimeout(() => attempt(remaining - 1), 800); else reject(new Error("Timeout")); });
    }
    attempt(retries);
  });
}

async function wikimediaImageSearch(query, max = 12) {
  const p = new URLSearchParams({ action: "query", list: "search", srsearch: query, srnamespace: "6", srlimit: String(max), format: "json", origin: "*" });
  return fetchJSON(`${SOURCE_CONFIG.wikimedia.base}?${p}`);
}

async function wikimediaVideoSearch(query, max = 6) {
  const p = new URLSearchParams({ action: "query", list: "search", srsearch: `${query} filetype:video`, srnamespace: "6", srlimit: String(max), format: "json", origin: "*" });
  return fetchJSON(`${SOURCE_CONFIG.wikimedia_video.base}?${p}`);
}

async function wikimediaFileInfo(titles) {
  if (!titles.length) return {};
  const batches = [];
  for (let i = 0; i < titles.length; i += 4) batches.push(titles.slice(i, i + 4));
  const pages = {};
  for (const batch of batches) {
    const p = new URLSearchParams({ action: "query", prop: "imageinfo", titles: batch.join("|"), iiprop: "url|size|extmetadata|user|mediatype", iiurlwidth: "800", format: "json", origin: "*" });
    try { const j = await fetchJSON(`${SOURCE_CONFIG.wikimedia.base}?${p}`); if (j.query) Object.assign(pages, j.query.pages); } catch (_) {}
    if (batches.length > 1) await sleep(200);
  }
  return pages;
}

async function openverseSearch(query, max = 10) {
  const p = new URLSearchParams({ q: query, license: "cc0,by,by-sa,by-nc,by-nc-sa,pdm", page_size: String(max), source: "flickr,rawpixel,smithsonian", mature: "false" });
  try { return await fetchJSON(`${SOURCE_CONFIG.openverse.base}/images/?${p}`); } catch (_) { return { results: [] }; }
}

async function internetArchiveSearch(query, max = 8) {
  const q = encodeURIComponent(`(${query}) AND (mediatype:movies OR mediatype:image)`);
  const p = new URLSearchParams({ q, fl: "identifier,title,description,year,mediatype", rows: String(max), output: "json" });
  return fetchJSON(`${SOURCE_CONFIG.internetarchive.base}?${p}`);
}

function buildYoutubeURL(query) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}+engineering+animation+explained`; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function loadCache(p) { try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {} return {}; }
function saveCache(p, c) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(c, null, 2), "utf8"); }

function parseIndex(markdown) {
  const ch = [];
  let book = "";
  markdown.split(/\r?\n/).forEach((l) => {
    const bm = l.match(/^##\s+(.+)$/);
    if (bm) book = bm[1].trim();
    const cm = l.match(/^(\d+)\.\s+(.+)$/);
    if (cm) ch.push({ number: Number(cm[1]), title: cm[2].trim(), book, domain: domainFor(Number(cm[1]))[2] });
  });
  return ch;
}

async function searchChapter(chapter, activeSources) {
  const t = chapter.title.toLowerCase();
  let wmQ = chapter.title;
  const kws = { turbo:"turbocharger", refrigeracion:"engine cooling system", motor:"engine", frenos:"brake disc caliper", suspension:"car suspension", transmision:"gearbox transmission", inyeccion:"fuel injection", encendido:"ignition spark plug", lubricacion:"engine lubrication oil", compresion:"compression piston engine", diferencial:"differential gear", aerodinamica:"automotive aerodynamics", chasis:"car chassis", direccion:"steering system", embrague:"clutch", bateria:"car battery alternator", hibridos:"hybrid vehicle", obd:"OBD2 diagnostic", neumaticos:"tyre", distribucion:"timing belt", admision:"intake manifold", escape:"exhaust catalyst", calibracion:"ECU engine tun", sensores:"automotive sensor", cajas:"gearbox manual", convertidor:"torque converter", abs:"ABS brake system", muelles:"coil spring suspension", cvt:"CVT transmission", motores:"electric motor", carga:"EV charging", adas:"driver assistance" };
  for (const [kw, en] of Object.entries(kws)) { if (t.includes(kw)) { wmQ = en; break; } }
  const titleES = chapter.title.replace(/:/g, "").replace(/\s+/g, " ").trim();
  const result = { number: chapter.number, title: chapter.title, book: chapter.book, domain: chapter.domain, sources: {} };

  console.log(`  [${String(chapter.number).padStart(3, "0")}] Buscando: ${chapter.title}`);

  if (!activeSources || activeSources.includes("wikimedia")) {
    try {
      const wm = await wikimediaImageSearch(wmQ, 12);
      const pages = (wm.query && wm.query.search) ? wm.query.search : [];
      if (pages.length) {
        const titles = pages.map((p) => p.title).filter((t) => t.startsWith("File:") && !/\.(ogv|webm|mp4)$/i.test(t));
        if (titles.length) { await sleep(300); const info = await wikimediaFileInfo(titles); const items = []; for (const pid of Object.keys(info)) { const pg = info[pid], ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || ii.mediatype === "VIDEO") continue; items.push({ title: pg.title.replace(/^File:/, "").replace(/_/g, " "), url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g, "_")}`, thumbnail: ii.thumburl || ii.url || null, full: ii.url || null, width: ii.width, height: ii.height, attribution: ii.extmetadata && ii.extmetadata.Artist ? ii.extmetadata.Artist.value.replace(/<[^>]+>/g, "").trim() : "Wikimedia", license: ii.extmetadata && ii.extmetadata.LicenseShortName ? ii.extmetadata.LicenseShortName.value : "CC", type: "image" }); } result.sources.wikimedia = { label: "Diagrama / foto libre", license: "CC / Public Domain", items }; console.log(`    Wikimedia: ${items.length} imagenes`); }
        else { result.sources.wikimedia = { label: "Diagrama / foto libre", license: "CC / Public Domain", items: [] }; console.log("    Wikimedia: 0 imagenes"); }
      } else { result.sources.wikimedia = { label: "Diagrama / foto libre", license: "CC / Public Domain", items: [] }; console.log("    Wikimedia: 0 resultados"); }
    } catch (e) { result.sources.wikimedia = { label: "Diagrama / foto libre", license: "CC / Public Domain", items: [], error: e.message }; console.log("    Wikimedia: error"); }
  }

  if (!activeSources || activeSources.includes("openverse")) {
    try {
      const ov = await openverseSearch(wmQ, 10);
      const ovr = (ov.results || []).slice(0, 8);
      if (ovr.length) { const items = ovr.map((r) => ({ title: r.title || "Imagen", url: r.foreign_landing_url || r.url || "#", thumbnail: r.thumbnail || r.url || null, full: r.url || null, width: r.width, height: r.height, attribution: r.creator || "Openverse", license: r.license || "CC", type: "image" })); result.sources.openverse = { label: "Imagen CC verificada", license: "CC / Public Domain", items }; console.log(`    Openverse: ${items.length} imagenes`); }
      else { result.sources.openverse = { label: "Imagen CC verificada", license: "CC / Public Domain", items: [] }; console.log("    Openverse: 0"); }
    } catch (e) { result.sources.openverse = { label: "Imagen CC verificada", license: "CC / Public Domain", items: [], error: e.message }; console.log("    Openverse: error"); }
  }

  if (!activeSources || activeSources.includes("wikimedia_video")) {
    try {
      const wmv = await wikimediaVideoSearch(wmQ + " engine animation", 8);
      const pages = (wmv.query && wmv.query.search) ? wmv.query.search : [];
      if (pages.length) { const titles = pages.map((p) => p.title).filter((t) => t.startsWith("File:")); if (titles.length) { await sleep(300); const info = await wikimediaFileInfo(titles); const items = []; for (const pid of Object.keys(info)) { const pg = info[pid], ii = pg.imageinfo && pg.imageinfo[0]; if (!ii) continue; const isV = ii.mediatype === "VIDEO" || /\.(ogv|webm|mp4)$/i.test(pg.title); items.push({ title: pg.title.replace(/^File:/, "").replace(/_/g, " "), url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g, "_")}`, thumbnail: ii.thumburl || ii.url || null, full: ii.url || null, width: ii.width, height: ii.height, attribution: ii.extmetadata && ii.extmetadata.Artist ? ii.extmetadata.Artist.value.replace(/<[^>]+>/g, "").trim() : "Wikimedia", license: ii.extmetadata && ii.extmetadata.LicenseShortName ? ii.extmetadata.LicenseShortName.value : "CC", type: isV ? "video" : "image", embed_url: isV ? `https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g, "_")}?embedplayer=yes` : null }); } result.sources.wikimedia_video = { label: "Video educativo libre", license: "CC / Public Domain", items }; console.log(`    Wikimedia Videos: ${items.length}`); }
      else { result.sources.wikimedia_video = { label: "Video educativo libre", license: "CC / Public Domain", items: [] }; console.log("    Wikimedia Videos: 0"); } } else { result.sources.wikimedia_video = { label: "Video educativo libre", license: "CC / Public Domain", items: [] }; console.log("    Wikimedia Videos: 0 resultados"); }
    } catch (e) { result.sources.wikimedia_video = { label: "Video educativo libre", license: "CC / Public Domain", items: [], error: e.message }; console.log("    Wikimedia Videos: error"); }
  }

  if (!activeSources || activeSources.includes("archive") || activeSources.includes("internetarchive")) {
    try {
      const ia = await internetArchiveSearch(wmQ, 8);
      if (ia.response && ia.response.docs && ia.response.docs.length) { const items = ia.response.docs.slice(0, 6).map((d) => ({ identifier: d.identifier, title: d.title || d.identifier, description: (d.description || "").slice(0, 200), year: d.year || "", type: d.mediatype || "document", url: `https://archive.org/details/${d.identifier}`, thumbnail: `https://archive.org/services/img/${d.identifier}`, embed_url: d.mediatype === "movies" ? `https://archive.org/embed/${d.identifier}` : null })); result.sources.internetarchive = { label: "Documento / video historico", license: "Dominio publico", items }; console.log(`    Internet Archive: ${items.length}`); }
      else { result.sources.internetarchive = { label: "Documento / video historico", license: "Dominio publico", items: [] }; console.log("    Internet Archive: 0"); }
    } catch (e) { result.sources.internetarchive = { label: "Documento / video historico", license: "Dominio publico", items: [], error: e.message }; console.log("    Internet Archive: error"); }
  }

  if (!activeSources || activeSources.includes("youtube")) {
    result.sources.youtube = { label: "Video / animacion", license: "Standard YouTube", search_url: buildYoutubeURL(wmQ + " engineering how it works"), search_url_es: buildYoutubeURL(titleES + " funcionamiento animacion") };
    console.log("    YouTube: search URLs generadas");
  }

  return result;
}

function generateMarkdown(results) {
  const lines = ["# Medios reales encontrados", "", "Busqueda mega-intensiva: Wikimedia + Openverse + Video + Internet Archive + YouTube", `Generado: ${new Date().toISOString().slice(0, 10)}`, ""];
  for (const ch of results) {
    lines.push("---", `## ${String(ch.number).padStart(3, "0")} - ${ch.title}`, `**Libro**: ${ch.book}`, "");
    for (const [sk, s] of Object.entries(ch.sources)) {
      const cfg = SOURCE_CONFIG[sk]; if (!cfg) continue;
      lines.push(`### ${cfg.name}`);
      if (s.search_url) lines.push(`- [Buscar en ${cfg.name}](${s.search_url})`);
      if (s.items && s.items.length) { for (const i of s.items) { const t = i.title || "Sin titulo", u = i.url || "#", l = i.license ? ` (${i.license})` : ""; lines.push(`- [${t}](${u})${l}${i.type === "video" ? " [VIDEO]" : ""}`); } }
      if (!s.items && !s.search_url) lines.push("(sin resultados)");
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.index) { showHelp(); process.exit(args.help ? 0 : 1); }

  const INDEX_PATH = path.resolve(args.index);
  const OUT_DIR = path.resolve(args.output || "./real_media_output");
  const CACHE_PATH = path.join(OUT_DIR, "search_cache.json");
  const RESULT_PATH = path.join(OUT_DIR, "real_media.json");

  if (!fs.existsSync(INDEX_PATH)) { console.error(`Error: Indice no encontrado: ${INDEX_PATH}`); process.exit(1); }

  console.log("Real Media Search v2.0 - Buscador MEGA-INTENSIVO");
  console.log("=".repeat(55));
  console.log("Fuentes: Wikimedia + Openverse + Video + Internet Archive + YouTube");
  console.log(`Indice: ${INDEX_PATH}`);
  console.log(`Salida: ${OUT_DIR}`);
  if (args.chapter) console.log(`Capitulo: ${args.chapter}`);
  if (args.noCache) console.log("Cache: desactivada");
  console.log("");

  const chapters = parseIndex(fs.readFileSync(INDEX_PATH, "utf8")).filter((c) => !args.chapter || c.number === args.chapter);
  if (!chapters.length) { console.error("No se encontraron capitulos."); process.exit(1); }
  console.log(`${chapters.length} capitulos a procesar.\n`);

  const cache = args.noCache ? {} : loadCache(CACHE_PATH);
  const results = [], errors = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i], key = String(ch.number);
    if (!args.noCache && cache[key]) { console.log(`  [${String(ch.number).padStart(3, "0")}] Cache: ${ch.title}`); results.push(cache[key]); continue; }
    try { const r = await searchChapter(ch, args.sources); if (!args.noCache) { cache[key] = r; saveCache(CACHE_PATH, cache); } results.push(r); }
    catch (e) { console.error(`  ERROR: ${e.message}`); errors.push({ chapter: ch.number, error: e.message }); }
    if (i < chapters.length - 1) await sleep(args.delay);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "real_media.md"), generateMarkdown(results), "utf8");

  const stats = { total: results.length, wikimedia: 0, openverse: 0, wmv: 0, archive: 0, yt: 0, videos: 0 };
  for (const r of results) {
    if (r.sources.wikimedia && r.sources.wikimedia.items) stats.wikimedia += r.sources.wikimedia.items.length;
    if (r.sources.openverse && r.sources.openverse.items) stats.openverse += r.sources.openverse.items.length;
    if (r.sources.wikimedia_video && r.sources.wikimedia_video.items) { stats.wmv += r.sources.wikimedia_video.items.length; stats.videos += r.sources.wikimedia_video.items.filter((x) => x.type === "video").length; }
    if (r.sources.internetarchive && r.sources.internetarchive.items) { stats.archive += r.sources.internetarchive.items.length; stats.videos += r.sources.internetarchive.items.filter((x) => x.embed_url).length; }
    if (r.sources.youtube && r.sources.youtube.search_url) stats.yt += 1;
  }
  console.log("");
  console.log("=".repeat(55));
  console.log(`Capitulos: ${stats.total} | Wikimedia: ${stats.wikimedia} | Openverse: ${stats.openverse} | Videos WM: ${stats.wmv} | Archive: ${stats.archive} | Videos embebibles: ${stats.videos} | YouTube: ${stats.yt}`);
  if (errors.length) { console.log(`\nErrores: ${errors.length}`); for (const e of errors) console.log(`  ${e.chapter}: ${e.error}`); }
}

main().catch((e) => { console.error("Error fatal:", e.message); process.exit(1); });
