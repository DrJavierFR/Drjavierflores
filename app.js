/* =====================================================================
   Dr. Javier Flores — Lógica del sitio (agenda, panel médico, IA)
   No necesitas editar este archivo. La configuración está en config.js
   ===================================================================== */
(function () {
'use strict';

const C = Object.assign({
  API_URL: '', DOCTOR_PASSWORD_HASH: '', WHATSAPP: '525640100596', TELEFONO_VISIBLE: '56 4010 0596',
  INSTAGRAM: 'https://www.instagram.com/dr_javierflores/', INSTAGRAM_USUARIO: '@dr_javierflores',
  DIAS_LABORALES: [1, 2, 3, 4, 5, 6], HORA_INICIO: 8, HORA_FIN: 18, MINUTOS_POR_CITA: 60, DIAS_ADELANTE: 90,
  MODELO_TEXTO: 'gemini-flash-latest', MODELO_IMAGEN_GEMINI: 'gemini-3.1-flash-image'
}, window.JF_CONFIG || {});
const API_URL = String(C.API_URL || '').trim();
const SERVER = !!API_URL;
const TZ = 'America/Mexico_City';

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => '$' + Number(n || 0).toLocaleString('es-MX');
const pad = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, e => { try { const r = fn(e); if (r && r.catch) r.catch(err => { console.error(err); toast(err.message || 'Ocurrió un problema', true); }); } catch (err) { console.error(err); toast(err.message || 'Ocurrió un problema', true); } }); };

let toastTimer;
function toast(msg, bad) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), bad ? 6500 : 4000);
}
window.addEventListener('unhandledrejection', e => { console.error(e.reason); });

function mxNow() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}
function addDays(ds, n) { const [y, m, d] = ds.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
function dow(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function longDate(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
function shortDate(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function hourShort(t) { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`; }
function hour12(t) { const [h, m] = t.split(':').map(Number); const s = h >= 12 ? 'p. m.' : 'a. m.'; return `${((h + 11) % 12) + 1}:${pad(m)} ${s}`; }
function toMin(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; }
function ageFrom(birth) { if (!birth) return ''; const [y, m, d] = birth.split('-').map(Number); const n = mxNow().date.split('-').map(Number); let a = n[0] - y; if (n[1] < m || (n[1] === m && n[2] < d)) a--; return a >= 0 && a < 130 ? a : ''; }
function waLink(text, phone) { return `https://wa.me/${phone || C.WHATSAPP}?text=${encodeURIComponent(text)}`; }

/* SHA-256 (usa WebCrypto; respaldo en JS puro) */
async function sha256(t) {
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = Array.from(new TextEncoder().encode(t)); const l = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    const w = []; for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) { const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) | 0, S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
    H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ---------- servidor (Google Apps Script) ---------- */
async function api(action, data, auth) {
  const body = Object.assign({ action }, data || {});
  if (auth) body.pw = sessionStorage.getItem('jf_pw') || '';
  let r;
  try { r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) }); }
  catch (e) { const er = new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); er.code = 'NET'; throw er; }
  const txt = await r.text(); let j;
  try { j = JSON.parse(txt); } catch (e) { const er = new Error('El servidor no respondió bien. Revisa que la implementación esté en "Cualquier persona" (Guía, parte 3).'); er.code = 'NET'; throw er; }
  if (!j.ok) { const er = new Error(j.error || 'Error del servidor'); er.code = j.code || 'ERROR'; if (auth && er.code === 'AUTH') { setTimeout(logout, 50); } throw er; }
  return j;
}

/* ---------- almacenamiento local (modo sin servidor) ---------- */
const KV = (() => {
  let dbp = null;
  const hasIDB = (() => { try { return !!window.indexedDB; } catch (e) { return false; } })();
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const q = indexedDB.open('jf_db', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('kv');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  }));
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => { const t = db.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  return {
    async get(k) { try { if (hasIDB) { const v = await tx('readonly', s => s.get(k)); return v === undefined ? null : v; } } catch (e) { console.warn(e); } try { return JSON.parse(localStorage.getItem('jf_' + k) || 'null'); } catch (e) { return null; } },
    async set(k, v) { try { if (hasIDB) { await tx('readwrite', s => s.put(v, k)); return; } } catch (e) { console.warn(e); } try { localStorage.setItem('jf_' + k, JSON.stringify(v)); } catch (e) { throw new Error('No hay espacio en este dispositivo. Exporta un respaldo y conecta el servidor.'); } }
  };
})();
const lid = p => p + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
/* ---------- catálogo oficial de precios (edita aquí) ---------- */
const CATALOG = [
 {cat:"Neuro",group:"Neuromodulación Facial",sub:"Expresión suavizada, mirada descansada y natural",items:[
  {id:"neuro1",n:"Zona Única",d:"Frente, entreceño o patas de gallo",p:3000,u:"POR ZONA",m:1},
  {id:"neuro2",n:"Combinado — 2 Zonas",d:"Dos áreas de tu elección en una sola sesión",p:5800,u:"COMBINADO",m:1},
  {id:"neurofull",n:"Full Face",d:"Frente + entreceño + patas de gallo",p:8500,u:"PRECIO ÚNICO",r:1,m:1},
  {id:"neurocuello",n:"Full Face & Cuello",d:"Incluye bandas platismales",p:11000,u:"PRECIO ÚNICO",m:1},
  {id:"hiper",n:"Anti-sudoración (Hiperhidrosis)",d:"Axilas, manos o pies",p:7500,u:"POR ZONA"},
  {id:"bruxismo",n:"Bruxismo & Slim Face",d:"Reducción de maséteros, efecto adelgazante",p:6500,u:"PRECIO ÚNICO",m:1}]},
 {cat:"Neuro",group:"Bioestimuladores de Colágeno",sub:"Regeneración profunda, firmeza y volumen progresivo",items:[
  {id:"sculptra",n:"Sculptra®",d:"Ácido poli-L-láctico; resultados graduales hasta 2 años",p:12500,u:"POR VIAL",m:1},
  {id:"radiesse",n:"Radiesse®",d:"Hidroxiapatita cálcica; efecto inmediato + bioestimulación",p:10500,u:"POR JERINGA",r:1,m:1}]},
 {cat:"Fillers",group:"Fillers & Voluminización Facial",sub:"Ácido hialurónico para contornos equilibrados",items:[
  {id:"labios",n:"Volumen & Definición de Labios",d:"Contorno y proyección natural, desde 1 ml",p:5200,u:"POR SESIÓN",m:1},
  {id:"nariz",n:"Perfilado Nasal sin Cirugía",d:"Corrección de irregularidades del perfil",p:6500,u:"POR SESIÓN",m:1},
  {id:"perfil",n:"Perfil Armónico Completo",d:"Nariz + labios en la misma sesión",p:10800,u:"PRECIO ÚNICO",r:1,m:1},
  {id:"menton",n:"Proyección de Mentón",d:"Definición y balance del tercio inferior",p:7500,u:"POR SESIÓN",m:1},
  {id:"pomulos",n:"Proyección de Pómulos",d:"Volumen y estructura del tercio medio",p:9000,u:"POR SESIÓN",m:1},
  {id:"mandibula",n:"Perfilado Mandibular",d:"Definición de ángulos y contorno de jawline",p:10000,u:"POR SESIÓN",m:1},
  {id:"femin",n:"Feminización Facial",d:"Labios + pómulos + mentón",p:17000,u:"PRECIO ÚNICO",tag:"PLAN",m:1},
  {id:"mascu",n:"Masculinización Facial",d:"Mandíbula + mentón + pómulos",p:17000,u:"PRECIO ÚNICO",tag:"PLAN",m:1},
  {id:"retoque",n:"Retoque de Mantenimiento",d:"A los 6-9 meses, pacientes previos",p:3800,u:"POR ZONA"}]},
 {cat:"Fillers",group:"Hilos & Recolagenizantes",sub:"Lifting no quirúrgico y estímulo de colágeno",items:[
  {id:"hilos",n:"Hilos Tensores",d:"Reposicionamiento de tejidos, efecto lifting inmediato",p:8500,u:"SESIÓN COMPLETA",r:1,m:1},
  {id:"hilosrc",n:"Hilos Recolagenizantes",d:"Mejora de textura y firmeza",p:5500,u:"POR SESIÓN",m:1}]},
 {cat:"Piel",group:"Rejuvenecimiento & Luminosidad",sub:"Bioestimulación con activos de alta tecnología",items:[
  {id:"rejuv",n:"Sesión de Rejuvenecimiento Facial",d:"Protocolo de bioestimulación y nutrición profunda",p:1800,u:"POR SESIÓN",m:1},
  {id:"renov3",n:"Plan Renovación Total",d:"Serie de 3 sesiones — resultado acumulativo",p:4800,u:"$1,600 C/SES.",r:1,m:1},
  {id:"renov4",n:"Plan Renovación Intensiva",d:"4 sesiones — daño solar o flacidez incipiente",p:6000,u:"$1,500 C/SES.",m:1},
  {id:"limpieza",n:"Limpieza Facial Profunda",d:"Facial de limpieza",p:700,u:"POR SESIÓN",m:1}]},
 {cat:"Cuerpo",group:"Remodelación Corporal",sub:"Estimulación corporal",items:[
  {id:"gluteos",n:"Glúteos con Peptonas",d:"Volumen, firmeza y reafirmación progresiva",p:4500,u:"POR SESIÓN",r:1,m:1}]},
 {cat:"Peso",group:"Plan Mensual Pérdida de Peso",sub:"Programa médico supervisado",items:[
  {id:"evalpeso",n:"Consulta de Evaluación",d:"Historia clínica, metas, laboratorios y plan",p:800,u:"PRIMERA VISITA"},
  {id:"mounjaro",n:"Mounjaro® (Tirzepatide)",d:"Plan mensual con aplicación y seguimiento",p:12500,u:"MENSUAL",r:1,m:1},
  {id:"wegovy",n:"Wegovy® (Semaglutide)",d:"Plan mensual con aplicación y seguimiento",p:9800,u:"MENSUAL",m:1}]}
];
const ALL = CATALOG.flatMap(g => g.items);
const VALORACION = { id: 'valoracion', n: 'Valoración / consulta inicial', d: 'Primera visita, historia clínica y plan', p: 0 };
const byId = id => id === 'valoracion' ? VALORACION : ALL.find(i => i.id === id);
const TOX = ['neuro1', 'neuro2', 'neurofull', 'neurocuello', 'bruxismo', 'hiper'];
const HA = ['labios', 'nariz', 'perfil', 'menton', 'pomulos', 'mandibula', 'femin', 'mascu', 'retoque'];
const BIO = ['sculptra', 'radiesse'], THR = ['hilos', 'hilosrc'], SKIN = ['rejuv', 'renov3', 'renov4', 'limpieza'], GLP = ['mounjaro', 'wegovy'];
const INJ = TOX.concat(HA, BIO, THR, ['gluteos']);
const LIPS = ['labios', 'perfil', 'femin'];
/* Instrucciones clínicas para la modelación de imagen (qué cambia y qué NO debe cambiar) */
const MODEL = {
 neuro1:"Botulinum toxin to ONE upper-face zone (forehead OR glabella OR crow's feet; choose the zone with the most visible dynamic lines). Soften those lines by about 60-80%. Keep natural skin texture and natural eyebrow position (no frozen look, no brow ptosis). No volume or shape changes.",
 neuro2:"Botulinum toxin to TWO upper-face zones (the two with most visible lines among forehead, glabella, crow's feet). Smooth those lines, natural relaxed look, slight eyebrow-tail lift allowed. No volume, shape or skin color changes.",
 neurofull:"Full upper-face botulinum toxin: horizontal forehead lines, glabellar '11' lines and crow's feet softened about 70%. Eyes look more rested, subtle lateral brow lift of 1-2 mm. Keep pores and texture. No volume or contour changes.",
 neurocuello:"Full upper-face botulinum toxin (forehead, glabella, crow's feet softened) plus Nefertiti neck lift: platysmal bands softened and the jaw border slightly more defined. No filler effect.",
 bruxismo:"Masseter botulinum toxin (slim face): reduce masseter bulk at the lower lateral face near the jaw angle by about 20-30%, producing a softer, more oval V-shaped lower face. Do NOT change cheekbones, chin, lips or skin.",
 sculptra:"Poly-L-lactic acid biostimulator (result at 3-6 months): gradual restoration of lost volume in temples, lateral cheeks and pre-jowl area, firmer and thicker skin, subtle reduction of sagging and crepey texture. Natural, global, never 'filled'. Features unchanged.",
 radiesse:"Calcium hydroxylapatite: structural support at cheekbones and jaw contour plus collagen stimulation. Slightly lifted lower face, softer nasolabial folds, firmer skin, better jawline definition. Natural, not overfilled.",
 labios:"Hyaluronic acid lip filler (about 1 ml): lip volume +15-25%, defined vermilion border, slightly everted upper lip, defined Cupid's bow, upper:lower ratio about 1:1.6, hydrated lip surface. Keep natural lip shape and philtrum. No duck lips. Nothing else changes.",
 nariz:"Non-surgical rhinoplasty with hyaluronic acid: camouflage the dorsal hump by filling above and below it for a straighter dorsum, subtle tip projection and slight tip lift, nasolabial angle about 95-105°. Nose width must NOT be reduced (filler cannot narrow). Everything else unchanged.",
 perfil:"Profile harmonization: non-surgical rhinoplasty (straighter dorsum, slight tip projection; nose not narrower) PLUS lip filler (about 1 ml, defined border, natural proportion). Balanced profile, everything else unchanged.",
 menton:"Hyaluronic acid chin projection: increase forward chin projection 2-4 mm toward the Ricketts E-line, better-defined chin, balanced lower third, slightly improved neck-chin angle. Do not over-widen. Rest unchanged.",
 pomulos:"Hyaluronic acid cheek augmentation at the zygomatic eminence: restore mid-face volume and Ogee curve, subtle mid-face lift, softer nasolabial folds and tear-trough transition. Natural highlights. Rest unchanged.",
 mandibula:"Hyaluronic acid jawline contouring: sharper mandibular border from angle to chin, defined jaw angle, reduced jowls, clearer face-neck separation. Natural result. Rest unchanged.",
 femin:"Facial feminization with hyaluronic acid: fuller defined lips, higher apple-cheek projection, softer, narrower tapered chin, heart-shaped face. Soft harmonious features, same identity.",
 mascu:"Facial masculinization with hyaluronic acid: wider, squarer, more projected chin, angular defined jawline and jaw angle, flatter lateral cheek projection. Strong lower face, same identity.",
 hilos:"PDO/PLLA tension threads: non-surgical lift — mid-face and jowls repositioned upward 3-5 mm, sharper jawline, reduced marionette lines and nasolabial depth, slight lateral brow lift. Natural skin, no puckering.",
 hilosrc:"Collagen-stimulating mesh threads: firmer, thicker skin with finer texture, reduced fine lines and mild laxity on cheeks and neck. No structural lift. Subtle overall rejuvenation.",
 rejuv:"One facial biostimulation session (skin boosters and nutrients): more hydrated, luminous, even-toned skin, slightly finer texture, less dullness. No structural changes.",
 renov3:"Three-session biostimulation: clearly more luminous, hydrated and firm skin, more even tone, fewer fine lines, less visible pores, healthy glow. No structural changes.",
 renov4:"Four-session intensive protocol for sun damage and early laxity: reduced sun spots and hyperpigmentation, uniform tone, firmer skin, softened fine lines, improved texture. No structural changes.",
 limpieza:"Deep facial cleansing: fewer blackheads, clearer pores, less oiliness and redness, fresh clean skin. No other changes.",
 gluteos:"Gluteal peptone injections (several sessions): firmer, more lifted, slightly rounder buttocks, improved skin tone, reduced cellulite dimpling. Moderate natural change; keep body proportions and pose.",
 mounjaro:"Supervised tirzepatide weight-loss plan after about 4-6 months: about 10-15% less body weight, reduced abdominal and facial fat, slimmer waist, more defined jawline. Same person, same pose, realistic.",
 wegovy:"Supervised semaglutide weight-loss plan after about 4-6 months: about 8-12% less body weight, reduced abdominal and facial fat, slimmer silhouette. Same person, same pose, realistic."
};
const INT = {sutil:"Make the change SUBTLE (about 50% of a typical result).",moderado:"Make the change MODERATE (typical expected clinical result).",marcado:"Make the change PRONOUNCED but still medically realistic (upper range of expected results)."};

