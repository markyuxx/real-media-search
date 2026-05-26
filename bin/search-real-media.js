#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const USER_AGENT = "RealMediaSearch/3.0 (deep search; 12 sources; educational)";
const SEARXNG_INSTANCES = ["https://searx.be","https://search.sapti.me","https://searx.foss.family"];

function showHelp() {
  console.log(`
  Real Media Search v3.0 - Deep Search (12 fuentes)
  ===============================================
  Busca imagenes, diagramas, esquemas, y videos educativos en 12 fuentes.
  Con scoring de relevancia didactica y filtrado de ruido.

  USO:
    node search-real-media.js --index <ruta> [opciones]

  OPCIONES:
    --index <ruta>       Ruta al indice maestro markdown (requerido)
    --output <dir>       Directorio de salida (default: ./real_media_output)
    --chapter <N>        Buscar solo un capitulo
    --no-cache           Ignorar cache
    --sources <lista>    Fuentes: wikimedia,openverse,flickr,searxng,arxiv,core,zenodo,github,archive,youtube
    --delay <ms>         Retardo entre busquedas ms (default: 1500)
    --help               Mostrar ayuda
  `);
}

function parseArgs(a) {
  const r = {sources:null, delay:1500};
  for(let i=0;i<a.length;i++){
    if(a[i]==="--help"||a[i]==="-h") r.help=true;
    else if(a[i]==="--index"&&a[i+1]) r.index=a[++i];
    else if(a[i]==="--output"&&a[i+1]) r.output=a[++i];
    else if(a[i]==="--chapter"&&a[i+1]) r.chapter=Number(a[++i]);
    else if(a[i]==="--sources"&&a[i+1]) r.sources=a[++i].split(",").map(s=>s.trim().toLowerCase());
    else if(a[i]==="--delay"&&a[i+1]) r.delay=Number(a[++i]);
    else if(a[i]==="--no-cache") r.noCache=true;
  }
  return r;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function fetchJSON(url,retries=3,timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    const proto=url.startsWith("https")?https:http;
    function attempt(r){
      const req=proto.get(url,{headers:{"User-Agent":USER_AGENT,"Accept":"application/json"}},(res)=>{
        let d="";res.on("data",c=>d+=c);
        res.on("end",()=>{
          try{const j=JSON.parse(d);if(j.error){const m=String(j.error).slice(0,120);if(r>0&&/(busy|throttl|rate|limit)/i.test(m))return setTimeout(()=>attempt(r-1),2000);reject(new Error(m));}else resolve(j);}
          catch(_){if(r>0)setTimeout(()=>attempt(r-1),1500);else reject(new Error("Invalid JSON"));}
        });
      });
      req.on("error",()=>{if(r>0)setTimeout(()=>attempt(r-1),1000);else reject(new Error("Request failed"));});
      req.setTimeout(timeoutMs,()=>{req.destroy();if(r>0)setTimeout(()=>attempt(r-1),1000);else reject(new Error("Timeout"));});
    }
    attempt(retries);
  });
}

function fetchXML(url,retries=2,timeoutMs=10000){
  return new Promise((resolve,reject)=>{
    const proto=url.startsWith("https")?https:http;
    function attempt(r){
      const req=proto.get(url,{headers:{"User-Agent":USER_AGENT}},(res)=>{
        let d="";res.on("data",c=>d+=c);
        res.on("end",()=>{if(res.statusCode>=400){if(r>0)setTimeout(()=>attempt(r-1),1000);else reject(new Error("HTTP "+res.statusCode));}else resolve(d);});
      });
      req.on("error",()=>{if(r>0)setTimeout(()=>attempt(r-1),1000);else reject(new Error("Request failed"));});
      req.setTimeout(timeoutMs,()=>{req.destroy();if(r>0)setTimeout(()=>attempt(r-1),1000);else reject(new Error("Timeout"));});
    }
    attempt(retries);
  });
}