/* Sugerencias complementarias de respaldo (si la IA no responde) */
const COMBO = {
 neuro1:["neurofull","rejuv","radiesse"],neuro2:["neurofull","renov3","pomulos"],neurofull:["pomulos","renov3","labios"],neurocuello:["mandibula","hilos","renov3"],
 bruxismo:["menton","mandibula","pomulos"],sculptra:["neurofull","hilos","renov3"],radiesse:["neurofull","pomulos","renov3"],
 labios:["perfil","menton","neuro1"],nariz:["labios","menton","perfil"],perfil:["menton","pomulos","neurofull"],menton:["mandibula","labios","nariz"],
 pomulos:["neurofull","labios","radiesse"],mandibula:["menton","bruxismo","hilos"],femin:["neurofull","renov3","nariz"],mascu:["neurofull","bruxismo","renov3"],
 hilos:["radiesse","neurofull","renov3"],hilosrc:["renov3","neurofull","sculptra"],rejuv:["renov3","neuro1","limpieza"],renov3:["neurofull","radiesse","limpieza"],
 renov4:["sculptra","neurofull","hilosrc"],limpieza:["renov3","rejuv","neuro1"],gluteos:["evalpeso","mounjaro","sculptra"],mounjaro:["sculptra","gluteos","radiesse"],wegovy:["sculptra","gluteos","radiesse"]
};

const CANONES = [
  'La cara se divide en 2 partes iguales (línea media).',
  'La cara se divide en 3 partes iguales (tercios faciales).',
  'La cara se divide en 5 partes iguales (quintos faciales).',
  'Los ángulos faciales son de lo más importante en el perfilamiento facial.',
  'La longitud de la oreja es igual a la longitud de la nariz.',
  'La distancia entre los ojos es igual a la anchura de cada ojo.',
  'La línea vertical del canto interno de ambos ojos es ideal a la anchura de la base nasal.',
  'Lo ancho de la base nasal es ideal al diámetro del mentón en la mujer.',
  'Lo ancho de las comisuras de la boca es ideal al diámetro del mentón en el hombre.',
  'La proyección ideal del mentón de perfil lateral debe ser a la altura del labio inferior.',
  'El cigomático, el mentón y el ángulo mandibular es lo primero que debemos tratar en pacientes jóvenes.',
  'Siempre que se haga rinomodelación debe considerarse la proyección del mentón.',
  'Siempre que se haga proyección de cigomáticos se debe considerar la proyección de mentón.',
  'Lo ideal es tratar de inicio el tercio superior, seguido del tercio medio, tercio inferior y al final el cuello.'
];

/* ---------- encuesta clínica previa ---------- */
const SURVEY = [
  { sec: 'Datos generales', open: true, f: [
    { k: 'nombre', l: 'Nombre completo *', t: 'text', req: 1 },
    { k: 'nacimiento', l: 'Fecha de nacimiento', t: 'date' },
    { k: 'edad', l: 'Edad (años)', t: 'number' },
    { k: 'sexo', l: 'Sexo', t: 'select', o: ['Femenino', 'Masculino', 'Otro / prefiere no decir'] },
    { k: 'telefono', l: 'Teléfono / WhatsApp', t: 'tel' },
    { k: 'email', l: 'Correo electrónico', t: 'email' },
    { k: 'ocupacion', l: 'Ocupación', t: 'text' },
    { k: 'como', l: '¿Cómo nos conoció?', t: 'select', o: ['Instagram', 'Recomendación', 'Google', 'Facebook', 'Otro'] }
  ] },
  { sec: 'Somatometría', f: [
    { k: 'talla', l: 'Talla (cm)', t: 'number' },
    { k: 'peso', l: 'Peso (kg)', t: 'number' },
    { k: 'imc', l: 'IMC (automático)', t: 'text', ro: 1 },
    { k: 'ta', l: 'Tensión arterial', t: 'text', ph: 'Ej. 120/80' },
    { k: 'cintura', l: 'Cintura (cm)', t: 'number' }
  ] },
  { sec: 'Antecedentes patológicos', f: [
    { k: 'padecimientos', l: 'Padecimientos (marca todos los que apliquen)', t: 'checks', full: 1, o: ['Diabetes', 'Hipertensión', 'Enfermedad tiroidea', 'Enfermedad autoinmune (lupus, artritis, etc.)', 'Miastenia gravis / enfermedad neuromuscular', 'Trastorno de coagulación', 'Epilepsia', 'Cáncer (actual o previo)', 'Ca. medular de tiroides / MEN2 (personal o familiar)', 'Herpes labial recurrente', 'Queloides / cicatriz hipertrófica', 'Manchas tras heridas o acné (HPI)', 'Rosácea', 'Acné activo', 'Melasma', 'Vitíligo', 'Dermatitis / psoriasis', 'Infección activa en la zona', 'Hepatitis / VIH', 'Ninguno'] },
    { k: 'padecimientosOtros', l: 'Otros padecimientos / cirugías / hospitalizaciones', t: 'textarea', full: 1 }
  ] },
  { sec: 'Alergias', f: [
    { k: 'alergias', l: 'Alergias conocidas', t: 'checks', full: 1, o: ['Lidocaína / anestésicos locales', 'Ácido hialurónico / hialuronidasa', 'Albúmina / huevo', 'Reacción previa a toxina botulínica', 'Látex', 'Penicilina / antibióticos', 'AINEs / aspirina', 'Ninguna conocida'] },
    { k: 'alergiasOtras', l: 'Otras alergias y tipo de reacción', t: 'textarea', full: 1 }
  ] },
  { sec: 'Medicamentos y suplementos', f: [
    { k: 'meds', l: 'Toma actualmente', t: 'checks', full: 1, o: ['Anticoagulantes (warfarina, rivaroxabán…)', 'Antiagregantes (aspirina, clopidogrel)', 'AINEs (ibuprofeno, naproxeno)', 'Isotretinoína (últimos 6–12 meses)', 'Antibióticos aminoglucósidos', 'Inmunosupresores / corticoides', 'Retinoides tópicos / ácidos', 'Omega 3, vitamina E, ginkgo, ginseng', 'Anticonceptivos / terapia hormonal', 'Ninguno'] },
    { k: 'medsDetalle', l: 'Nombre y dosis de medicamentos', t: 'textarea', full: 1 }
  ] },
  { sec: 'Ginecológicos y estilo de vida', f: [
    { k: 'embarazo', l: 'Embarazo / lactancia', t: 'select', o: ['No', 'Embarazo', 'Lactancia', 'Posible embarazo', 'No aplica'] },
    { k: 'tabaco', l: 'Tabaquismo', t: 'select', o: ['No', 'Ocasional', 'Diario'] },
    { k: 'alcohol', l: 'Alcohol', t: 'select', o: ['No', 'Social', 'Frecuente'] },
    { k: 'sol', l: 'Exposición solar', t: 'select', o: ['Baja', 'Moderada', 'Alta (trabajo/deporte al aire libre)'] },
    { k: 'fps', l: 'Uso de protector solar', t: 'select', o: ['Diario', 'Ocasional', 'Nunca'] },
    { k: 'sueno', l: 'Horas de sueño', t: 'select', o: ['Menos de 6', '6 a 8', 'Más de 8'] },
    { k: 'ejercicio', l: 'Actividad física', t: 'select', o: ['Sedentario', '1–3 días/semana', '4+ días/semana'] },
    { k: 'skincare', l: 'Rutina de cuidado de piel', t: 'text', ph: 'Ej. limpiador, vitamina C, retinol' }
  ] },
  { sec: 'Antecedentes estéticos', f: [
    { k: 'previos', l: 'Tratamientos previos', t: 'checks', full: 1, o: ['Toxina botulínica', 'Ácido hialurónico', 'Bioestimuladores', 'Hilos', 'Peelings', 'Láser / IPL', 'Cirugía facial', 'Biopolímeros / modelantes permanentes', 'Ninguno'] },
    { k: 'previosDetalle', l: 'Detalle: producto, zona, fecha y resultado', t: 'textarea', full: 1 },
    { k: 'complicaciones', l: '¿Complicaciones previas?', t: 'select', o: ['No', 'Sí'] },
    { k: 'complicacionesDetalle', l: '¿Cuáles?', t: 'text' }
  ] },
  { sec: 'Piel (autorreporte)', f: [
    { k: 'fitzq', l: 'Al exponerse al sol sin protector…', t: 'select', full: 1, o: ['Siempre se quema, nunca se broncea (I)', 'Se quema fácilmente, se broncea poco (II)', 'A veces se quema, se broncea gradualmente (III)', 'Rara vez se quema, se broncea bien (IV)', 'Muy rara vez se quema, piel morena (V)', 'Nunca se quema, piel muy oscura (VI)'] },
    { k: 'tipoPiel', l: 'Tipo de piel', t: 'select', o: ['Seca', 'Normal', 'Mixta', 'Grasa', 'Sensible'] },
    { k: 'pielPreocupa', l: 'Lo que más le preocupa de su piel', t: 'checks', full: 1, o: ['Arrugas', 'Flacidez', 'Manchas', 'Poros', 'Acné / marcas', 'Ojeras', 'Opacidad', 'Rojeces'] }
  ] },
  { sec: 'Motivo de consulta y expectativas', f: [
    { k: 'motivo', l: 'Motivo de consulta (en palabras del paciente)', t: 'textarea', full: 1 },
    { k: 'zonas', l: 'Zonas que desea mejorar', t: 'checks', full: 1, o: ['Frente', 'Entrecejo', 'Patas de gallo', 'Ojeras', 'Pómulos', 'Nariz', 'Surcos nasogenianos', 'Labios', 'Líneas de marioneta', 'Mentón', 'Mandíbula', 'Papada / cuello', 'Calidad de piel', 'Manchas', 'Cuerpo / peso'] },
    { k: 'cambio', l: 'Nivel de cambio deseado', t: 'select', o: ['Muy sutil', 'Natural / moderado', 'Notorio'] },
    { k: 'evento', l: 'Evento próximo / fecha límite', t: 'text' },
    { k: 'presupuesto', l: 'Presupuesto aproximado', t: 'select', o: ['Hasta $5,000', '$5,000–$10,000', '$10,000–$20,000', 'Más de $20,000', 'Prefiere no decir'] },
    { k: 'preocupacion', l: '¿Pasa más de 1 hora al día preocupado(a) por su apariencia?', t: 'select', o: ['No', 'Sí'] }
  ] },
  { sec: 'Consentimientos', f: [
    { k: 'consentImg', l: 'Autoriza el uso de sus fotografías para análisis y modelación con IA (aproximación ilustrativa, no garantiza resultados).', t: 'check', full: 1 },
    { k: 'consentPriv', l: 'Acepta el aviso de privacidad y el resguardo de su expediente clínico.', t: 'check', full: 1 }
  ] }
];

/* ---------- alertas clínicas automáticas (reglas fijas, no dependen de la IA) ---------- */
function fitzFrom(d) { const m = String((d && d.fitzq) || '').match(/\((I{1,3}|IV|V|VI)\)/); return m ? m[1] : ''; }
function clinicalAlerts(d, id, extra) {
  d = d || {}; const A = []; const add = (lvl, txt) => A.push({ lvl, txt });
  const has = (k, s) => arr(d[k]).some(x => x.indexOf(s) === 0);
  const inj = INJ.indexOf(id) >= 0, tox = TOX.indexOf(id) >= 0, ha = HA.indexOf(id) >= 0, bio = BIO.indexOf(id) >= 0, thr = THR.indexOf(id) >= 0, skin = SKIN.indexOf(id) >= 0, glp = GLP.indexOf(id) >= 0;
  const edad = Number(d.edad || ageFrom(d.nacimiento) || 0);
  if (edad && edad < 18) add('alto', 'Paciente menor de 18 años: no realizar procedimientos estéticos sin indicación médica y consentimiento de tutor.');
  if (/Embarazo|Lactancia|Posible/.test(d.embarazo || '') && (inj || glp)) add('alto', `Embarazo/lactancia (${d.embarazo}): diferir ${tox ? 'toxina botulínica' : glp ? 'GLP-1/GIP' : 'el procedimiento inyectable'}.`);
  if (tox && has('padecimientos', 'Miastenia')) add('alto', 'Miastenia gravis / enfermedad neuromuscular: contraindicación para toxina botulínica.');
  if (tox && has('meds', 'Antibióticos aminoglucósidos')) add('alto', 'Aminoglucósidos: potencian el bloqueo neuromuscular de la toxina. Diferir hasta terminar el antibiótico.');
  if (tox && has('alergias', 'Reacción previa a toxina')) add('alto', 'Reacción previa a toxina botulínica: valorar cambio de marca o evitar.');
  if (tox && has('alergias', 'Albúmina')) add('medio', 'Alergia a albúmina/huevo: algunas toxinas contienen albúmina humana. Revisar ficha del producto.');
  if ((ha || id === 'retoque') && has('alergias', 'Ácido hialurónico')) add('alto', 'Alergia a ácido hialurónico / hialuronidasa: contraindicado; además no habría rescate con hialuronidasa.');
  if (inj && has('alergias', 'Lidocaína')) add('medio', 'Alergia a lidocaína: usar producto sin lidocaína y anestesia alternativa.');
  if (inj && has('padecimientos', 'Trastorno de coagulación')) add('alto', 'Trastorno de coagulación: alto riesgo de hematoma; requiere valoración hematológica.');
  if (inj && (has('meds', 'Anticoagulantes') || has('meds', 'Antiagregantes'))) add('medio', 'Anticoagulante/antiagregante: mayor riesgo de equimosis/hematoma. No suspender sin autorización del médico tratante.');
  if (inj && (has('meds', 'AINEs') || has('meds', 'Omega'))) add('medio', 'AINEs o suplementos (omega 3, vit. E, ginkgo): sugerir suspender 7–10 días antes si es seguro.');
  if (LIPS.indexOf(id) >= 0 && has('padecimientos', 'Herpes labial')) add('medio', 'Herpes labial recurrente: considerar profilaxis antiviral antes del relleno de labios.');
  if ((ha || bio || thr) && has('padecimientos', 'Enfermedad autoinmune')) add('medio', 'Enfermedad autoinmune: mayor riesgo de reacción inflamatoria tardía/nódulos. Tratar solo con enfermedad controlada.');
  if ((ha || bio || thr) && has('previos', 'Biopolímeros')) add('alto', 'Antecedente de biopolímeros/modelantes: evitar inyectar en esa zona (riesgo de granulomas e infección). Considerar imagen por ultrasonido.');
  if (inj && (has('padecimientos', 'Infección activa') || has('padecimientos', 'Acné activo'))) add('alto', 'Infección o acné activo en la zona: diferir hasta resolver.');
  if (thr && has('padecimientos', 'Queloides')) add('medio', 'Queloides/cicatriz hipertrófica: precaución con hilos y puntos de entrada.');
  if ((skin || thr) && has('meds', 'Isotretinoína')) add('medio', 'Isotretinoína reciente: cicatrización alterada; evitar procedimientos agresivos sobre la piel.');
  if (has('padecimientos', 'Diabetes') && inj) add('info', 'Diabetes: verificar control glucémico; mayor riesgo de infección y cicatrización lenta.');
  const fz = fitzFrom(d);
  if ((skin || thr) && (['IV', 'V', 'VI'].indexOf(fz) >= 0 || has('padecimientos', 'Manchas tras'))) add('medio', `Fototipo ${fz || 'alto'} / antecedente de HPI: riesgo de hiperpigmentación postinflamatoria. Fotoprotección estricta.`);
  if (has('padecimientos', 'Melasma')) add('info', 'Melasma: evitar calor/inflamación excesiva y reforzar fotoprotección.');
  if (has('padecimientos', 'Cáncer')) add('info', 'Antecedente oncológico: confirmar alta/vigilancia con oncología antes de procedimientos.');
  if (glp && (has('padecimientos', 'Ca. medular') || has('padecimientos', 'Enfermedad tiroidea'))) add(has('padecimientos', 'Ca. medular') ? 'alto' : 'medio', 'GLP-1/GIP: contraindicado con antecedente personal/familiar de carcinoma medular de tiroides o MEN2. Interrogar dirigidamente.');
  if (glp) { const t = Number(d.talla), p = Number(d.peso); if (t && p) { const imc = p / Math.pow(t / 100, 2); if (imc < 27) add('medio', `IMC ${imc.toFixed(1)}: por debajo de la indicación habitual de GLP-1 (≥30, o ≥27 con comorbilidad).`); else add('info', `IMC ${imc.toFixed(1)}: dentro de rango de indicación para manejo farmacológico.`); } else add('info', 'Registrar talla y peso para calcular IMC antes de iniciar GLP-1.'); }
  if (d.tabaco === 'Diario') add('info', 'Tabaquismo diario: peor cicatrización y menor duración de resultados.');
  if (d.preocupacion === 'Sí') add('medio', 'Preocupación excesiva por la apariencia: tamizar trastorno dismórfico corporal y alinear expectativas.');
  if (d.complicaciones === 'Sí') add('medio', 'Complicaciones previas: revisar detalle antes de tratar la misma zona.');
  if (['nariz', 'perfil'].indexOf(id) >= 0) add('info', 'Canon: siempre que se haga rinomodelación debe considerarse la proyección del mentón.');
  if (id === 'pomulos') add('info', 'Canon: siempre que se proyecten cigomáticos se debe considerar la proyección de mentón.');
  if (ha && edad && edad < 35) add('info', 'Paciente joven: priorizar cigomático, mentón y ángulo mandibular (cánones).');
  if (inj && !d.consentImg) add('medio', 'Falta registrar el consentimiento de uso de imagen para la modelación.');
  if (extra && inj && (!extra.brand || !extra.qty)) add('info', 'No se indicó marca y/o cantidad de producto: la IA sugerirá cantidades típicas.');
  if (!A.length) add('info', 'Sin alertas con la información registrada. Completa la encuesta para mayor precisión.');
  const order = { alto: 0, medio: 1, info: 2 };
  return A.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

/* ---------- asistente de citas sin IA (respaldo que nunca falla) ---------- */
const KEYWORDS = [
  [/arrug|linea|frente|entrecej|patas de gallo|expresi|botox|toxina/, 'neurofull', 'Suaviza líneas de expresión de frente, entrecejo y patas de gallo.'],
  [/labio|boca/, 'labios', 'Volumen y definición natural de labios.'],
  [/nariz|giba|perfil nasal/, 'nariz', 'Corrige irregularidades del perfil nasal sin cirugía.'],
  [/menton|barbilla|papada/, 'menton', 'Da proyección y balance al tercio inferior.'],
  [/pomulo|ojera|mejilla|cachete/, 'pomulos', 'Restaura volumen del tercio medio.'],
  [/mandibul|quijada|jawline|contorno/, 'mandibula', 'Define el contorno mandibular.'],
  [/flacid|colgad|caid|lifting|papada|cuello/, 'hilos', 'Efecto lifting sin cirugía.'],
  [/volumen|hundid|demacrad|colageno|firmeza/, 'sculptra', 'Bioestimula colágeno y recupera firmeza.'],
  [/mancha|sol|opaca|luminos|textura|rejuvene/, 'renov3', 'Mejora luminosidad, tono y textura de la piel.'],
  [/acne|espinilla|punto negro|poro|limpieza/, 'limpieza', 'Limpieza profunda de poros.'],
  [/sud(o|a)r|hiperhidrosis/, 'hiper', 'Controla la sudoración excesiva.'],
  [/brux|rechin|apret|cara cuadrada|masetero/, 'bruxismo', 'Relaja maseteros y afina el rostro.'],
  [/peso|kilos|bajar|adelgaz|obesi|ozempic|mounjaro/, 'evalpeso', 'Programa médico supervisado de pérdida de peso.'],
  [/glute|pompi|nalga/, 'gluteos', 'Volumen y firmeza en glúteos.']
];
function keywordAssistant(text) {
  const t = norm(text), out = [];
  KEYWORDS.forEach(([re, id, why]) => { if (re.test(t) && !out.some(o => o.id === id)) out.push({ id, por_que: why }); });
  if (!out.length) out.push({ id: 'valoracion', por_que: 'En la valoración el doctor revisará tu caso y te dirá el mejor tratamiento.' });
  return { ok: true, respuesta: 'Estas opciones podrían ayudarte. El Dr. Javier Flores confirmará el tratamiento ideal en tu valoración.', sugerencias: out.slice(0, 3), local: true };
}
const catalogStr = () => ['valoracion=Valoración / consulta inicial'].concat(ALL.map(i => `${i.id}=${i.n}`)).join('; ');

/* ---------- capa de datos: servidor de Google o este dispositivo ---------- */
function localAgendaCfg() {
  const slots = []; const step = Number(C.MINUTOS_POR_CITA) || 60;
  for (let m = C.HORA_INICIO * 60; m + step <= C.HORA_FIN * 60; m += step) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return { slots, openDays: C.DIAS_LABORALES, maxDaysAhead: C.DIAS_ADELANTE, minHoursNotice: 1, holdHours: 24 };
}
function localActive(c) { return c.estado === 'CONFIRMADA' || (c.estado === 'PENDIENTE' && (Date.now() - Date.parse(c.creada)) < 24 * 3600e3); }
const D = {
  async slots() {
    if (SERVER) return api('slots');
    const n = mxNow(), appts = (await KV.get('appts')) || [], blocks = (await KV.get('blocks')) || [];
    const busy = {}, blockedDays = [];
    appts.filter(c => c.fecha >= n.date && localActive(c)).forEach(c => (busy[c.fecha] = busy[c.fecha] || []).push(c.hora));
    blocks.filter(b => b.fecha >= n.date).forEach(b => { if (!b.hora) blockedDays.push(b.fecha); else (busy[b.fecha] = busy[b.fecha] || []).push(b.hora); });
    return { ok: true, server: false, config: localAgendaCfg(), today: n.date, now: n.time, busy, blockedDays };
  },
  async book(d, asDoctor) {
    if (SERVER) return asDoctor ? api('addAppointment', d, true) : api('book', d);
    const appts = (await KV.get('appts')) || [], blocks = (await KV.get('blocks')) || [];
    if (appts.some(c => c.fecha === d.fecha && c.hora === d.hora && localActive(c)) || blocks.some(b => b.fecha === d.fecha && (!b.hora || b.hora === d.hora))) { const e = new Error('Ese horario ya está ocupado. Elige otro.'); e.code = 'TAKEN'; throw e; }
    const folio = 'JF-' + d.fecha.slice(2).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    appts.push(Object.assign({ folio, creada: new Date().toISOString(), estado: asDoctor ? 'CONFIRMADA' : 'PENDIENTE', origen: asDoctor ? 'médico' : 'web' }, d));
    await KV.set('appts', appts);
    return { ok: true, folio, local: true };
  },
  async assistant(text) {
    if (SERVER) { try { const r = await api('assistant', { text, catalog: catalogStr() }); if (r.sugerencias && r.sugerencias.length) return r; } catch (e) { console.warn('Asistente IA no disponible:', e.message); } }
    return keywordAssistant(text);
  },
  async listAppointments(from, to) {
    if (SERVER) return (await api('listAppointments', { from, to }, true)).items;
    return ((await KV.get('appts')) || []).filter(c => c.fecha >= from && c.fecha <= to).map(c => Object.assign({}, c, { estado: c.estado === 'PENDIENTE' && !localActive(c) ? 'EXPIRADA' : c.estado })).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  },
  async setAppointment(folio, estado) {
    if (SERVER) return api('setAppointment', { folio, estado }, true);
    const appts = (await KV.get('appts')) || []; const c = appts.find(x => x.folio === folio); if (!c) throw new Error('Cita no encontrada');
    c.estado = estado; if (estado === 'PENDIENTE' || estado === 'CONFIRMADA') c.creada = new Date().toISOString(); await KV.set('appts', appts); return { ok: true };
  },
  async listBlocks() {
    if (SERVER) return (await api('listBlocks', {}, true)).items;
    const t = mxNow().date; return ((await KV.get('blocks')) || []).filter(b => b.fecha >= t);
  },
  async block(fecha, hora, motivo) {
    if (SERVER) return api('block', { fecha, hora, motivo }, true);
    const b = (await KV.get('blocks')) || []; b.push({ id: lid('B'), fecha, hora, motivo }); await KV.set('blocks', b); return { ok: true };
  },
  async unblock(id) {
    if (SERVER) return api('unblock', { id }, true);
    await KV.set('blocks', ((await KV.get('blocks')) || []).filter(b => b.id !== id)); return { ok: true };
  },
  async searchPatients(q) {
    if (SERVER) return (await api('searchPatients', { q }, true)).items;
    const ps = (await KV.get('patients')) || [], vs = (await KV.get('visits')) || [], nq = norm(q);
    return ps.filter(p => !nq || norm(p.nombre).indexOf(nq) >= 0 || String(p.telefono || '').indexOf(nq) >= 0)
      .map(p => ({ id: p.id, nombre: p.nombre, telefono: p.telefono, actualizado: p.actualizado, visitas: vs.filter(v => v.pacienteId === p.id).length }))
      .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))).slice(0, 50);
  },
  async getPatient(id) {
    if (SERVER) { const r = await api('getPatient', { id }, true); return { patient: r.patient, visits: r.visits }; }
    const p = ((await KV.get('patients')) || []).find(x => x.id === id); if (!p) throw new Error('Paciente no encontrado');
    const visits = ((await KV.get('visits')) || []).filter(v => v.pacienteId === id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return { patient: p, visits };
  },
  async savePatient(id, datos) {
    if (!String(datos.nombre || '').trim()) throw new Error('El nombre del paciente es obligatorio');
    if (SERVER) return (await api('savePatient', { id, datos }, true)).id;
    const ps = (await KV.get('patients')) || [], ts = new Date().toISOString();
    let p = id && ps.find(x => x.id === id);
    if (p) Object.assign(p, { nombre: datos.nombre.trim(), telefono: datos.telefono || '', actualizado: ts, datos });
    else { p = { id: lid('P'), nombre: datos.nombre.trim(), telefono: datos.telefono || '', creado: ts, actualizado: ts, datos }; ps.push(p); }
    await KV.set('patients', ps); return p.id;
  },
  async saveVisit(visit, imgBefore, imgAfter) {
    if (SERVER) return (await api('saveVisit', { visit, imgBefore, imgAfter }, true)).id;
    const vs = (await KV.get('visits')) || []; const v = Object.assign({ id: lid('V'), fotoAntes: imgBefore || '', fotoDespues: imgAfter || '' }, visit);
    vs.push(v); await KV.set('visits', vs);
    const ps = (await KV.get('patients')) || []; const p = ps.find(x => x.id === visit.pacienteId); if (p) { p.actualizado = new Date().toISOString(); await KV.set('patients', ps); }
    return v.id;
  },
  async image(ref) {
    if (!ref) return '';
    if (String(ref).indexOf('data:') === 0) return ref;
    if (SERVER) return (await api('getImage', { fileId: ref }, true)).dataUrl;
    return '';
  }
};

/* =================== SITIO PÚBLICO =================== */
const cats = [...new Set(CATALOG.map(g => g.cat))];
const catLabels = { Neuro: 'Neuromodulación & Bioestimulación', Fillers: 'Fillers & Hilos', Piel: 'Piel & Luminosidad', Cuerpo: 'Cuerpo', Peso: 'Pérdida de peso' };
$('tabs').innerHTML = cats.map((c, i) => `<button class="tab ${i ? '' : 'active'}" data-c="${c}" type="button">${catLabels[c] || c}</button>`).join('');
$('cats').innerHTML = cats.map((c, i) => `<div class="cat ${i ? '' : 'active'}" data-c="${c}">${CATALOG.filter(g => g.cat === c).map(g => `
 <div class="group"><h3>${esc(g.group)}</h3><p>${esc(g.sub)}</p><div class="items">${g.items.map(it => `
  <div class="item ${it.r ? 'rec' : ''}">${it.r || it.tag ? `<span class="tag">${it.tag || 'RECOMENDADO'}</span>` : ''}<b>${esc(it.n)}</b><span class="d">${esc(it.d)}</span>
  <div class="price"><strong>${fmt(it.p)}</strong><small>${esc(it.u)}</small></div></div>`).join('')}</div></div>`).join('')}</div>`).join('');
$$('.tab').forEach(t => on(t, 'click', () => $$('.tab,.cat').forEach(e => e.classList.toggle('active', e.dataset.c === t.dataset.c))));

$$('.js-wa').forEach(a => a.href = waLink('Hola Dr. Javier Flores, me gustaría recibir información.'));
$$('.js-ig').forEach(a => a.href = C.INSTAGRAM);
$$('.js-ig-user').forEach(a => a.textContent = C.INSTAGRAM_USUARIO);
$$('.js-tel').forEach(a => { a.href = 'tel:' + C.WHATSAPP.slice(-10); a.textContent = C.TELEFONO_VISIBLE; });
$('yr').textContent = new Date().getFullYear();
addEventListener('scroll', () => $('nav').classList.toggle('scrolled', scrollY > 30), { passive: true });
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .08 }); $$('.reveal').forEach(e => io.observe(e)); }
else $$('.reveal').forEach(e => e.classList.add('in'));
on($('menuBtn'), 'click', () => $('links').classList.toggle('open'));
$$('.links a').forEach(a => on(a, 'click', () => $('links').classList.remove('open')));
const openM = id => $(id).classList.add('on'), closeM = id => $(id).classList.remove('on');

/* ---------- selector de tratamientos ---------- */
function treatOptions(includeVal, onlyModel) {
  return (includeVal ? `<option value="valoracion">Valoración / consulta inicial</option>` : '') +
    CATALOG.map(g => `<optgroup label="${esc(g.group)}">${g.items.filter(i => !onlyModel || i.m).map(i => `<option value="${i.id}">${esc(i.n)} — ${fmt(i.p)}</option>`).join('')}</optgroup>`).join('');
}
$('bkTreat').innerHTML = `<option value="">Selecciona…</option>` + treatOptions(true);
$('maTreat').innerHTML = treatOptions(true);
$('treat').innerHTML = treatOptions(false, true);