function scoreItem(item){
  let s=0;const t=(item.title||"").toLowerCase(),d=(item.description||item.summary||"").toLowerCase();
  if(t.endsWith(".svg"))s+=8;
  const pos=[["diagram",5],["schematic",5],["cross section",6],["cutaway",6],["exploded view",5],["labeled",4],["anatomy",4],["technical illustration",5],["illustration",3],["blueprint",4],["working principle",4],["how it works",4],["flow diagram",4],["section view",4],["assembly drawing",4],["figure 1",3],["fig 1",3],["wiring diagram",5],["circuit diagram",5],["block diagram",4],["system diagram",4],["component layout",3],["exploded",4],["schematic diagram",6],["hydraulic",4],["mechanical drawing",4],["engineering drawing",4],["cross-section",6],["isometric",3],["3d view",3]];
  for(const[term,val]of pos){if(t.includes(term)||d.includes(term))s+=val;}
  const neg=[["logo",-20],["interview",-20],["podcast",-15],["promo",-15],["testimonial",-20],["guest",-15],["warm up",-10],["ride onboard",-10],["scenic drive",-10],["split second",-10],["fast fix",-10],["bulldozer",-10],["zion",-10],["oral statement",-20],["hearing",-15],["jury",-15],["testimony",-20],["court",-15],["selfie",-10],["portrait",-5],["wedding",-20],["birthday",-20],["family",-15],["vacation",-15]];
  for(const[term,val]of neg){if(t.includes(term)||d.includes(term))s+=val;}
  if(item.type==="video"){if(t.includes("animation")||t.includes("animated"))s+=5;if(t.includes("3d"))s+=4;if(t.includes("explained"))s+=3;if(d.length>200)s+=2;}
  return s;
}

function badges(title){
  const t=(title||"").toLowerCase(),b=[];
  if(t.endsWith(".svg"))b.push("SVG");
  if(t.includes("diagram")||t.includes("schematic"))b.push("DIAGRAMA");
  if(t.includes("cross")||t.includes("cutaway"))b.push("CORTE");
  if(t.includes("exploded"))b.push("DESPIECE");
  if(t.includes("blueprint"))b.push("PLANO");
  if(t.includes("working")||t.includes("how it works"))b.push("FUNCIONAMIENTO");
  return b;
}

async function fetchSearXNG(q,cat,retry=0){
  if(retry>=SEARXNG_INSTANCES.length*2)return[];
  const idx=retry%SEARXNG_INSTANCES.length,base=SEARXNG_INSTANCES[idx];
  const p=new URLSearchParams({q,format:"json",language:"en,es",categories:cat||"images",pageno:"1"});
  try{
    const j=await fetchJSON(base+"/search?"+p,1,12000);
    return (j.results||[]).map(r=>({title:r.title||"SearXNG",url:r.url||"#",thumbnail:r.thumbnail||r.img_src||null,full:r.img_src||r.url||null,source:"searxng",type:cat==="videos"?"video":"image",attribution:r.engine||"SearXNG",license:"Variable"}));
  }catch(_){await sleep(500);return fetchSearXNG(q,cat,retry+1);}
}

async function wmImageCat(q,max){
  try{const j=await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({action:"query",list:"search",srsearch:q,srnamespace:"6",srlimit:String(max),format:"json",origin:"*"})}`,2,10000);return j;}catch(_){return{};}
}
async function wmImageAny(q,max){
  try{const j=await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({action:"query",list:"search",srsearch:q,srnamespace:"6",srlimit:String(max),format:"json",origin:"*"})}`,2,10000);return j;}catch(_){return{};}
}
async function wmVideo(q,max){
  try{return await fetchJSON(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({action:"query",list:"search",srsearch:q+" filetype:video",srnamespace:"6",srlimit:String(max),format:"json",origin:"*"})}`,2,10000);}catch(_){return{};}
}

async function wmFileInfo(titles){
  if(!titles.length)return{};
  const batches=[];for(let i=0;i<titles.length;i+=4)batches.push(titles.slice(i,i+4));
  const pages={};
  for(const batch of batches){
    const p=new URLSearchParams({action:"query",prop:"imageinfo",titles:batch.join("|"),iiprop:"url|size|extmetadata|user|mediatype",iiurlwidth:"800",format:"json",origin:"*"});
    try{const j=await fetchJSON(`https://commons.wikimedia.org/w/api.php?${p}`,2,8000);if(j.query)Object.assign(pages,j.query.pages);}catch(_){}
    if(batches.length>1)await sleep(200);
  }
  return pages;
}

function wmItem(pg,ii){
  return {title:pg.title.replace(/^File:/,"").replace(/_/g," "),url:ii.descriptionurl||`https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g,"_")}`,thumbnail:ii.thumburl||ii.url||null,full:ii.url||null,attribution:ii.extmetadata&&ii.extmetadata.Artist?ii.extmetadata.Artist.value.replace(/<[^>]+>/g,"").trim():"Wikimedia",license:ii.extmetadata&&ii.extmetadata.LicenseShortName?ii.extmetadata.LicenseShortName.value:"CC",source:"wikimedia",type:"image"};
}

function wmVideoItem(pg,ii,isV){
  return {title:pg.title.replace(/^File:/,"").replace(/_/g," "),url:ii.descriptionurl||`https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g,"_")}`,thumbnail:ii.thumburl||ii.url||null,full:ii.url||null,attribution:ii.extmetadata&&ii.extmetadata.Artist?ii.extmetadata.Artist.value.replace(/<[^>]+>/g,"").trim():"Wikimedia",license:ii.extmetadata&&ii.extmetadata.LicenseShortName?ii.extmetadata.LicenseShortName.value:"CC",source:"wikimedia_video",type:isV?"video":"image",embed_url:isV?`https://commons.wikimedia.org/wiki/${pg.title.replace(/ /g,"_")}?embedplayer=yes`:null};
}