/* =================== AGENDA PÚBLICA =================== */
const BK = { step: 1, treat: '', date: '', time: '', month: '', avail: null, loading: null };
function bkGo(s) {
  BK.step = s;
  $$('#booking .bk-step').forEach(e => e.classList.toggle('on', Number(e.dataset.s) === s));
  $$('#bkStepper span').forEach((e, i) => { e.classList.toggle('on', i + 1 === s); e.classList.toggle('done', i + 1 < s); });
  $('bkStepper').style.display = s === 5 ? 'none' : '';
  if (window.innerWidth < 900) $('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadAvail(force) {
  if (BK.avail && !force) return BK.avail;
  if (BK.loading && !force) return BK.loading;
  BK.loading = D.slots().then(r => { BK.avail = r; return r; }).catch(e => {
    console.warn(e);
    const n = mxNow();
    BK.avail = { ok: true, server: false, offline: true, config: localAgendaCfg(), today: n.date, now: n.time, busy: {}, blockedDays: [] };
    return BK.avail;
  }).finally(() => { BK.loading = null; });
  return BK.loading;
}
function freeSlots(ds) {
  const a = BK.avail; if (!a) return [];
  const cfg = a.config, busy = a.busy[ds] || [];
  if (cfg.openDays.indexOf(dow(ds)) < 0 || a.blockedDays.indexOf(ds) >= 0) return [];
  const minNow = ds === a.today ? toMin(a.now) + (cfg.minHoursNotice || 1) * 60 : -1;
  return cfg.slots.filter(t => busy.indexOf(t) < 0 && toMin(t) >= minNow);
}
function dayState(ds) {
  const a = BK.avail, cfg = a.config;
  if (ds < a.today || ds > addDays(a.today, cfg.maxDaysAhead)) return 'out';
  if (cfg.openDays.indexOf(dow(ds)) < 0) return 'closed';
  return freeSlots(ds).length ? 'open' : 'full';
}
function renderCal() {
  const a = BK.avail; if (!a) return;
  if (!BK.month) BK.month = a.today.slice(0, 7);
  const [y, m] = BK.month.split('-').map(Number);
  $('calTitle').textContent = cap(new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const first = `${y}-${pad(m)}-01`, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (dow(first) + 6) % 7;
  let h = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) h += `<div class="empty-cell"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m)}-${pad(d)}`, st = dayState(ds);
    const title = st === 'full' ? 'Fecha no disponible (sin espacio)' : st === 'closed' ? 'No laborable' : st === 'out' ? 'Fuera de rango' : 'Disponible';
    h += `<button type="button" data-d="${ds}" class="${st === 'full' ? 'full' : ''} ${BK.date === ds ? 'sel' : ''}" ${st === 'open' ? '' : 'disabled'} title="${title}" aria-label="${d} — ${title}">${d}</button>`;
  }
  $('cal').innerHTML = h;
  const minMonth = a.today.slice(0, 7), maxMonth = addDays(a.today, a.config.maxDaysAhead).slice(0, 7);
  $('calPrev').disabled = BK.month <= minMonth; $('calNext').disabled = BK.month >= maxMonth;
  $('calMsg').textContent = a.offline ? 'Sin conexión con la agenda en este momento: tu horario se confirmará por WhatsApp.' : '';
}
function shiftMonth(n) { const [y, m] = BK.month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); BK.month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; renderCal(); }
function renderSlots() {
  const a = BK.avail, free = freeSlots(BK.date);
  $('slotDay').textContent = longDate(BK.date) + ' · ' + (free.length ? `${free.length} horario(s) disponible(s)` : 'sin horarios disponibles');
  $('slots').innerHTML = a.config.slots.map(t => `<button type="button" data-t="${t}" class="${BK.time === t ? 'sel' : ''}" ${free.indexOf(t) >= 0 ? '' : 'disabled'}>${hourShort(t)}</button>`).join('');
}
function bkSummaryHtml(folio) {
  const t = byId(BK.treat);
  return `<div>Procedimiento: <b>${esc(t ? t.n : '')}</b></div><div>Fecha: <b>${esc(longDate(BK.date))}</b></div><div>Hora: <b>${esc(hour12(BK.time))}</b></div>` +
    ($('bkName').value.trim() ? `<div>Paciente: <b>${esc($('bkName').value.trim())}</b></div>` : '') + (folio ? `<div>Folio: <b>${esc(folio)}</b></div>` : '');
}
function waBookingText(folio, note) {
  const t = byId(BK.treat), name = $('bkName').value.trim(), notes = $('bkNotes').value.trim();
  return `Hola Dr. Javier Flores, quiero confirmar mi cita.\n\n` +
    `📋 *CITA DEL PACIENTE*\n👤 Paciente: ${name}\n💉 Procedimiento: ${t ? t.n : ''}\n📅 Fecha: ${longDate(BK.date)}\n⏰ Hora: ${hour12(BK.time)}\n📱 Teléfono: ${$('bkPhone').value.replace(/\D/g, '')}` +
    (folio ? `\n🔖 Folio: ${folio}` : '') + (notes ? `\n📝 Comentario: ${notes}` : '') + (note ? `\n\n${note}` : '');
}

on($('bkNext1'), 'click', async () => {
  BK.treat = $('bkTreat').value;
  if (!BK.treat) { toast('Elige un procedimiento (o "Valoración" si no estás seguro).', true); $('bkTreat').focus(); return; }
  bkGo(2); $('cal').innerHTML = '<p class="hint" style="grid-column:1/-1">Cargando disponibilidad…</p>';
  await loadAvail(true); renderCal();
});
on($('calPrev'), 'click', () => shiftMonth(-1));
on($('calNext'), 'click', () => shiftMonth(1));
on($('cal'), 'click', e => { const b = e.target.closest('button[data-d]'); if (!b || b.disabled) return; BK.date = b.dataset.d; BK.time = ''; renderCal(); renderSlots(); bkGo(3); });
on($('slots'), 'click', e => { const b = e.target.closest('button[data-t]'); if (!b || b.disabled) return; BK.time = b.dataset.t; renderSlots(); $('bkSummary').innerHTML = bkSummaryHtml(); $('bkErr').textContent = ''; bkGo(4); });
$$('#booking [data-back]').forEach(b => on(b, 'click', () => { const s = Number(b.dataset.back); if (s === 2) renderCal(); if (s === 3) renderSlots(); bkGo(s); }));
on($('bkName'), 'input', () => { $('bkSummary').innerHTML = bkSummaryHtml(); });

on($('bkSend'), 'click', async () => {
  const name = $('bkName').value.trim(), phone = $('bkPhone').value.replace(/\D/g, '');
  const err = m => { $('bkErr').textContent = m; };
  if (name.length < 3 || !/\s/.test(name)) return err('Escribe tu nombre y apellido.');
  if (phone.length < 10 || phone.length > 13) return err('Escribe tu WhatsApp a 10 dígitos.');
  if (!$('bkOk').checked) return err('Marca la casilla de aceptación para continuar.');
  err(''); const btn = $('bkSend'); btn.disabled = true; btn.textContent = 'Apartando tu horario…';
  let folio = '', note = '';
  try {
    const t = byId(BK.treat);
    const r = await D.book({ nombre: name, telefono: phone, tratamiento: t ? t.n : BK.treat, fecha: BK.date, hora: BK.time, notas: $('bkNotes').value.trim() });
    folio = r.folio || '';
  } catch (e) {
    if (['TAKEN', 'PAST', 'CLOSED', 'BAD_DATE', 'BAD_TIME'].indexOf(e.code) >= 0) {
      toast(e.message, true); await loadAvail(true); BK.time = ''; renderCal(); renderSlots(); bkGo(3);
      btn.disabled = false; btn.textContent = 'Apartar y enviar por WhatsApp'; return;
    }
    if (['BAD_NAME', 'BAD_PHONE', 'BAD_TREAT', 'LIMIT'].indexOf(e.code) >= 0) { err(e.message); btn.disabled = false; btn.textContent = 'Apartar y enviar por WhatsApp'; return; }
    note = '(No se pudo apartar en línea; por favor confirmen disponibilidad.)';
    console.warn('Reserva sin servidor:', e.message);
  }
  btn.disabled = false; btn.textContent = 'Apartar y enviar por WhatsApp';
  const url = waLink(waBookingText(folio, note));
  $('bkDone').innerHTML = bkSummaryHtml(folio);
  $('bkWaLink').href = url; bkGo(5);
  loadAvail(true);
  if (window.top === window) setTimeout(() => { if (BK.step === 5) location.href = url; }, 1400);
});
on($('bkAgain'), 'click', () => { BK.date = ''; BK.time = ''; $('bkOk').checked = false; bkGo(1); });

on($('bkAiBtn'), 'click', async () => {
  const txt = $('bkAiText').value.trim();
  if (txt.length < 3) { toast('Describe brevemente lo que te gustaría mejorar.', true); return; }
  const b = $('bkAiBtn'); b.disabled = true; b.textContent = 'Pensando…'; $('bkAiChips').innerHTML = ''; $('bkAiReply').textContent = '';
  try {
    const r = await D.assistant(txt);
    const sug = arr(r.sugerencias).filter(s => byId(s.id));
    const list = sug.length ? sug : keywordAssistant(txt).sugerencias;
    $('bkAiReply').textContent = (r.respuesta || 'Te sugerimos:') + ' Toca una opción para seleccionarla.';
    $('bkAiChips').innerHTML = list.map(s => `<button type="button" class="chip" data-id="${esc(s.id)}"><b>${esc(byId(s.id).n)}</b>${s.por_que ? ' — ' + esc(s.por_que) : ''}</button>`).join('');
  } finally { b.disabled = false; b.textContent = 'Sugerir tratamiento'; }
});
on($('bkAiChips'), 'click', e => { const c = e.target.closest('.chip'); if (!c) return; $('bkTreat').value = c.dataset.id; $$('#bkAiChips .chip').forEach(x => x.classList.toggle('on', x === c)); toast('Seleccionado: ' + byId(c.dataset.id).n); });

/* =================== ACCESO MÉDICO =================== */
function openLogin() { openM('mLogin'); $('pwErr').textContent = ''; setTimeout(() => $('pw').focus(), 60); }
async function doLogin() {
  const pw = $('pw').value; if (!pw) return;
  $('pwGo').disabled = true;
  try {
    if ((await sha256(pw)) !== C.DOCTOR_PASSWORD_HASH) { $('pwErr').textContent = 'Contraseña incorrecta'; return; }
    sessionStorage.setItem('jf_pw', pw);
    if (SERVER) {
      try { await api('login', {}, true); }
      catch (e) {
        if (e.code === 'AUTH' || e.code === 'LOCKED') { sessionStorage.removeItem('jf_pw'); $('pwErr').textContent = e.code === 'AUTH' ? 'El servidor no reconoce la contraseña (revisa que Code.gs y config.js tengan la misma).' : e.message; return; }
        toast('Entraste, pero el servidor no respondió: ' + e.message, true);
      }
    }
    sessionStorage.setItem('jf_doc', '1'); $('pw').value = ''; closeM('mLogin'); openPanel();
  } finally { $('pwGo').disabled = false; }
}
function logout() { sessionStorage.removeItem('jf_doc'); sessionStorage.removeItem('jf_pw'); document.body.classList.remove('doctor'); }
on($('docLink'), 'click', openLogin);
on($('pwGo'), 'click', doLogin);
on($('pw'), 'keydown', e => { if (e.key === 'Enter') doLogin(); });
on($('pwCancel'), 'click', () => closeM('mLogin'));
on($('pLogout'), 'click', () => { logout(); toast('Sesión cerrada'); });
on($('pClose'), 'click', () => document.body.classList.remove('doctor'));

let panelReady = false;
function openPanel() {
  document.body.classList.add('doctor');
  $('modeBanner').innerHTML = SERVER ? '' : `<div class="banner"><b>Modo dispositivo:</b> la agenda compartida y los expedientes en la nube se activan al conectar tu servidor gratuito de Google (Guía, parte 3). Mientras tanto, lo que guardes aquí queda solo en este dispositivo.</div>`;
  if (!panelReady) { panelReady = true; initPanel(); }
  showView(document.querySelector('#pTabs button.on').dataset.v);
}
function showView(v) {
  $$('#pTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $$('.p-view').forEach(e => e.classList.toggle('on', e.id === v));
  $('panel').scrollTop = 0;
  if (v === 'vAgenda') loadAgenda();
  if (v === 'vPacientes' && $('ptDetail').style.display === 'none') searchPatients();
  if (v === 'vAjustes') renderStatus();
}
on($('pTabs'), 'click', e => { const b = e.target.closest('button[data-v]'); if (b) showView(b.dataset.v); });

function initPanel() {
  const slotOpts = localAgendaCfg().slots.map(t => `<option value="${t}">${hour12(t)}</option>`).join('');
  $('maTime').innerHTML = slotOpts; $('blTime').innerHTML = `<option value="">Todo el día</option>` + slotOpts;
  $('maDate').value = mxNow().date; $('blDate').value = mxNow().date;
  $('txtModel').value = localStorage.getItem('jf_txt') || C.MODELO_TEXTO;
  $('imgModel').value = localStorage.getItem('jf_img') || C.MODELO_IMAGEN_GEMINI;
  $('keyIn').value = localStorage.getItem('jf_key') || '';
}

/* ---------- Agenda del médico ---------- */
async function loadAgenda() {
  $('agList').innerHTML = '<p class="hint">Cargando…</p>';
  const t = mxNow().date;
  let items = [], blocks = [];
  try { [items, blocks] = await Promise.all([D.listAppointments(addDays(t, -1), addDays(t, 120)), D.listBlocks()]); }
  catch (e) { $('agList').innerHTML = `<div class="banner bad">No se pudo cargar la agenda: ${esc(e.message)}</div>`; return; }
  if (!items.length) $('agList').innerHTML = '<p class="hint">No hay citas próximas.</p>';
  else {
    let h = '', last = '';
    items.forEach(c => {
      if (c.fecha !== last) { last = c.fecha; h += `<div class="day-h">${esc(cap(shortDate(c.fecha)))}${c.fecha === t ? ' · hoy' : ''}</div>`; }
      const st = String(c.estado || ''), cls = 'b-' + st.split(' ')[0];
      const msg = `Hola ${c.nombre}, le escribe el consultorio del Dr. Javier Flores para confirmar su cita de ${c.tratamiento} el ${longDate(c.fecha)} a las ${hour12(c.hora)}.`;
      h += `<div class="appt"><div class="t">${esc(c.hora)}</div><div><b>${esc(c.nombre)}<span class="badge ${cls}">${esc(st)}</span></b><small>${esc(c.tratamiento)} · ${esc(c.telefono)} · ${esc(c.folio)}${c.notas ? ' · ' + esc(c.notas) : ''}</small></div>
        <div class="acts">${st !== 'CONFIRMADA' && st !== 'ASISTIÓ' ? `<button class="btn btn-gold btn-sm" data-f="${esc(c.folio)}" data-e="CONFIRMADA" type="button">Confirmar</button>` : ''}
        ${st === 'CONFIRMADA' ? `<button class="btn btn-ghost btn-sm" data-f="${esc(c.folio)}" data-e="ASISTIÓ" type="button">Asistió</button>` : ''}
        ${st !== 'CANCELADA' ? `<button class="btn btn-ghost btn-sm" data-f="${esc(c.folio)}" data-e="CANCELADA" type="button">Cancelar</button>` : ''}
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(msg, (String(c.telefono).length === 10 ? '52' : '') + c.telefono)}">WhatsApp</a></div></div>`;
    });
    $('agList').innerHTML = h;
  }
  $('blList').innerHTML = blocks.length ? blocks.map(b => `<div class="list-item" style="cursor:default"><span>${esc(shortDate(b.fecha))} · ${b.hora ? esc(hour12(b.hora)) : 'todo el día'}<br><small>${esc(b.motivo || '')}</small></span><button class="btn btn-ghost btn-sm" data-ub="${esc(b.id)}" type="button">Quitar</button></div>`).join('') : '<p class="hint">Sin bloqueos.</p>';
}
on($('agRefresh'), 'click', loadAgenda);
on($('agList'), 'click', async e => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  b.disabled = true; await D.setAppointment(b.dataset.f, b.dataset.e); toast('Cita actualizada ✓'); loadAgenda();
});
on($('blList'), 'click', async e => { const b = e.target.closest('button[data-ub]'); if (!b) return; b.disabled = true; await D.unblock(b.dataset.ub); toast('Bloqueo eliminado'); loadAgenda(); });
on($('blSave'), 'click', async () => {
  const f = $('blDate').value; if (!f) return toast('Elige una fecha', true);
  await D.block(f, $('blTime').value, $('blWhy').value.trim()); $('blWhy').value = ''; toast('Horario bloqueado ✓'); loadAgenda();
});
on($('maSave'), 'click', async () => {
  const name = $('maName').value.trim(), phone = $('maPhone').value.replace(/\D/g, '');
  if (name.length < 2) return toast('Escribe el nombre del paciente', true);
  if (phone.length < 10) return toast('Teléfono a 10 dígitos', true);
  const t = byId($('maTreat').value);
  await D.book({ nombre: name, telefono: phone, tratamiento: t.n, fecha: $('maDate').value, hora: $('maTime').value, notas: '' }, true);
  $('maName').value = ''; $('maPhone').value = ''; toast('Cita guardada ✓'); loadAgenda();
});