async function flickrSearch(q,max){
  const p=new URLSearchParams({format:"json",nojsoncallback:"1",tags:q,tagmode:"any",per_page:String(max),license:"1,2,3,4,5,6,9,10",sort:"relevance",content_types:"0,1,4"});
  try{const j=await fetchJSON(`https://api.flickr.com/services/feeds/photos_public.gne?${p}`,1,8000);return (j.items||[]).map(r=>{const img=r.media&&r.media.m?r.media.m.replace("_m.jpg","_b.jpg"):"";return{title:r.title||"Flickr",url:r.link||"#",thumbnail:r.media&&r.media.m?r.media.m:img,full:img,source:"flickr",type:"image",attribution:(r.author||"").replace(/.*?"([^"]+)".*/,"$1")||"Flickr",license:r.license||"CC"};});}catch(_){return[];}
}

async function arxivSearch(q,max){try{const xml=await fetchXML(`http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q.replace(/["']/g,""))}&max_results=${max}&sortBy=relevance`,1,10000);const items=[];const re=/<entry>([\s\S]*?)<\/entry>/g;let m;while((m=re.exec(xml))!==null){const b=m[1];items.push({title:((b.match(/<title[^>]*>([\s\S]*?)<\/title>/))||[,""])[1].trim(),url:((b.match(/<link[^>]*href="([^"]+)"/))||[,""])[1],description:((b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/))||[,""])[1].trim().slice(0,300),source:"arxiv",type:"image",attribution:"ArXiv",license:"Open Access"});}return items;}catch(_){return[];}
}

async function coreSearch(q,max){try{const j=await fetchJSON(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(q)}&limit=${max}`,1,8000);return (j.results||[]).map(r=>({title:r.title||"Core",url:`https://core.ac.uk/works/${r.id}`||"#",description:(r.abstract||"").slice(0,300),source:"core",type:"image",attribution:r.authors?r.authors.slice(0,2).join(", "):"Core.ac.uk",license:"Open Access"}));}catch(_){return[];}
}

async function zenodoSearch(q,max){try{const j=await fetchJSON(`https://zenodo.org/api/records?q=${encodeURIComponent(q)}&size=${max}&sort=mostrelevance`,1,8000);return (j.hits&&j.hits.hits||[]).map(r=>{const m=r.metadata||{};const f=r.files||[];const img=f.find(x=>/\.(png|jpg|jpeg|svg|gif)$/i.test(x.key));return{title:m.title||"Zenodo",url:`https://zenodo.org/record/${r.id}`||"#",thumbnail:img?img.links.self||img.links.download:null,full:img?img.links.self||img.links.download:null,description:(m.description||"").slice(0,300),source:"zenodo",type:"image",attribution:m.creators?m.creators.map(c=>c.name).join(", "):"Zenodo",license:m.license?m.license.id||m.license:"Open"};});}catch(_){return[];}
}

async function githubSearch(q,max){try{const j=await fetchJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(q+' SVG diagram schematic in:readme in:path sort:stars')}&per_page=${max}&sort=stars`,1,8000);return (j.items||[]).map(r=>({title:`[GitHub] ${r.full_name}`,url:r.html_url||"#",description:(r.description||"").slice(0,200),source:"github",type:"image",attribution:r.owner?r.owner.login:"GitHub",license:r.license?r.license.spdx_id||r.license.key:"Open Source"}));}catch(_){return[];}
}

async function iaSearch(q,max){try{const j=await fetchJSON(`https://archive.org/advancedsearch.php?${new URLSearchParams({q:encodeURIComponent(`(${q}) AND (mediatype:movies OR mediatype:image)`),fl:"identifier,title,description,year,mediatype",rows:String(max),output:"json"})}`,2,12000);return(j.response&&j.response.docs)||[];}catch(_){return[];}
}

function buildYoutubeURL(q){return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}+engineering+animation+explained+how+it+works`;}

function parseIndex(md){const ch=[];let b="";for(const l of md.split(/\r?\n/)){const m1=l.match(/^##\s+(.+)$/);if(m1)b=m1[1].trim();const m2=l.match(/^(\d+)\.\s+(.+)$/);if(m2)ch.push({number:Number(m2[1]),title:m2[2].trim(),book:b});}return ch;}
function loadCache(p){try{if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,"utf8"));}catch(_){}return{};}
function saveCache(p,c){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(c,null,2),"utf8");}

async function searchChapter(chapter,activeSources){
  const t=chapter.title.toLowerCase();let en=chapter.title;
  const kws={turbo:"turbocharger",refrigeracion:"engine cooling system",motor:"engine",frenos:"brake disc caliper",transmision:"gearbox transmission",inyeccion:"fuel injection",encendido:"ignition",suspension:"car suspension",diferencial:"differential",aerodinamica:"aerodynamics",chasis:"chassis",direccion:"steering",embrague:"clutch",bateria:"car battery",hibridos:"hybrid",obd:"OBD2",abs:"ABS",muelles:"coil spring",cvt:"CVT",calibracion:"ECU tuning",sensores:"automotive sensor",escape:"exhaust",admision:"intake manifold",distribucion:"timing chain",lubricacion:"lubrication system",compresion:"engine compression"};
  for(const[kw,v]of Object.entries(kws)){if(t.includes(kw)){en=v;break;}}
  const es=chapter.title.replace(/:/g,"").replace(/\s+/g," ").trim();
  console.log(`  [${String(chapter.number).padStart(3,"0")}] ${chapter.title}`);

  const result={number:chapter.number,title:chapter.title,book:chapter.book,sources:{}};
  const allImages=[], allVideos=[];

  if(!activeSources||activeSources.includes("wikimedia")){
    try{
      const wm=await wmImageCat(en,15);
      const pgs=(wm.query&&wm.query.search)||[];
      if(pgs.length){
        const titles=pgs.map(p=>p.title).filter(x=>x.startsWith("File:")&&!/\.(ogv|webm|mp4)$/i.test(x));
        if(titles.length){await sleep(200);const info=await wmFileInfo(titles);for(const pid of Object.keys(info)){const p=info[pid],ii=p.imageinfo&&p.imageinfo[0];if(!ii||ii.mediatype==="VIDEO")continue;allImages.push(wmItem(p,ii));}}
      }
    }catch(_){}
    if(!allImages.filter(i=>i.source==="wikimedia").length){
      try{const wm2=await wmImageAny(en+" cross section diagram SVG",12);const p2=(wm2.query&&wm2.query.search)||[];if(p2.length){const t2=p2.map(p=>p.title).filter(x=>x.startsWith("File:")&&!/\.(ogv|webm|mp4)$/i.test(x));if(t2.length){await sleep(200);const i2=await wmFileInfo(t2);for(const pid of Object.keys(i2)){const p=i2[pid],ii=p.imageinfo&&p.imageinfo[0];if(!ii||ii.mediatype==="VIDEO")continue;allImages.push(wmItem(p,ii));}}}}catch(_){}
    }
    console.log(`    Wikimedia: ${allImages.filter(i=>i.source==="wikimedia"&&scoreItem(i)>0).length} didacticas`);
  }

  if(!activeSources||activeSources.includes("video")){
    try{
      const wmv=await wmVideo(en+" 3D animation",8);
      const px=(wmv.query&&wmv.query.search)||[];
      if(px.length){
        const t2=px.map(p=>p.title).filter(x=>x.startsWith("File:"));
        if(t2.length){await sleep(200);const i2=await wmFileInfo(t2);for(const pid of Object.keys(i2)){const p=i2[pid],ii=p.imageinfo&&p.imageinfo[0];if(!ii)continue;const isV=ii.mediatype==="VIDEO"||/\.(ogv|webm|mp4)$/i.test(p.title);allVideos.push(wmVideoItem(p,ii,isV));}}
      }
    }catch(_){}
    console.log(`    Videos: ${allVideos.filter(i=>i.type==="video"&&scoreItem(i)>0).length}`);
  }

  if(!activeSources||activeSources.includes("openverse")){
    try{const j=await fetchJSON(`https://api.openverse.org/v1/images/?${new URLSearchParams({q:`${en} cross section diagram`,license:"cc0,by,by-sa,by-nc,by-nc-sa,pdm",page_size:"12",source:"flickr,rawpixel,smithsonian,met,europeana",mature:"false"})}`,1,8000);(j.results||[]).slice(0,8).forEach(x=>{allImages.push({title:x.title||"Openverse",url:x.foreign_landing_url||x.url||"#",thumbnail:x.thumbnail||x.url||null,full:x.url||null,attribution:x.creator||"Openverse",license:x.license||"CC",source:"openverse",type:"image"});});}catch(_){}
  }

  if(!activeSources||activeSources.includes("flickr"))(await flickrSearch(en,6)).forEach(x=>allImages.push(x));
  if(!activeSources||activeSources.includes("searxng")){
    (await fetchSearXNG(en+" cross section schematic diagram","images")).forEach(x=>allImages.push(x));
    (await fetchSearXNG(en+" 3D animation how it works","videos")).forEach(x=>allVideos.push(x));
  }
  if(!activeSources||activeSources.includes("arxiv"))(await arxivSearch(en,4)).forEach(x=>allImages.push(x));
  if(!activeSources||activeSources.includes("core"))(await coreSearch(en,4)).forEach(x=>allImages.push(x));
  if(!activeSources||activeSources.includes("zenodo"))(await zenodoSearch(en,4)).forEach(x=>allImages.push(x));
  if(!activeSources||activeSources.includes("github"))(await githubSearch(en,4)).forEach(x=>allImages.push(x));
  if(!activeSources||activeSources.includes("archive")){(await iaSearch(en,10)).forEach(d=>{allVideos.push({identifier:d.identifier,title:d.title||d.identifier,description:(d.description||"").slice(0,200),year:d.year||"",type:d.mediatype||"document",url:`https://archive.org/details/${d.identifier}`,thumbnail:`https://archive.org/services/img/${d.identifier}`,embed_url:d.mediatype==="movies"?`https://archive.org/embed/${d.identifier}`:null,source:"internetarchive",type:"video"});});}

  if(!activeSources||activeSources.includes("youtube")){
    result.sources.youtube={label:"Video / animacion",license:"Standard YouTube",search_url:buildYoutubeURL(en+" engineering how it works"),search_url_es:buildYoutubeURL(es+" funcionamiento animacion")};
    console.log("    YouTube: search URLs");
  }

  allImages.forEach(i=>i.score=scoreItem(i));
  allVideos.forEach(i=>i.score=scoreItem(i));

  const seen=new Set();
  const dedup=(items)=>{const out=[];const s=new Set();for(const i of items){const k=i.url||i.title;if(!k||s.has(k))continue;s.add(k);out.push(i);}return out;};

  const sortedImages=dedup(allImages.sort((a,b)=>b.score-a.score).filter(i=>i.score>0));
  const sortedVideos=dedup(allVideos.sort((a,b)=>b.score-a.score).filter(i=>i.score>0));

  for(const item of sortedImages){
    if(!result.sources[item.source])result.sources[item.source]={label:item.source,license:item.license||"CC",items:[]};
    result.sources[item.source].items.push({...item,badges:badges(item.title)});
  }
  for(const item of sortedVideos){
    if(!result.sources[item.source])result.sources[item.source]={label:item.source,license:item.license||"Variable",items:[]};
    result.sources[item.source].items.push({...item,score:item.score});
  }

  console.log(`    Total: ${sortedImages.length} imagenes didacticas, ${sortedVideos.length} videos`);
  return result;
}

function generateMarkdown(results){
  const l=["# Real Media Search v3 - Deep Search","","12 fuentes: Wikimedia+Openverse+Flickr+SearXNG+ArXiv+Core+Zenodo+GitHub+Internet Archive+YouTube",`Generado: ${new Date().toISOString().slice(0,10)}`,""];let ti=0,tv=0;
  for(const r of results){const im=Object.values(r.sources||{}).reduce((a,s)=>a+((s.items||[]).filter(x=>x.type!=="video").length),0);const vi=Object.values(r.sources||{}).reduce((a,s)=>a+((s.items||[]).filter(x=>x.type==="video"||x.embed_url).length),0);ti+=im;tv+=vi;l.push(`- **${String(r.number).padStart(3,"0")}**: ${im} imagenes, ${vi} videos`);}
  l.push("",`**Total: ${results.length} capitulos, ${ti} imagenes, ${tv} videos**`,"");
  for(const r of results){l.push("---",`## ${String(r.number).padStart(3,"0")} - ${r.title}`,"");for(const[sk,s]of Object.entries(r.sources||{})){if(!s.items||!s.items.length)continue;l.push(`### ${sk} (${s.items.length} items)`);for(const i of s.items){const b=i.badges&&i.badges.length?` [${i.badges.join("][")}]`:"";l.push(`- ${(i.title||"").slice(0,80)}${b} score:${i.score||0}${i.type==="video"?" [VIDEO]":""}`);}}}
  return l.join("\n");
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help||!args.index){showHelp();process.exit(args.help?0:1);}
  const INDEX_PATH=path.resolve(args.index),OUT_DIR=path.resolve(args.output||"./real_media_output");
  const CACHE_PATH=path.join(OUT_DIR,"search_cache.json"),RESULT_PATH=path.join(OUT_DIR,"real_media.json");
  if(!fs.existsSync(INDEX_PATH)){console.error("Error: Indice no encontrado:",INDEX_PATH);process.exit(1);}
  console.log("Real Media Search v3.0 - Deep Search (12 fuentes)");console.log("=".repeat(55));
  console.log("Fuentes: Wikimedia + Openverse + Flickr + SearXNG + ArXiv + Core + Zenodo + GitHub + IA + YouTube");
  console.log("Indice:",INDEX_PATH,"| Salida:",OUT_DIR);if(args.chapter)console.log("Capitulo:",args.chapter);console.log("");
  const chapters=parseIndex(fs.readFileSync(INDEX_PATH,"utf8")).filter(c=>!args.chapter||c.number===args.chapter);
  if(!chapters.length){console.error("No chapters found.");process.exit(1);}
  console.log(chapters.length,"capitulos.\n");
  const cache=args.noCache?{}:loadCache(CACHE_PATH);const results=[],errors=[];
  for(let i=0;i<chapters.length;i++){
    const ch=chapters[i],key=String(ch.number);
    if(!args.noCache&&cache[key]){console.log(`  [${String(ch.number).padStart(3,"0")}] Cache: ${ch.title}`);results.push(cache[key]);continue;}
    try{const r=await searchChapter(ch,args.sources);if(!args.noCache){cache[key]=r;saveCache(CACHE_PATH,cache);}results.push(r);}
    catch(e){console.error(`  ERROR: ${e.message}`);errors.push({chapter:ch.number,error:e.message});}
    if(i<chapters.length-1)await sleep(args.delay);
  }
  fs.mkdirSync(OUT_DIR,{recursive:true});fs.writeFileSync(RESULT_PATH,JSON.stringify(results,null,2),"utf8");fs.writeFileSync(path.join(OUT_DIR,"real_media.md"),generateMarkdown(results),"utf8");
  let ti=0,tv=0,sf=0;
  for(const r of results){for(const[,s]of Object.entries(r.sources||{})){for(const i of(s.items||[])){if(i.type==="video")tv++;else ti++;}}if(r.sources.youtube)sf++;}
  console.log("","=".repeat(55));
  console.log(`Capitulos: ${results.length} | Imagenes: ${ti} | Videos: ${tv} | YouTube: ${sf}`);
  if(errors.length)console.log("Errores:",errors.length);
}
main().catch(e=>{console.error("Error:",e.message);process.exit(1);});