/* ---------- Encuesta (formulario reutilizable) ---------- */
function surveyHtml(d, opts) {
  d = d || {}; opts = opts || {};
  const field = f => {
    const v = d[f.k], cls = f.full ? 'full' : '';
    if (f.t === 'checks') return `<div class="${cls}"><label>${esc(f.l)}</label><div class="checks">${f.o.map(o => `<label><input type="checkbox" data-k="${f.k}" value="${esc(o)}" ${arr(v).indexOf(o) >= 0 ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div></div>`;
    if (f.t === 'check') return `<label class="cb-line ${cls}"><input type="checkbox" data-k="${f.k}" data-single="1" ${v ? 'checked' : ''}> ${esc(f.l)}</label>`;
    if (f.t === 'select') return `<div class="${cls}"><label>${esc(f.l)}</label><select data-k="${f.k}"><option value="">—</option>${f.o.map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    if (f.t === 'textarea') return `<div class="${cls}"><label>${esc(f.l)}</label><textarea data-k="${f.k}" rows="2">${esc(v || '')}</textarea></div>`;
    return `<div class="${cls}"><label>${esc(f.l)}</label><input type="${f.t}" data-k="${f.k}" value="${esc(v || '')}" ${f.ro ? 'readonly' : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.t === 'number' ? 'step="any" min="0"' : ''}></div>`;
  };
  return `<div class="survey">${SURVEY.map((s, i) => `<details class="sv-sec" ${s.open || opts.openAll ? 'open' : ''}><summary>${i + 1}. ${esc(s.sec)}</summary><div class="sv-in">${s.f.map(field).join('')}</div></details>`).join('')}
    <p class="err sv-err"></p>
    <div class="row">${(opts.buttons || []).map(b => `<button class="btn ${b.cls || 'btn-ghost'}" data-act="${b.act}" type="button">${b.label}</button>`).join('')}</div></div>`;
}
function readSurvey(root) {
  const d = {};
  $$('[data-k]', root).forEach(el => {
    const k = el.dataset.k;
    if (el.type === 'checkbox' && el.dataset.single) d[k] = el.checked;
    else if (el.type === 'checkbox') { d[k] = d[k] || []; if (el.checked) d[k].push(el.value); }
    else d[k] = el.value.trim();
  });
  return d;
}
function wireSurvey(root) {
  const q = k => root.querySelector(`[data-k="${k}"]`);
  const calc = () => { const t = Number(q('talla').value), p = Number(q('peso').value); q('imc').value = t > 50 && p > 10 ? (p / Math.pow(t / 100, 2)).toFixed(1) : ''; };
  on(q('talla'), 'input', calc); on(q('peso'), 'input', calc); calc();
  on(q('nacimiento'), 'change', () => { const a = ageFrom(q('nacimiento').value); if (a !== '') q('edad').value = a; });
  root.addEventListener('change', e => {
    const el = e.target; if (el.type !== 'checkbox' || el.dataset.single) return;
    const group = $$(`input[data-k="${el.dataset.k}"]`, root), none = group.find(x => /^Ningun/.test(x.value));
    if (!none) return;
    if (el === none && el.checked) group.forEach(x => { if (x !== none) x.checked = false; });
    else if (el !== none && el.checked) none.checked = false;
  });
}
function patientSummary(d) {
  d = d || {};
  const items = [['Edad', d.edad || ageFrom(d.nacimiento)], ['Sexo', d.sexo], ['IMC', d.imc], ['Fototipo', fitzFrom(d)], ['Embarazo', d.embarazo]].filter(x => x[1]);
  const lists = [['Padecimientos', d.padecimientos], ['Alergias', d.alergias], ['Medicamentos', d.meds], ['Previos', d.previos]].filter(x => arr(x[1]).length && arr(x[1])[0].indexOf('Ningun') !== 0);
  return `<div class="kv">${items.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>` +
    (lists.length ? `<div class="rep" style="margin-top:.8rem">${lists.map(([k, v]) => `<p><b style="color:var(--gold-2)">${esc(k)}:</b> ${esc(arr(v).join(', '))}</p>`).join('')}</div>` : '');
}

/* ---------- Pacientes ---------- */
let searchT;
async function searchPatients() {
  $('ptList').innerHTML = '<p class="hint">Buscando…</p>';
  try {
    const list = await D.searchPatients($('ptSearch').value.trim());
    $('ptList').innerHTML = list.length ? list.map(p => `<button class="list-item" data-pid="${esc(p.id)}" type="button"><span><b>${esc(p.nombre)}</b><br><small>${esc(p.telefono || 'sin teléfono')} · ${p.visitas} visita(s)</small></span><span class="hint">Abrir →</span></button>`).join('') : '<p class="hint">Sin resultados. Crea un paciente nuevo.</p>';
  } catch (e) { $('ptList').innerHTML = `<div class="banner bad">${esc(e.message)}</div>`; }
}
on($('ptSearch'), 'input', () => { clearTimeout(searchT); searchT = setTimeout(searchPatients, 350); });
on($('ptList'), 'click', e => { const b = e.target.closest('[data-pid]'); if (b) openPatient(b.dataset.pid); });
on($('ptNew'), 'click', () => editPatient(null, {}));

function backToList() { $('ptDetail').style.display = 'none'; $('ptListView').style.display = ''; searchPatients(); }
async function openPatient(id) {
  $('ptListView').style.display = 'none'; const box = $('ptDetail'); box.style.display = ''; box.innerHTML = '<p class="hint">Cargando expediente…</p>';
  let r; try { r = await D.getPatient(id); } catch (e) { box.innerHTML = `<div class="banner bad">${esc(e.message)}</div><button class="btn btn-ghost" data-act="back" type="button">← Volver</button>`; on(box.querySelector('[data-act=back]'), 'click', backToList); return; }
  const p = r.patient, d = p.datos || {};
  box.innerHTML = `<div class="row" style="margin:0 0 1rem"><button class="btn btn-ghost btn-sm" data-act="back" type="button">← Pacientes</button></div>
   <div class="panel"><div class="p-h" style="margin-bottom:.6rem"><div><span class="eyebrow">Historia clínica</span><h2>${esc(p.nombre)}</h2><p class="hint">${esc(d.telefono || p.telefono || '')} ${d.email ? '· ' + esc(d.email) : ''} · Alta: ${esc(String(p.creado || '').slice(0, 10))}</p></div>
   <div class="row" style="margin:0"><button class="btn btn-gold btn-sm" data-act="model" type="button">✦ Nueva modelación</button><button class="btn btn-ghost btn-sm" data-act="edit" type="button">Editar encuesta</button><button class="btn btn-ghost btn-sm" data-act="print" type="button">🖨 Imprimir</button></div></div>
   ${patientSummary(d)}${d.motivo ? `<p class="hint" style="margin-top:.8rem"><b>Motivo:</b> ${esc(d.motivo)}</p>` : ''}</div>
   <h3 style="font-size:1.6rem;margin:1.6rem 0 .8rem">Visitas y modelaciones (${r.visits.length})</h3>
   ${r.visits.length ? r.visits.map(v => visitCard(v)).join('') : '<p class="hint">Aún no hay visitas registradas.</p>'}`;
  on(box.querySelector('[data-act=back]'), 'click', backToList);
  on(box.querySelector('[data-act=edit]'), 'click', () => editPatient(p.id, d));
  on(box.querySelector('[data-act=model]'), 'click', () => { startModelFor({ id: p.id, nombre: p.nombre, datos: d }); });
  on(box.querySelector('[data-act=print]'), 'click', () => printHistory(p, r.visits));
  $$('[data-photos]', box).forEach(b => on(b, 'click', async () => {
    const v = r.visits.find(x => x.id === b.dataset.photos); b.disabled = true; b.textContent = 'Cargando…';
    try { const [a, z] = await Promise.all([D.image(v.fotoAntes), D.image(v.fotoDespues)]); v._a = a; v._z = z; b.parentElement.querySelector('.imgs').innerHTML = (a ? `<img src="${a}" alt="Antes">` : '') + (z ? `<img src="${z}" alt="Modelación">` : '') || '<span class="hint">Sin fotos</span>'; b.remove(); }
    catch (e) { b.disabled = false; b.textContent = 'Ver fotos'; toast(e.message, true); }
  }));
}
function visitCard(v) {
  const a = v.analisis || {};
  return `<div class="visit"><b>${esc(String(v.fecha || '').slice(0, 10))} · ${esc(v.procedimiento || 'Consulta')}</b>
    <p class="hint">${v.marca ? 'Producto: ' + esc(v.marca) + ' ' : ''}${v.cantidad ? esc(v.cantidad) + ' ' + esc(v.unidad || '') : ''} ${v.intensidad ? '· expectativa ' + esc(v.intensidad) : ''} ${v.plan && v.plan.total ? '· plan ' + fmt(v.plan.total) : ''}</p>
    ${a.resumen ? `<p style="font-size:.88rem;color:var(--ivory-2);margin-top:.4rem">${esc(a.resumen)}</p>` : ''}
    ${v.notas ? `<p class="hint">Notas: ${esc(v.notas)}</p>` : ''}
    <div class="imgs"></div>${v.fotoAntes || v.fotoDespues ? `<button class="btn btn-ghost btn-sm" data-photos="${esc(v.id)}" type="button" style="margin-top:.6rem">Ver fotos</button>` : ''}</div>`;
}
function editPatient(id, d) {
  $('ptListView').style.display = 'none'; const box = $('ptDetail'); box.style.display = '';
  box.innerHTML = `<div class="row" style="margin:0 0 1rem"><button class="btn btn-ghost btn-sm" data-act="cancel" type="button">← Cancelar</button></div><div class="p-h"><div><span class="eyebrow">${id ? 'Editar' : 'Nuevo paciente'}</span><h2>Encuesta clínica</h2></div></div>` +
    surveyHtml(d, { buttons: [{ act: 'save', label: 'Guardar expediente', cls: 'btn-gold' }, { act: 'saveModel', label: 'Guardar y modelar →' }] });
  wireSurvey(box);
  on(box.querySelector('[data-act=cancel]'), 'click', () => id ? openPatient(id) : backToList());
  const save = async go => {
    const datos = readSurvey(box);
    if (!datos.nombre || datos.nombre.length < 2) { box.querySelector('.sv-err').textContent = 'El nombre es obligatorio.'; box.querySelector('[data-k=nombre]').focus(); return; }
    $$('button[data-act]', box).forEach(b => b.disabled = true);
    try {
      const pid = await D.savePatient(id, datos); toast('Expediente guardado ✓');
      if (go) startModelFor({ id: pid, nombre: datos.nombre, datos }); else openPatient(pid);
    } catch (e) { box.querySelector('.sv-err').textContent = e.message; $$('button[data-act]', box).forEach(b => b.disabled = false); }
  };
  on(box.querySelector('[data-act=save]'), 'click', () => save(false));
  on(box.querySelector('[data-act=saveModel]'), 'click', () => save(true));
}

/* ---------- Impresión ---------- */
function printNow(html) { $('printArea').innerHTML = html; setTimeout(() => window.print(), 150); }
function surveyPrint(d) {
  return SURVEY.map(s => { const rows = s.f.map(f => { const v = d[f.k]; const t = Array.isArray(v) ? v.join(', ') : (v === true ? 'Sí' : v === false ? 'No' : v); return t ? `<tr><td style="width:38%"><b>${esc(f.l.replace(' *', ''))}</b></td><td>${esc(t)}</td></tr>` : ''; }).join(''); return rows ? `<h2>${esc(s.sec)}</h2><table>${rows}</table>` : ''; }).join('');
}
function printHistory(p, visits) {
  const d = p.datos || {};
  printNow(`<h1>Historia clínica — ${esc(p.nombre)}</h1><p>Dr. Javier Flores · Médico Cirujano · Céd. 14182373 · Impreso ${esc(mxNow().date)}</p>${surveyPrint(d)}
   <h2>Visitas</h2>${visits.map(v => `<p><b>${esc(String(v.fecha).slice(0, 10))} — ${esc(v.procedimiento || '')}</b> ${v.marca ? '· ' + esc(v.marca) : ''} ${v.cantidad ? esc(v.cantidad) + ' ' + esc(v.unidad || '') : ''}<br>${esc((v.analisis && v.analisis.resumen) || '')}</p>${v._a ? `<img src="${v._a}">` : ''}${v._z ? `<img src="${v._z}">` : ''}`).join('') || '<p>Sin visitas.</p>'}`);
}

/* =================== MODELACIÓN IA =================== */
const M = { patient: null, photos: {}, slot: 'frontal', before: '', after: '', engine: '', analysis: null, plan: null, alerts: [], L: null, view: 'frontal', saved: false };
function wzGo(n) {
  if (n >= 2 && !M.patient) return toast('Primero elige o registra al paciente.', true);
  if (n >= 3 && !M.photos.frontal) return toast('Sube al menos la foto frontal.', true);
  if (n === 4 && !M.before) return toast('Primero genera el análisis.', true);
  $$('#wzSteps button').forEach(b => b.classList.toggle('on', Number(b.dataset.w) === n));
  $$('.wz').forEach(e => e.classList.toggle('on', e.id === 'wz' + n));
  $$('.js-cur').forEach(e => e.innerHTML = M.patient ? `<span>Paciente: <b>${esc(M.patient.nombre)}</b></span><button class="btn btn-ghost btn-sm" data-wgo="1" type="button">Cambiar</button>` : '');
  if (n === 3) renderAlerts();
  $('panel').scrollTop = 0;
}
on($('wzSteps'), 'click', e => { const b = e.target.closest('button[data-w]'); if (b) wzGo(Number(b.dataset.w)); });
on($('vModel'), 'click', e => { const b = e.target.closest('[data-wgo]'); if (b) wzGo(Number(b.dataset.wgo)); });
function resetModel() { M.photos = {}; M.before = ''; M.after = ''; M.analysis = null; M.plan = null; M.L = null; M.saved = false; $$('#wz2 .prev').forEach(p => p.innerHTML = '⬆ Subir foto o video'); $('report').innerHTML = '<p class="hint">Aparecerá después del análisis.</p>'; $('sugs').innerHTML = '<p class="hint">Aparecerá después del análisis.</p>'; }
function startModelFor(p) { M.patient = p; resetModel(); showView('vModel'); $('wzSurvey').style.display = 'none'; wzGo(2); }

let wzT;
on($('wzSearch'), 'input', () => { clearTimeout(wzT); wzT = setTimeout(async () => {
  const q = $('wzSearch').value.trim(); if (q.length < 2) { $('wzResults').innerHTML = ''; return; }
  try { const list = await D.searchPatients(q); $('wzResults').innerHTML = list.length ? list.map(p => `<button class="list-item" data-pid="${esc(p.id)}" type="button"><span><b>${esc(p.nombre)}</b><br><small>${p.visitas} modelación(es)/visita(s)</small></span><span class="hint">Elegir →</span></button>`).join('') : '<p class="hint">No se encontró. Usa “Paciente nuevo”.</p>'; }
  catch (e) { $('wzResults').innerHTML = `<div class="banner bad">${esc(e.message)}</div>`; }
}, 350); });
on($('wzResults'), 'click', async e => { const b = e.target.closest('[data-pid]'); if (!b) return; const r = await D.getPatient(b.dataset.pid); startModelFor({ id: r.patient.id, nombre: r.patient.nombre, datos: r.patient.datos || {} }); });
on($('wzNew'), 'click', () => {
  const box = $('wzSurvey'); box.style.display = '';
  box.innerHTML = `<div class="p-h"><div><span class="eyebrow">Paciente nuevo</span><h2>Encuesta clínica previa</h2></div></div>` + surveyHtml({}, { buttons: [{ act: 'go', label: 'Guardar y continuar a fotos →', cls: 'btn-gold' }, { act: 'cancel', label: 'Cancelar' }] });
  wireSurvey(box); box.scrollIntoView({ behavior: 'smooth' });
  on(box.querySelector('[data-act=cancel]'), 'click', () => { box.style.display = 'none'; box.innerHTML = ''; });
  on(box.querySelector('[data-act=go]'), 'click', async () => {
    const datos = readSurvey(box);
    if (!datos.nombre || datos.nombre.length < 2) { box.querySelector('.sv-err').textContent = 'El nombre es obligatorio.'; return; }
    box.querySelector('[data-act=go]').disabled = true;
    try { const id = await D.savePatient(null, datos); toast('Expediente creado ✓'); startModelFor({ id, nombre: datos.nombre, datos }); }
    catch (err) { box.querySelector('.sv-err').textContent = err.message; box.querySelector('[data-act=go]').disabled = false; }
  });
});
on($('wzQuick'), 'click', () => {
  const box = $('wzSurvey'); box.style.display = '';
  box.innerHTML = `<div class="panel" style="max-width:520px"><h4>Registro rápido</h4><label>Nombre completo</label><input type="text" id="qName" maxlength="80"><label>Teléfono (opcional)</label><input type="tel" id="qPhone" maxlength="14"><p class="err" id="qErr"></p><div class="row"><button class="btn btn-gold" id="qGo" type="button">Continuar →</button></div><p class="hint">Podrás completar la encuesta después desde “Pacientes”.</p></div>`;
  $('qName').focus();
  on($('qGo'), 'click', async () => {
    const nombre = $('qName').value.trim(); if (nombre.length < 2) { $('qErr').textContent = 'Escribe el nombre.'; return; }
    $('qGo').disabled = true;
    try { const datos = { nombre, telefono: $('qPhone').value.replace(/\D/g, '') }; const id = await D.savePatient(null, datos); startModelFor({ id, nombre, datos }); }
    catch (err) { $('qErr').textContent = err.message; $('qGo').disabled = false; }
  });
});

/* ---------- fotos y video ---------- */
function resizeData(src, max, q) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', q || .9), w: c.width, h: c.height }); }; im.onerror = () => rej(new Error('No se pudo leer la imagen. Usa JPG o PNG (en iPhone: Ajustes › Cámara › Formatos › Más compatible).')); im.src = src; });
}
function setPhoto(slot, data) {
  M.photos[slot] = data;
  const p = document.querySelector(`#wz2 .prev[data-ph="${slot}"]`); p.innerHTML = `<img src="${data}" alt="${slot}">`;
  toast(`Foto ${slot} lista ✓`);
}
$$('#wz2 .prev').forEach(p => on(p, 'click', () => { M.slot = p.dataset.ph; $('phFile').value = ''; $('phFile').click(); }));
on($('phFile'), 'change', async e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.type.indexOf('video') === 0) { $('vidbox').style.display = ''; $('vsrc').src = URL.createObjectURL(f); toast('Pausa el video en el mejor cuadro y presiona “Usar este cuadro”.'); return; }
  const url = URL.createObjectURL(f);
  try { setPhoto(M.slot, (await resizeData(url, 1280, .9)).data); } finally { URL.revokeObjectURL(url); }
});
on($('grab'), 'click', async () => {
  const v = $('vsrc'); if (!v.videoWidth) return toast('Reproduce el video y pausa en el mejor cuadro.', true);
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  setPhoto(M.slot, (await resizeData(c.toDataURL('image/jpeg', .92), 1280, .9)).data); $('vidbox').style.display = 'none'; v.pause();
});
on($('grabCancel'), 'click', () => { $('vidbox').style.display = 'none'; $('vsrc').pause(); });
on($('wz2Next'), 'click', () => wzGo(3));

/* ---------- procedimiento ---------- */
$$('#intensity button').forEach(b => on(b, 'click', () => { $$('#intensity button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }));
function opts() { return { id: $('treat').value, lvl: (document.querySelector('#intensity .on') || {}).dataset.v || 'moderado', brand: $('brand').value.trim(), qty: $('qty').value.trim(), unit: $('unit').value, zones: $('zones').value.trim(), notes: $('notes').value.trim() }; }
function renderAlerts() { const o = opts(); M.alerts = clinicalAlerts(M.patient && M.patient.datos, o.id, o); $('alerts').innerHTML = M.alerts.map(a => `<div class="alert ${a.lvl}"><b>${a.lvl === 'alto' ? '⛔ Alto' : a.lvl === 'medio' ? '⚠ Precaución' : 'ℹ Nota'}:</b> ${esc(a.txt)}</div>`).join(''); }
['treat', 'brand', 'qty'].forEach(id => on($(id), 'change', renderAlerts));

/* ---------- IA: Gemini (análisis) ---------- */
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/';
const textModel = () => localStorage.getItem('jf_txt') || C.MODELO_TEXTO || 'gemini-flash-latest';
const imgModelG = () => localStorage.getItem('jf_img') || C.MODELO_IMAGEN_GEMINI;
async function gem(model, parts, cfg) {
  const body = { contents: [{ role: 'user', parts }], generationConfig: cfg || {} };
  if (SERVER) return (await api('gemini', { model, body }, true)).data;
  const key = localStorage.getItem('jf_key');
  if (!key) throw new Error('Falta la API key de Gemini: conéctala en el servidor (Guía parte 4) o en Ajustes.');
  let r; try { r = await fetch(GEM + model + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('Sin conexión con Google Gemini.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('Error ' + r.status));
  return j;
}
function gemText(j) { const c = ((j && j.candidates) || [])[0]; if (!c || !c.content) { const why = c && c.finishReason ? ' (' + c.finishReason + ')' : ''; throw new Error('La IA no devolvió respuesta' + why); } return (c.content.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join(''); }
function parseJSON(t) { const s = String(t || '').replace(/```json|```/g, '').trim(); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1)); throw new Error('La respuesta de la IA no tiene el formato esperado.'); } }
const img64 = d => ({ inline_data: { mime_type: 'image/jpeg', data: d.split(',')[1] } });

function patientContext(d) {
  d = d || {};
  const L = (k, lab) => { const v = d[k]; const t = Array.isArray(v) ? v.join(', ') : v; return t ? `- ${lab}: ${t}` : ''; };
  return [L('edad', 'Edad'), L('sexo', 'Sexo'), L('talla', 'Talla cm'), L('peso', 'Peso kg'), L('imc', 'IMC'), L('padecimientos', 'Padecimientos'), L('padecimientosOtros', 'Otros antecedentes'), L('alergias', 'Alergias'), L('alergiasOtras', 'Otras alergias'), L('meds', 'Medicamentos'), L('medsDetalle', 'Detalle medicamentos'), L('embarazo', 'Embarazo/lactancia'), L('tabaco', 'Tabaquismo'), L('sol', 'Exposición solar'), L('fps', 'Protector solar'), L('skincare', 'Rutina de piel'), L('previos', 'Tratamientos estéticos previos'), L('previosDetalle', 'Detalle previos'), L('complicaciones', 'Complicaciones previas'), L('fitzq', 'Fitzpatrick autorreporte'), L('tipoPiel', 'Tipo de piel'), L('pielPreocupa', 'Preocupaciones de piel'), L('motivo', 'Motivo de consulta'), L('zonas', 'Zonas a mejorar'), L('cambio', 'Cambio deseado'), L('evento', 'Evento próximo'), L('presupuesto', 'Presupuesto'), L('preocupacion', 'Preocupación excesiva por apariencia')].filter(Boolean).join('\n') || '- Sin encuesta registrada (paciente rápido).';
}
function analysisPrompt(t, o, photoList) {
  return `Actúa como mi DERMATÓLOGO EXPERTO y MÉDICO ESTÉTICO EXPERTO. Soy el Dr. Javier Flores (médico cirujano, medicina estética). Ayúdame a identificar TODO, desde lo más simple hasta lo que se le podría escapar a un experto. Sé objetivo, técnico, prudente y realista.

FOTOS ADJUNTAS (en este orden): ${photoList.join(', ')}.
PROCEDIMIENTO PLANEADO: ${t.n} (${t.d}). Expectativa elegida: ${o.lvl}.
PRODUCTO: ${o.brand || 'NO INDICADO'} · CANTIDAD: ${o.qty ? o.qty + ' ' + o.unit : 'NO INDICADA'}${o.zones ? ' · Zonas/técnica: ' + o.zones : ''}${o.notes ? '\nNOTAS DEL MÉDICO: ' + o.notes : ''}

DATOS DEL PACIENTE (encuesta):
${patientContext(M.patient && M.patient.datos)}

ALERTAS YA DETECTADAS POR REGLAS: ${M.alerts.map(a => a.txt).join(' | ') || 'ninguna'}

LINEAMIENTOS OBLIGATORIOS:
1. Mide la estructura facial: divide la cara en TERCIOS (trichion–glabela–subnasal–mentón) para simetría vertical y en QUINTOS para simetría horizontal; evalúa la LÍNEA MEDIA.
2. Si hay foto de PERFIL: evalúa ángulos faciales (nasofrontal, nasolabial, mentocervical, cervicomental), línea E de Ricketts y proyección de mentón respecto al labio inferior. Si no hay perfil, indícalo y no inventes valores.
3. Marca ZONAS DE PELIGRO para TOXINA BOTULÍNICA (p. ej. 1 cm sobre el reborde orbitario por ptosis palpebral, porción lateral de frente baja por ptosis de ceja, cigomático mayor, depresor del ángulo de la boca/orbicular, risorio/masetero anterior, platisma profundo) y para ÁCIDO HIALURÓNICO (arteria supratroclear/supraorbitaria en glabela, dorsal nasal y angular en nariz, angular/facial en surco nasogeniano, infraorbitaria, temporal superficial, labiales superior/inferior, mentoniana). Da coordenadas aproximadas sobre la foto FRONTAL.
4. Evalúa la piel: fototipo FITZPATRICK (I–VI) con justificación; grado de DAÑO SOLAR con escala de GLOGAU (I–IV); textura, pigmentación, componente vascular, poros, arrugas (dinámicas/estáticas y grado 0–3 por zona).
5. Si existe algún DIAGNÓSTICO DERMATOLÓGICO agrégalo (p. ej. melasma, rosácea, queratosis actínica, lentigos, dermatitis seborreica, acné, cicatrices, xantelasma, nevos atípicos); si solo lo sospechas, indícalo y sugiere INTERROGATORIO DIRIGIDO con preguntas concretas. Si hay lesiones sospechosas de malignidad, recomiéndalo explícitamente.
6. Si hay PÉRDIDA DE VOLUMEN sugiérelo, o sugiere BIOESTIMULADOR (Sculptra/Radiesse) si fuera el caso.
7. Genera ADVERTENCIAS y SUGERENCIAS de tratamiento de acuerdo a la impresión diagnóstica.
8. Genera una EXPECTATIVA ESTÉTICA RAZONABLE Y ALCANZABLE para el procedimiento elegido con ese producto y cantidad. Evalúa si la marca/cantidad es adecuada y sugiere el rango típico (ml o U). Si falta marca o cantidad, pregúntamelo en "preguntas_al_medico".
9. Si crees que hay otro procedimiento que podemos agregar a ese protocolo, sugiérelo.
10. Aplica estos CÁNONES DE BELLEZA y reporta cuáles cumple: ${CANONES.map((c, i) => (i + 1) + ') ' + c).join(' ')}

Sugerencias SOLO de este catálogo (usa el id exacto): ${ALL.filter(i => i.m).map(i => i.id + '=' + i.n + ' ' + fmt(i.p)).join('; ')}.

Coordenadas: x e y de 0 a 1000 relativos a la foto FRONTAL (x=0 borde izquierdo de la imagen, y=0 borde superior).
Responde SOLO un JSON válido en español con esta forma exacta:
{"resumen":"impresión diagnóstica global (4-6 líneas)","calidad_foto":"adecuada o qué falta",
"tercios":{"superior":"% aprox","medio":"% aprox","inferior":"% aprox","interpretacion":""},
"quintos":{"descripcion":"","interpretacion":""},"linea_media":"",
"perfil":{"evaluado":false,"nasofrontal":"","nasolabial":"","mentocervical":"","linea_e":"","proyeccion_menton":"","interpretacion":""},
"canones":[{"canon":"","resultado":"cumple|no cumple|no evaluable","comentario":""}],
"piel":{"fitzpatrick":"","fitzpatrick_justificacion":"","glogau":"","glogau_justificacion":"","dano_solar":"","textura":"","pigmentacion":"","vascular":"","arrugas":[{"zona":"","tipo":"dinámica|estática","grado":"0-3"}]},
"diagnosticos":[{"dx":"","certeza":"probable|sospecha","sugerencia":""}],
"interrogatorio_dirigido":[""],
"volumen":{"perdida":false,"zonas":[""],"recomendacion":""},
"zonas_peligro":[{"nombre":"","tipo":"toxina|ah","x":0,"y":0,"precaucion":""}],
"landmarks":{"trichion":{"x":0,"y":0},"glabela":{"x":0,"y":0},"subnasal":{"x":0,"y":0},"menton":{"x":0,"y":0},"cara_der":{"x":0,"y":0},"exocanto_der":{"x":0,"y":0},"endocanto_der":{"x":0,"y":0},"endocanto_izq":{"x":0,"y":0},"exocanto_izq":{"x":0,"y":0},"cara_izq":{"x":0,"y":0}},
"advertencias":[""],"expectativa":"","producto_evaluacion":"",
"protocolo":[{"orden":1,"tercio":"superior|medio|inferior|cuello|piel","procedimiento":"","detalle":""}],
"sugerencias":[{"id":"","why":""}],"sesiones":"","preguntas_al_medico":[""]}`;
}
async function analyze(t, o) {
  const parts = [{ text: '' }], list = [];
  [['frontal', 'FRONTAL'], ['perfil', 'PERFIL LATERAL'], ['oblicua', 'OBLICUA 3/4']].forEach(([k, lab]) => { if (M.photos[k]) { parts.push(img64(M.photos[k])); list.push(lab); } });
  parts[0].text = analysisPrompt(t, o, list);
  const j = await gem(textModel(), parts, { responseMimeType: 'application/json' });
  return parseJSON(gemText(j));
}

/* ---------- IA: imagen (Cloudflare gratis → Gemini → simulación local) ---------- */
function imagePrompt(t, o) {
  return `Edit this clinical facial photograph to show the realistic expected result AFTER this aesthetic-medicine treatment: ${t.n}.
CLINICAL INSTRUCTIONS: ${MODEL[t.id] || 'Subtle natural improvement of the treated area only.'}
INTENSITY: ${INT[o.lvl]}${o.brand || o.qty ? `\nPRODUCT: ${o.brand} ${o.qty ? o.qty + ' ' + o.unit : ''} (scale the change to this amount).` : ''}${o.zones ? '\nZONES: ' + o.zones : ''}
STRICT RULES: same person and identity, same pose, angle, framing, lighting, background, hair, clothing and camera. Photorealistic skin with natural pores. Only modify the anatomical areas affected by this treatment. No makeup, no beauty filter, no text, no watermark.`;
}
async function cfImage(prompt) {
  if (!SERVER) throw new Error('requiere el servidor de Google conectado');
  const small = await resizeData(M.photos.frontal, 512, .9);
  const s = 1024 / Math.max(small.w, small.h);
  const r = await api('cfImage', { prompt, image: small.data, width: Math.round(small.w * s / 16) * 16, height: Math.round(small.h * s / 16) * 16 }, true);
  return r.image;
}
async function gemImage(prompt) {
  const j = await gem(imgModelG(), [{ text: prompt }, img64(M.photos.frontal)], { responseModalities: ['TEXT', 'IMAGE'] });
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const p = parts.find(x => x.inlineData || x.inline_data); const d = p && (p.inlineData || p.inline_data);
  if (!d) throw new Error('no devolvió imagen (posible filtro de seguridad)');
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}
function localSim(lvl) {
  return new Promise(res => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
    const k = { sutil: .3, moderado: .5, marcado: .7 }[lvl] || .5; x.drawImage(im, 0, 0);
    const b = document.createElement('canvas'); const sc = .25; b.width = Math.max(1, im.width * sc); b.height = Math.max(1, im.height * sc); b.getContext('2d').drawImage(im, 0, 0, b.width, b.height);
    x.globalAlpha = k * .55; x.imageSmoothingQuality = 'high'; x.drawImage(b, 0, 0, c.width, c.height);
    x.globalAlpha = .08 * k; x.fillStyle = '#fff2e6'; x.fillRect(0, 0, c.width, c.height);
    res(c.toDataURL('image/jpeg', .92)); }; im.src = M.photos.frontal; });
}
async function modelImage(t, o) {
  const prompt = imagePrompt(t, o), sel = $('engine').value, errs = [];
  const order = sel === 'auto' ? (SERVER ? ['cf', 'gemini'] : ['gemini']) : (sel === 'local' ? [] : [sel]);
  for (const e of order) {
    try {
      if (e === 'cf') return { src: await cfImage(prompt), engine: 'Cloudflare FLUX.2 (gratis)' };
      if (e === 'gemini') return { src: await gemImage(prompt), engine: 'Google Gemini imagen' };
    } catch (err) { errs.push((e === 'cf' ? 'Cloudflare' : 'Gemini imagen') + ': ' + err.message); }
  }
  return { src: await localSim(o.lvl), engine: 'Simulación local básica (solo piel, no anatómica)', note: errs.join(' · ') };
}

/* ---------- ejecutar ---------- */
function setStatus(t) { $('status').textContent = t; }
function showBefore(src) { $('imgBefore').src = src; $('imgBefore').style.display = 'block'; $('empty').style.display = 'none'; $('lb1').style.display = 'block'; ['handle', 'lb2', 'slider'].forEach(i => $(i).style.display = 'none'); $('afterWrap').style.display = 'none'; }
function showAfter(src) { $('imgAfter').src = src; $('afterWrap').style.display = 'block'; ['handle', 'lb2', 'slider'].forEach(i => $(i).style.display = 'block'); $('slider').value = 50; setSlider(50); }
function setSlider(v) { $('afterWrap').style.clipPath = `inset(0 0 0 ${v}%)`; $('handle').style.left = v + '%'; }
on($('slider'), 'input', e => setSlider(e.target.value));

let running = false;
async function run(withImage) {
  if (running) return; if (!M.photos.frontal) return toast('Sube la foto frontal.', true);
  running = true; const o = opts(), t = byId(o.id); renderAlerts();
  $('run').disabled = $('runAna').disabled = $('regen').disabled = true;
  M.before = M.photos.frontal; M.saved = false; if (withImage) M.after = '';
  wzGo(4); showBefore(M.before); $('loader').classList.add('on'); $('loadtxt').textContent = withImage ? 'Analizando y generando modelación…' : 'Analizando rostro y piel…'; $('engineUsed').textContent = '';
  $('report').innerHTML = '<p class="hint">Analizando con IA… (puede tardar hasta 1 minuto)</p>';
  initViewer();
  try {
    const tasks = [analyze(t, o)]; if (withImage) tasks.push(modelImage(t, o));
    const [ana, img] = await Promise.allSettled(tasks);
    if (img) {
      if (img.status === 'fulfilled') { M.after = img.value.src; M.engine = img.value.engine; showAfter(M.after); $('engineUsed').textContent = 'Motor: ' + img.value.engine + (img.value.note ? ' — ' + img.value.note : ''); }
      else { $('engineUsed').textContent = 'No se pudo generar la imagen: ' + img.reason.message; }
    } else if (M.after) showAfter(M.after);
    if (ana.status === 'fulfilled') { M.analysis = ana.value; renderReport(); applyLandmarks(); }
    else { M.analysis = null; $('report').innerHTML = `<div class="banner bad">Análisis IA no disponible: ${esc(ana.reason.message)}</div><p class="hint">Las alertas clínicas, las medidas manuales y los filtros siguen disponibles.</p>`; }
    renderPlan(); renderViewerOptions(); renderViewer();
  } finally { running = false; $('run').disabled = $('runAna').disabled = $('regen').disabled = false; $('loader').classList.remove('on'); }
}
on($('run'), 'click', () => run(true));
on($('runAna'), 'click', () => run(false));
on($('regen'), 'click', async () => {
  if (!M.photos.frontal) return; const o = opts(), t = byId(o.id); $('regen').disabled = true; $('loader').classList.add('on'); $('loadtxt').textContent = 'Generando otra modelación…';
  try { const r = await modelImage(t, o); M.after = r.src; M.engine = r.engine; M.saved = false; showAfter(r.src); $('engineUsed').textContent = 'Motor: ' + r.engine + (r.note ? ' — ' + r.note : ''); renderViewerOptions(); }
  finally { $('regen').disabled = false; $('loader').classList.remove('on'); }
});

/* ---------- reporte ---------- */
function li(list) { const a = arr(list).filter(x => x && (typeof x === 'string' ? x.trim() : true)); return a.length ? `<ul>${a.map(x => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="hint">—</p>'; }
function renderReport() {
  const a = M.analysis || {}, p = a.piel || {}, pf = a.perfil || {}, te = a.tercios || {}, qu = a.quintos || {}, v = a.volumen || {};
  const kv = [['Fitzpatrick', p.fitzpatrick], ['Glogau', p.glogau], ['Daño solar', p.dano_solar], ['T. superior', te.superior], ['T. medio', te.medio], ['T. inferior', te.inferior]].filter(x => x[1]);
  $('report').innerHTML = `${a.resumen ? `<p>${esc(a.resumen)}</p>` : ''}${a.calidad_foto ? `<p class="hint">Foto: ${esc(a.calidad_foto)}</p>` : ''}
   ${kv.length ? `<div class="kv" style="margin-top:.8rem">${kv.map(([k, x]) => `<div><small>${esc(k)}</small><b>${esc(x)}</b></div>`).join('')}</div>` : ''}
   <h5>Tercios · simetría vertical</h5><p>${esc(te.interpretacion || '—')}</p>
   <h5>Quintos · simetría horizontal</h5><p>${esc([qu.descripcion, qu.interpretacion].filter(Boolean).join(' ') || '—')}</p>
   <h5>Línea media</h5><p>${esc(a.linea_media || '—')}</p>
   <h5>Perfil y ángulos faciales</h5>${pf.evaluado === false && !pf.nasolabial ? `<p class="hint">${esc(pf.interpretacion || 'Sin foto de perfil: no evaluable.')}</p>` : `<table><tr><th>Nasofrontal</th><th>Nasolabial</th><th>Mentocervical</th></tr><tr><td>${esc(pf.nasofrontal || '—')}</td><td>${esc(pf.nasolabial || '—')}</td><td>${esc(pf.mentocervical || '—')}</td></tr></table><p>Línea E: ${esc(pf.linea_e || '—')} · Mentón: ${esc(pf.proyeccion_menton || '—')}</p><p>${esc(pf.interpretacion || '')}</p>`}
   <h5>Cánones de belleza</h5>${arr(a.canones).length ? `<table>${arr(a.canones).map(c => `<tr><td>${esc(c.canon)}</td><td style="white-space:nowrap;color:${/no cumple/i.test(c.resultado) ? '#ff9aa6' : /cumple/i.test(c.resultado) ? '#7ef0a8' : 'var(--muted)'}">${esc(c.resultado)}</td><td class="hint">${esc(c.comentario || '')}</td></tr>`).join('')}</table>` : '<p class="hint">—</p>'}
   <h5>Piel</h5><p>${esc([p.fitzpatrick_justificacion, p.glogau_justificacion, p.textura, p.pigmentacion, p.vascular].filter(Boolean).join(' · ') || '—')}</p>
   ${arr(p.arrugas).length ? `<table><tr><th>Zona</th><th>Tipo</th><th>Grado</th></tr>${arr(p.arrugas).map(w => `<tr><td>${esc(w.zona)}</td><td>${esc(w.tipo)}</td><td>${esc(w.grado)}</td></tr>`).join('')}</table>` : ''}
   <h5>Diagnósticos dermatológicos</h5>${arr(a.diagnosticos).length ? `<ul>${arr(a.diagnosticos).map(d => `<li><b>${esc(d.dx)}</b> (${esc(d.certeza || '')}) — ${esc(d.sugerencia || '')}</li>`).join('')}</ul>` : '<p class="hint">Sin hallazgos relevantes.</p>'}
   <h5>Interrogatorio dirigido sugerido</h5>${li(a.interrogatorio_dirigido)}
   <h5>Volumen / bioestimulación</h5><p>${v.perdida ? '<b style="color:var(--gold-2)">Pérdida de volumen detectada.</b> ' : ''}${esc([arr(v.zonas).join(', '), v.recomendacion].filter(Boolean).join(' — ') || '—')}</p>
   <h5>Zonas de peligro</h5>${arr(a.zonas_peligro).length ? `<ul>${arr(a.zonas_peligro).map(z => `<li><b style="color:${z.tipo === 'toxina' ? '#ff9aa6' : '#ffc77a'}">${z.tipo === 'toxina' ? 'Toxina' : 'AH'} · ${esc(z.nombre)}</b> — ${esc(z.precaucion || '')}</li>`).join('')}</ul>` : '<p class="hint">—</p>'}
   <h5>Advertencias</h5>${li(a.advertencias)}
   <h5>Expectativa razonable</h5><p>${esc(a.expectativa || '—')}</p>
   <h5>Producto y cantidad</h5><p>${esc(a.producto_evaluacion || '—')}</p>
   ${arr(a.preguntas_al_medico).filter(Boolean).length ? `<h5>Preguntas para ti</h5>${li(a.preguntas_al_medico)}` : ''}
   <p class="hint" style="margin-top:1rem">Herramienta de apoyo. No sustituye el juicio clínico ni la exploración física.</p>`;
}
function renderPlan() {
  const o = opts(), main = byId(o.id), a = M.analysis || {};
  let list = arr(a.sugerencias).filter(s => s && byId(s.id) && s.id !== o.id && s.id !== 'valoracion').slice(0, 4);
  if (!list.length) list = (COMBO[o.id] || []).map(id => ({ id, why: '' }));
  const items = [{ id: main.id, n: main.n, p: main.p, why: 'Procedimiento seleccionado' }].concat(list.map(s => { const it = byId(s.id); return { id: it.id, n: it.n, p: it.p, why: s.why || it.d }; }));
  const total = items.reduce((s, i) => s + i.p, 0); M.plan = { items, total };
  const proto = arr(a.protocolo).filter(x => x && x.procedimiento);
  $('sugs').innerHTML = (proto.length ? `<div class="rep"><h5 style="margin-top:0">Orden del protocolo (superior → medio → inferior → cuello)</h5><ul>${proto.map(x => `<li><b>${esc(x.orden || '')}. ${esc(x.procedimiento)}</b> <span class="hint">(${esc(x.tercio || '')})</span> — ${esc(x.detalle || '')}</li>`).join('')}</ul>${a.sesiones ? `<p class="hint">Sesiones / duración: ${esc(a.sesiones)}</p>` : ''}</div>` : '') +
    items.map((i, k) => `<div class="sug"><div><b>${esc(i.n)}${k === 0 ? ' <span style="color:var(--gold)">· seleccionado</span>' : ''}</b><span>${esc(i.why)}</span></div><strong>${fmt(i.p)}</strong></div>`).join('') +
    `<div class="total"><span>Inversión estimada del plan</span><strong>${fmt(total)}</strong></div><p class="fine">Precios de referencia, sujetos a valoración médica.</p>`;
}

/* ---------- visor: tercios, quintos, línea media, zonas de peligro y filtros ---------- */
const OV = { mid: true, ter: true, qui: false, tox: false, ah: false };
const DEF_L = () => ({ h: [12, 37, 63, 90], v: [18, 32, 44, 56, 68, 82] });
function initViewer() { if (!M.L) M.L = DEF_L(); M.view = 'frontal'; renderViewerOptions(); renderViewer(); }
function renderViewerOptions() {
  const o = [['frontal', 'Foto frontal'], ['perfil', 'Perfil'], ['oblicua', 'Oblicua']].filter(([k]) => M.photos[k]);
  if (M.after) o.push(['after', 'Modelación']);
  $('vwPhoto').innerHTML = o.map(([k, l]) => `<option value="${k}" ${M.view === k ? 'selected' : ''}>${l}</option>`).join('');
}
function applyLandmarks() {
  const lm = (M.analysis && M.analysis.landmarks) || {};
  const g = (k, ax) => { const p = lm[k]; const n = p && Number(p[ax]); return n > 0 && n < 1000 ? n / 10 : null; };
  const h = ['trichion', 'glabela', 'subnasal', 'menton'].map(k => g(k, 'y'));
  const v = ['cara_der', 'exocanto_der', 'endocanto_der', 'endocanto_izq', 'exocanto_izq', 'cara_izq'].map(k => g(k, 'x'));
  const okH = h.every(x => x !== null), okV = v.every(x => x !== null);
  const L = M.L || DEF_L();
  if (okH) L.h = h.slice().sort((a, b) => a - b);
  if (okV) L.v = v.slice().sort((a, b) => a - b);
  M.L = L;
}
let srcCache = {};
async function viewerSrc() {
  const base = M.view === 'after' ? M.after : M.photos[M.view];
  const f = $('vwFilter').value; if (!base) return '';
  if (f === 'none') return base;
  const key = M.view + '|' + f + '|' + base.length;
  if (!srcCache[key]) srcCache[key] = await applyFilter(base, f);
  return srcCache[key];
}
async function renderViewer() {
  const img = $('vwImg'); const src = await viewerSrc(); if (!src) { img.removeAttribute('src'); $('ov').innerHTML = ''; return; }
  if (img.getAttribute('src') !== src) { img.src = src; await new Promise(r => { if (img.complete) r(); else { img.onload = r; img.onerror = r; } }); }
  drawOverlay();
}
function drawOverlay() {
  const L = M.L || DEF_L(), ov = $('ov'); let h = '';
  const canZones = M.view === 'frontal' || M.view === 'after';
  if (OV.ter) L.h.forEach((y, i) => { h += `<div class="hl" data-h="${i}" style="top:${y}%"></div><span class="tag" style="top:calc(${y}% - 16px);left:4px">${['Trichion', 'Glabela', 'Subnasal', 'Mentón'][i]}</span>`; });
  if (OV.qui) L.v.forEach((x, i) => { h += `<div class="vl" data-v="${i}" style="left:${x}%"></div>`; });
  if (OV.mid) { const mx = (L.v[2] + L.v[3]) / 2; h += `<div class="mid" style="left:${mx}%"></div><span class="tag" style="left:calc(${mx}% + 4px);bottom:6px;color:#ff9aa6">Línea media</span>`; }
  if (canZones && M.analysis) arr(M.analysis.zonas_peligro).forEach(z => {
    const t = z.tipo === 'toxina' ? 'toxina' : 'ah'; if (!OV[t === 'toxina' ? 'tox' : 'ah']) return;
    const x = Number(z.x) / 10, y = Number(z.y) / 10; if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) return;
    h += `<div class="dz ${t}" style="left:${x}%;top:${y}%" title="${esc(z.nombre + ': ' + (z.precaucion || ''))}"><span>${esc(z.nombre)}</span></div>`;
  });
  ov.innerHTML = h; renderRatios();
}
function renderRatios() {
  const L = M.L || DEF_L(), hs = L.h.slice().sort((a, b) => a - b), vs = L.v.slice().sort((a, b) => a - b);
  const T = hs[3] - hs[0], W = vs[5] - vs[0];
  const ter = [hs[1] - hs[0], hs[2] - hs[1], hs[3] - hs[2]].map(s => T > 0 ? s / T * 100 : 0);
  const qui = [0, 1, 2, 3, 4].map(i => W > 0 ? (vs[i + 1] - vs[i]) / W * 100 : 0);
  const mid = (vs[2] + vs[3]) / 2, left = mid - vs[0], right = vs[5] - mid;
  const dev = (x, ideal) => { const d = x - ideal; return `${x.toFixed(1)}% <span style="color:${Math.abs(d) > ideal * .12 ? '#ff9aa6' : '#7ef0a8'}">(${d >= 0 ? '+' : ''}${d.toFixed(1)})</span>`; };
  M.medidas = { tercios: ter.map(x => +x.toFixed(1)), quintos: qui.map(x => +x.toFixed(1)), simetria: left > 0 && right > 0 ? +(Math.min(left, right) / Math.max(left, right) * 100).toFixed(1) : null };
  $('ratios').innerHTML = `<div><b>Tercios</b> (ideal 33.3%): superior ${dev(ter[0], 33.3)} · medio ${dev(ter[1], 33.3)} · inferior ${dev(ter[2], 33.3)}</div>
   <div><b>Quintos</b> (ideal 20%): ${qui.map((q, i) => `${i + 1}º ${dev(q, 20)}`).join(' · ')}</div>
   <div><b>Simetría horizontal</b> (hemicara menor/mayor): ${M.medidas.simetria !== null ? M.medidas.simetria + '%' : '—'}${M.analysis && M.analysis.landmarks ? ' · líneas colocadas por IA, ajústalas si es necesario' : ' · coloca las líneas manualmente'}</div>`;
}
let drag = null;
on($('ov'), 'pointerdown', e => {
  const t = e.target.closest('.hl,.vl'); if (!t) return;
  drag = { el: t, h: t.dataset.h, v: t.dataset.v }; t.setPointerCapture(e.pointerId); e.preventDefault();
});
on($('ov'), 'pointermove', e => {
  if (!drag) return; const r = $('ov').getBoundingClientRect();
  if (drag.h !== undefined) { const y = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)); M.L.h[drag.h] = y; drag.el.style.top = y + '%'; const tag = drag.el.nextElementSibling; if (tag) tag.style.top = `calc(${y}% - 16px)`; }
  else { const x = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)); M.L.v[drag.v] = x; drag.el.style.left = x + '%'; }
  renderRatios();
});
const endDrag = () => { if (drag) { drag = null; drawOverlay(); } };
on($('ov'), 'pointerup', endDrag); on($('ov'), 'pointercancel', endDrag);
$$('#viewTools [data-ov]').forEach(c => on(c, 'change', () => { OV[c.dataset.ov] = c.checked; drawOverlay(); }));
on($('vwPhoto'), 'change', () => { M.view = $('vwPhoto').value; renderViewer(); });
on($('vwFilter'), 'change', async () => { $('vwFilter').disabled = true; try { await renderViewer(); } finally { $('vwFilter').disabled = false; } });

/* Filtros de piel (procesamiento local en el navegador) */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = s / (2 * r + 1); s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
function stretch(a) { const s = Array.from(a).filter((_, i) => i % 7 === 0).sort((x, y) => x - y); const lo = s[Math.floor(s.length * .01)] || 0, hi = s[Math.floor(s.length * .99)] || 255; const k = hi > lo ? 255 / (hi - lo) : 1; return v => Math.max(0, Math.min(255, (v - lo) * k)); }
function applyFilter(src, f) {
  return new Promise(res => { const im = new Image(); im.onload = () => {
    const s = Math.min(1, 1000 / Math.max(im.width, im.height)), w = Math.round(im.width * s), h = Math.round(im.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h), d = id.data, n = w * h, L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    if (f === 'wrinkle' || f === 'texture') {
      const r = f === 'wrinkle' ? Math.max(4, Math.round(w / 90)) : Math.max(2, Math.round(w / 300)), bl = boxBlur(L, w, h, r), amp = f === 'wrinkle' ? 4 : 6, hp = new Float32Array(n);
      for (let i = 0; i < n; i++) hp[i] = 128 + (L[i] - bl[i]) * amp;
      const st = stretch(hp); for (let i = 0; i < n; i++) { const v = st(hp[i]); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
    } else if (f === 'pigment') {
      const B = new Float32Array(n); for (let i = 0; i < n; i++) B[i] = d[i * 4 + 2]; const st = stretch(B);
      for (let i = 0; i < n; i++) { const v = st(B[i]); d[i * 4] = v * .62; d[i * 4 + 1] = v * .58; d[i * 4 + 2] = Math.min(255, v * 1.05 + 10); }
    } else if (f === 'vascular') {
      const E = new Float32Array(n); for (let i = 0; i < n; i++) E[i] = d[i * 4] - (d[i * 4 + 1] + d[i * 4 + 2]) / 2; const st = stretch(E);
      for (let i = 0; i < n; i++) { const v = st(E[i]) / 255, g = L[i] * .55; d[i * 4] = Math.min(255, g + v * 200); d[i * 4 + 1] = g * (1 - v * .6); d[i * 4 + 2] = g * (1 - v * .6); }
    } else if (f === 'equalize') {
      const hist = new Array(256).fill(0); for (let i = 0; i < n; i++) hist[L[i] | 0]++; let acc = 0; const cdf = hist.map(v => (acc += v)); const m = cdf.find(v => v > 0);
      for (let i = 0; i < n; i++) { const k = ((cdf[L[i] | 0] - m) / (n - m || 1)) * 255, ratio = L[i] > 0 ? k / L[i] : 1; d[i * 4] = Math.min(255, d[i * 4] * ratio); d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * ratio); d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * ratio); }
    }
    x.putImageData(id, 0, 0); res(c.toDataURL('image/jpeg', .9));
  }; im.onerror = () => res(src); im.src = src; });
}

/* ---------- guardar, descargar, imprimir ---------- */
on($('saveVisit'), 'click', async () => {
  if (!M.patient || !M.before) return toast('Primero genera un análisis.', true);
  if (M.saved) return toast('Esta modelación ya está guardada.');
  const o = opts(), t = byId(o.id), b = $('saveVisit'); b.disabled = true; b.textContent = 'Guardando…';
  try {
    const before = (await resizeData(M.before, 900, .85)).data, after = M.after ? (await resizeData(M.after, 900, .85)).data : '';
    const visit = { pacienteId: M.patient.id, fecha: new Date().toISOString(), procedimientoId: t.id, procedimiento: t.n, intensidad: o.lvl, marca: o.brand, cantidad: o.qty, unidad: o.unit, zonas: o.zones, notas: o.notes, motor: M.engine || '', alertas: M.alerts.map(a => a.lvl + ': ' + a.txt), analisis: M.analysis || {}, plan: M.plan || null, medidas: M.medidas || null };
    await D.saveVisit(visit, before, after); M.saved = true; toast('Guardado en la historia clínica de ' + M.patient.nombre + ' ✓');
  } finally { b.disabled = false; b.textContent = '💾 Guardar en historia clínica'; }
});
on($('dl'), 'click', () => {
  if (!M.after) return toast('Aún no hay modelación.', true);
  const a = new Image(), b = new Image(); let n = 0;
  const go = () => { if (++n < 2) return; const h = 900, wa = a.width * h / a.height, wb = b.width * h / b.height; const c = document.createElement('canvas'); c.width = wa + wb; c.height = h + 70; const x = c.getContext('2d');
    x.fillStyle = '#0d0b0c'; x.fillRect(0, 0, c.width, c.height); x.drawImage(a, 0, 0, wa, h); x.drawImage(b, wa, 0, wb, h); x.fillStyle = '#e8d6aa'; x.font = '22px sans-serif';
    x.fillText('ANTES', 20, h + 30); x.fillText('MODELACIÓN IA — ' + byId(opts().id).n, wa + 20, h + 30); x.font = '14px sans-serif'; x.fillStyle = '#a69a8c'; x.fillText('Dr. Javier Flores · La modelación es ilustrativa y no asegura el resultado exacto.', 20, h + 56);
    const l = document.createElement('a'); l.download = 'modelacion-' + norm(M.patient ? M.patient.nombre : 'paciente').replace(/[^a-z0-9]+/g, '-') + '.jpg'; l.href = c.toDataURL('image/jpeg', .9); document.body.appendChild(l); l.click(); l.remove(); };
  a.onload = go; b.onload = go; a.src = M.before; b.src = M.after;
});
on($('printVisit'), 'click', () => {
  if (!M.before) return toast('Primero genera un análisis.', true);
  const o = opts(), t = byId(o.id);
  printNow(`<h1>Análisis y modelación — ${esc(M.patient ? M.patient.nombre : '')}</h1><p>${esc(mxNow().date)} · ${esc(t.n)} · ${esc(o.brand)} ${esc(o.qty)} ${esc(o.qty ? o.unit : '')} · Dr. Javier Flores, Céd. 14182373</p>
   <img src="${M.before}">${M.after ? `<img src="${M.after}">` : ''}
   <h2>Alertas clínicas</h2><ul>${M.alerts.map(a => `<li>${esc(a.txt)}</li>`).join('')}</ul>
   <h2>Medidas</h2><p>${esc($('ratios').innerText)}</p>
   <h2>Impresión diagnóstica</h2>${$('report').innerHTML}<h2>Plan</h2>${$('sugs').innerHTML}
   <p><i>La modelación es una aproximación ilustrativa generada por IA y no garantiza el resultado.</i></p>`);
});

/* ---------- ajustes ---------- */
async function renderStatus() {
  const box = $('sysStatus'); const lines = [`<div><b>Modo:</b> ${SERVER ? 'Servidor de Google conectado (agenda y expedientes en la nube)' : 'Dispositivo (sin servidor)'}</div>`];
  $('localKeys').style.display = SERVER ? 'none' : '';
  if (SERVER) {
    box.innerHTML = lines.join('') + '<div>Comprobando servidor…</div>';
    try { const s = await api('status', {}, true); lines.push(`<div><b>Hoja:</b> ${esc(s.hoja)}</div>`, `<div><b>Gemini (análisis gratis):</b> ${s.gemini ? '✓ configurado' : '✗ falta GEMINI_API_KEY (Guía parte 4)'}</div>`, `<div><b>Cloudflare (imagen gratis):</b> ${s.cloudflare ? '✓ configurado' : '✗ faltan CF_ACCOUNT_ID y CF_API_TOKEN (Guía parte 5)'}</div>`, `<div><b>Horario:</b> ${esc(s.config.slots[0])} a ${esc(C.HORA_FIN)}:00 · ${s.config.slots.length} citas por día</div>`); }
    catch (e) { lines.push(`<div style="color:#ff9aa6">✗ ${esc(e.message)}</div>`); }
  } else lines.push(`<div><b>Gemini en este dispositivo:</b> ${localStorage.getItem('jf_key') ? '✓ guardada' : '✗ sin key'}</div>`, '<div>Imagen gratis (Cloudflare) requiere el servidor de Google.</div>');
  box.innerHTML = lines.join('');
}
on($('sysCheck'), 'click', renderStatus);
on($('keySave'), 'click', () => { localStorage.setItem('jf_key', $('keyIn').value.trim()); localStorage.setItem('jf_txt', $('txtModel').value.trim() || C.MODELO_TEXTO); localStorage.setItem('jf_img', $('imgModel').value.trim() || C.MODELO_IMAGEN_GEMINI); toast('Guardado en este dispositivo ✓'); renderStatus(); });
on($('bkExport'), 'click', async () => {
  const data = { app: 'drjavierflores', fecha: new Date().toISOString() }; for (const k of ['patients', 'visits', 'appts', 'blocks']) data[k] = (await KV.get(k)) || [];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'respaldo-expedientes-' + mxNow().date + '.json'; document.body.appendChild(a); a.click(); a.remove();
});
on($('bkImport'), 'click', () => $('bkFile').click());
on($('bkFile'), 'change', async e => {
  const f = e.target.files[0]; if (!f) return; let data;
  try { data = JSON.parse(await f.text()); } catch (er) { return toast('Archivo de respaldo inválido', true); }
  if (data.app !== 'drjavierflores') return toast('Archivo de respaldo inválido', true);
  for (const k of ['patients', 'visits', 'appts', 'blocks']) { const cur = (await KV.get(k)) || [], ids = new Set(cur.map(x => x.id || x.folio)); arr(data[k]).forEach(x => { if (!ids.has(x.id || x.folio)) cur.push(x); }); await KV.set(k, cur); }
  toast('Respaldo importado ✓');
});

/* ---------- inicio ---------- */
if (sessionStorage.getItem('jf_doc') && sessionStorage.getItem('jf_pw')) openPanel();
if (location.hash === '#medico') openLogin();
addEventListener('hashchange', () => { if (location.hash === '#medico') openLogin(); });
window.JF = { version: '2.0', server: SERVER };
})();
