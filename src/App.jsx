import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Home,
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  ArrowLeft,
  X,
  Plus,
  Minus,
  Trash2,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Pencil,
  Type,
  Lock,
  GraduationCap,
  MoreVertical,
  Search,
  List,
  Network,
  Download,
  Paperclip,
  CheckSquare,
  Square,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Repeat,
  Settings,
  ExternalLink,
  Check,
  Sun,
  Moon,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Bell,
  BellRing,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { getSupabaseUser, supabase, invocarGoogleCalendarAuth } from "./lib/supabase";

/* =========================================================================
   TOKENS — "ficha de cátedra": estética de fichero de biblioteca / libreta
   universitaria. Serif de diploma + sans de planilla + mono de horario.
   ========================================================================= */

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

const COLORES = [
  { nombre: "Rojo", hex: "#C63637" },
  { nombre: "Naranja", hex: "#E5A164" },
  { nombre: "Mostaza", hex: "#DDBB5E" },
  { nombre: "Oliva", hex: "#C3C263" },
  { nombre: "Verde", hex: "#8FC475" },
  { nombre: "Esmeralda", hex: "#4FBA88" },
  { nombre: "Celeste", hex: "#63B8CE" },
  { nombre: "Azul", hex: "#6F9DDA" },
  { nombre: "Violeta", hex: "#A487D9" },
  { nombre: "Magenta", hex: "#CE7CB3" },
  { nombre: "Rosa", hex: "#FA8FB1" },
];

const ESTADOS = ["Pendiente", "Cursando", "Regular", "Aprobada"];
const ESTADO_COLOR = {
  Pendiente: "#7A7768",
  Cursando: "#2C5C8A",
  Regular: "#C4842E",
  Aprobada: "#6FB37E",
};

const RECURSO_TIPOS = ["Libro", "PDF", "Apunte", "Link", "Otro"];

const TIPOS_EXAMEN = [
  { id: "Trabajo práctico", color: "#2C5C8A" },
  { id: "Parcial", color: "#C4842E" },
  { id: "Recuperatorio", color: "#B5651D" },
  { id: "Final", color: "#9C3B2E" },
  { id: "Otro", color: "#6E4C8A" },
];
const TIPO_EXAMEN_COLOR = Object.fromEntries(TIPOS_EXAMEN.map((t) => [t.id, t.color]));

// Solo "Trabajo práctico" pide un título libre. El resto se completa solo:
// - Parcial: "Primer parcial" si todavía no hay uno cargado, si no "Segundo parcial".
// - Recuperatorio: "Recuperatorio primer parcial" / "Recuperatorio segundo parcial",
//   según cuál se esté recuperando.
// - Final / Otro: el título es directamente el nombre del tipo.
function tituloAutomaticoExamen(form, examenesExistentes) {
  if (form.tipo === "Trabajo práctico") return form.titulo.trim();
  if (form.tipo === "Parcial") {
    const yaHayPrimero = (examenesExistentes || []).some((e) => e.tipo === "Parcial" && e.titulo === "Primer parcial");
    return yaHayPrimero ? "Segundo parcial" : "Primer parcial";
  }
  if (form.tipo === "Recuperatorio") {
    return form.recuperaDe ? `Recuperatorio ${form.recuperaDe.toLowerCase()}` : "";
  }
  return form.tipo; // "Final" u "Otro"
}

const ASISTENCIA_MINIMA_DEFAULT = 75;

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Nombres de los 7 días, en el mismo orden que Date().getDay() (0 = Domingo),
// usados para la recurrencia semanal de tareas ("todos los martes"…).
const DIAS_SEMANA_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
function pluralDia(i) {
  const n = DIAS_SEMANA_NOMBRE[i];
  return i === 0 || i === 6 ? n + "s" : n; // "Domingos"/"Sábados" son los únicos irregulares
}

// Rango horario de la grilla del calendario semanal (más amplio que el de
// "Horario", que solo cubre el horario típico de cursada).
const CAL_HORA_INICIO = 7;
const CAL_HORA_FIN = 23;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ANIO_LABEL = { 1: "1er año", 2: "2do año", 3: "3er año", 4: "4to año", 5: "5to año", 6: "6to año" };
const anioLabel = (n) => (n ? ANIO_LABEL[n] || `${n}° año` : "Sin año");

const ANIO_SHADES = ["#3D6B4F", "#356446", "#2C583C", "#234B32", "#1B3F29", "#12331F"];
const colorParaAnio = (anio) => (anio ? ANIO_SHADES[Math.min(anio - 1, ANIO_SHADES.length - 1)] : "#DAD4BC");

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function recursoIcon(tipo) {
  if (tipo === "Libro") return BookOpen;
  if (tipo === "Link") return LinkIcon;
  return FileText;
}

function resizeImageFile(file, maxDim = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve({ dataUrl: reader.result, nombre: file.name, tipo: file.type });
    reader.readAsDataURL(file);
  });
}

const toDateStr = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fromDateStr = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtFecha = (s) => {
  const d = fromDateStr(s);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
};
const fmtFechaLarga = (s) => {
  const d = fromDateStr(s);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};
const fmtFechaCorta = (s) => {
  const d = fromDateStr(s);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};
const fmtFechaHoraNota = (iso) => {
  const d = new Date(iso);
  const fecha = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} · ${hora}`;
};
// Lunes 00:00 de la semana que contiene la fecha dada (para el resumen
// semanal de Focus).
function inicioDeSemana(d) {
  const date = new Date(d);
  const dia = (date.getDay() + 6) % 7; // 0 = Lunes … 6 = Domingo
  date.setDate(date.getDate() - dia);
  date.setHours(0, 0, 0, 0);
  return date;
}
// "1 h 20 min" / "45 min" — para mostrar minutos totales de estudio.
function fmtDuracionMin(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
const parseHora = (h) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh + mm / 60;
};
// Próxima fecha (YYYY-MM-DD) en que cae un día de la semana dado, contando
// desde "desdeStr" (o desde hoy si no se pasa). Con incluirDesde=true, si
// "desdeStr" ya cae en ese día, devuelve esa misma fecha; si no, siempre
// avanza al menos una semana (para no repetir la misma fecha al completar).
function proximaFechaRecurrente(diaSemana, desdeStr, incluirDesde = false) {
  const base = desdeStr ? fromDateStr(desdeStr) : new Date();
  base.setHours(0, 0, 0, 0);
  const actual = base.getDay();
  let delta = (diaSemana - actual + 7) % 7;
  if (delta === 0 && !incluirDesde) delta = 7;
  const prox = new Date(base);
  prox.setDate(base.getDate() + delta);
  return toDateStr(prox);
}
const fmtHoraEvento = (dt) =>
  new Date(dt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const horaDecimalDe = (dt) => {
  const d = new Date(dt);
  return d.getHours() + d.getMinutes() / 60;
};
const sumarHora = (hhmm, delta) => {
  let [h, m] = hhmm.split(":").map(Number);
  h = (h + delta + 24) % 24;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const diffDias = (fechaStr) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = fromDateStr(fechaStr);
  f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
};

function textoUrgencia(fechaStr) {
  if (!fechaStr) return "Sin fecha";
  const dias = diffDias(fechaStr);
  if (dias < 0) return dias === -1 ? "Venció ayer" : `Venció hace ${Math.abs(dias)} días`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

function nivelUrgencia(fechaStr) {
  if (!fechaStr) return "sin-fecha";
  const dias = diffDias(fechaStr);
  if (dias < 0) return "vencida";
  if (dias <= 2) return "urgente";
  if (dias <= 6) return "proxima";
  return "lejana";
}

/* Intenta sacar el ID real de un calendario a partir de cualquier link de
   Google Calendar que el usuario haya pegado: el de "abrir calendario"
   (?cid=... en base64), uno con ?src=..., o directamente el ID suelto. */
function extraerIdDeUrl(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.has("cid")) {
      const cid = u.searchParams.get("cid");
      try {
        return atob(cid);
      } catch (e) {
        return decodeURIComponent(cid);
      }
    }
    if (u.searchParams.has("src")) {
      return decodeURIComponent(u.searchParams.get("src"));
    }
  } catch (e) {
    // no era una URL válida, seguimos con el valor tal cual
  }
  return null;
}

/* Punto único de verdad para convertir CUALQUIER cosa que el usuario haya
   pegado (un ID suelto tipo abc123@group.calendar.google.com, un link de
   "Compartir" con ?cid=, un link con ?src=, o una URL de embed ya armada)
   en el ID real y limpio del calendario. Tanto el iframe de solo lectura
   como las llamadas a la API real (crear/editar/eliminar/listar eventos)
   tienen que pasar por acá: mandarle una URL completa a la API en vez del
   ID puro es justamente lo que produce el error "Not found". */
function normalizarCalendarId(entrada) {
  let valor = (entrada || "").trim();
  if (!valor) return "";
  if (valor.includes("calendar.google.com/calendar/embed")) {
    try {
      const u = new URL(valor);
      if (u.searchParams.has("src")) return decodeURIComponent(u.searchParams.get("src"));
    } catch (e) {
      // sigue abajo con el valor tal cual si no pudo parsearse como URL
    }
  }
  if (valor.startsWith("http")) {
    const extraido = extraerIdDeUrl(valor);
    if (extraido) return extraido;
  }
  return valor;
}

/* Arma la URL de embed (solo lectura) a partir del ID ya normalizado. */
function armarUrlEmbedCalendario(entrada) {
  const id = normalizarCalendarId(entrada);
  if (!id) return "";
  const src = encodeURIComponent(id);
  return `https://calendar.google.com/calendar/embed?src=${src}&ctz=America%2FArgentina%2FMendoza&mode=MONTH&showTitle=0&showPrint=0&showCalendars=0&showTz=0`;
}

// Paleta estándar de "colores de evento" de Google Calendar (la del selector
// de color al editar un evento ahí). Se usa solo como último recurso: la
// prioridad real es que el evento tome el color que le pusiste a la materia
// en "Materias", para que el calendario y esa sección hablen el mismo
// idioma visual (ej: todos los eventos de "Matemática I" del mismo verde
// que tiene esa materia en la lista).
const GOOGLE_EVENTO_COLORES = {
  "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73", "5": "#f6c026",
  "6": "#f5511d", "7": "#039be5", "8": "#616161", "9": "#3f51b5", "10": "#0b8043", "11": "#d60000",
};

// Google Calendar solo admite su propia paleta de colorId. El selector de la
// app, en cambio, permite cualquier hexadecimal; al guardar elegimos el color
// de Google visualmente más cercano para mantener una experiencia uniforme.
function colorIdGoogleMasCercano(hex) {
  const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  return Object.entries(GOOGLE_EVENTO_COLORES).reduce((mejor, [id, color]) => {
    const [cr, cg, cb] = rgb(color);
    const distancia = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    return distancia < mejor.distancia ? { id, distancia } : mejor;
  }, { id: "1", distancia: Infinity }).id;
}
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizarTexto = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const ROMANO_O_NUM_SUELTO = /^(iv|ix|i{1,3}|vi{0,3}|x)$|^\d+$/;

// Separa el nombre de una materia en su "núcleo" (primera palabra, la que
// sirve para reconocer una abreviación) y su numeral final si tiene
// (I, II, III… o un número), para poder comparar por separado.
function nucleoYSufijo(nombre) {
  const palabras = normalizarTexto(nombre).split(/\s+/).filter(Boolean);
  let sufijo = "";
  let nucleo = palabras;
  if (palabras.length > 1 && ROMANO_O_NUM_SUELTO.test(palabras[palabras.length - 1])) {
    sufijo = palabras[palabras.length - 1];
    nucleo = palabras.slice(0, -1);
  }
  return { primeraPalabra: nucleo[0] || "", sufijo };
}

// Coincidencia por abreviación: cubre títulos de evento truncados como
// "Matem I" (para "Matemática I"), "Neg." (para "Negociaciones") o
// "Econ." (para "Economía I"). Alguna palabra del título del evento tiene
// que compartir al menos los primeros caracteres con la primera palabra
// de la materia, y si la materia termina en numeral (I, II, III…), ese
// mismo numeral tiene que aparecer suelto en el evento — así no se
// confunde "Comercialización I" con "Comercialización II".
function coincidePorAbreviacion(tituloEvento, nombreMateria) {
  const { primeraPalabra: pM, sufijo: sM } = nucleoYSufijo(nombreMateria);
  if (pM.length < 3) return false;
  const palabrasEvento = normalizarTexto(tituloEvento).split(/[\s.,;:\-–—]+/).filter(Boolean);
  const hayNucleo = palabrasEvento.some((p) => {
    if (p.length < 3) return false;
    const n = Math.min(p.length, pM.length, 5);
    return p.slice(0, n) === pM.slice(0, n);
  });
  if (!hayNucleo) return false;
  if (sM) return palabrasEvento.includes(sM);
  return true;
}

// Busca si el título de un evento corresponde a una materia cargada (por
// nombre exacto, o como palabra completa dentro del título). Es la base
// tanto para elegir el color del evento como para decidir si ese evento
// es "una clase" (se agrupa en la vista mensual) o "importante" (examen,
// entrega, etc., que se muestra siempre visible y destacado).
function materiaDeEvento(ev, materias) {
  const titulo = (ev.summary || "").trim();
  if (!titulo || !materias || !materias.length) return null;
  const exacta = materias.find((m) => m.nombre.trim().toLowerCase() === titulo.toLowerCase());
  if (exacta) return exacta;
  const candidatas = materias
    .filter((m) => m.nombre.trim() && new RegExp(`\\b${escapeRegExp(m.nombre.trim())}\\b`, "i").test(titulo))
    .sort((a, b) => b.nombre.length - a.nombre.length);
  if (candidatas[0]) return candidatas[0];
  // Tercer intento: título abreviado (ver coincidePorAbreviacion).
  const abreviadas = materias
    .filter((m) => m.nombre.trim() && coincidePorAbreviacion(titulo, m.nombre))
    .sort((a, b) => b.nombre.length - a.nombre.length);
  return abreviadas[0] || null;
}

// Detecta, por palabras clave en el título, si el evento describe un examen
// (y de qué tipo). Se usa tanto para auto-completar el formulario de "Nuevo
// evento" como para que estos eventos NO se agrupen como "clase" en el
// calendario, aunque su título contenga el nombre de una materia (ej:
// "Parcial Derecho I" es un examen de Derecho I, no una clase de Derecho I).
const PALABRAS_TIPO_EXAMEN = [
  { tipo: "Recuperatorio", patrones: [/\brecuperator/] }, // antes que "Parcial": "Recuperatorio del parcial" es un recuperatorio.
  { tipo: "Parcial", patrones: [/\bparcial(es)?\b/] },
  { tipo: "Final", patrones: [/\bfinal(es)?\b/] },
  { tipo: "Trabajo práctico", patrones: [/\btp\b/, /trabajo\s*practico/, /\bentrega\b/] },
];
function detectarTipoExamenEnTitulo(titulo) {
  const t = normalizarTexto(titulo || "");
  for (const { tipo, patrones } of PALABRAS_TIPO_EXAMEN) {
    if (patrones.some((p) => p.test(t))) return tipo;
  }
  return null;
}

// Combina las dos detecciones de arriba: si el título trae tanto el nombre
// de una materia como una palabra de examen, devuelve ambos datos listos
// para precargar el vínculo "evento -> examen de esa materia".
function detectarExamenDesdeTitulo(titulo, materias) {
  const tipo = detectarTipoExamenEnTitulo(titulo);
  if (!tipo) return null;
  const materia = materiaDeEvento({ summary: titulo }, materias);
  if (!materia) return null;
  return { materia, tipo };
}

// Igual que materiaDeEvento, pero solo para decidir si un evento se agrupa
// como "clase": si el título tiene pinta de examen (Parcial, Final, TP,
// Recuperatorio...) no cuenta como clase aunque mencione una materia — se
// muestra como evento "importante" en su lugar.
function claseDeEvento(ev, materias) {
  if (detectarTipoExamenEnTitulo(ev.summary)) return null;
  return materiaDeEvento(ev, materias);
}

function colorParaEvento(ev, materias) {
  const materia = materiaDeEvento(ev, materias);
  if (materia) return materia.color;
  // Sin materia asociada: el color de evento que eligió Google, o uno
  // estable derivado del título para que al menos sea siempre el mismo.
  if (ev.colorId && GOOGLE_EVENTO_COLORES[ev.colorId]) return GOOGLE_EVENTO_COLORES[ev.colorId];
  const texto = ev.summary || ev.id || "";
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  return COLORES[hash % COLORES.length].hex;
}

// Abrevia el nombre de una materia para que entre en el segmento angosto
// de la barra de clases del día (ej: "Administración I" -> "Admin I",
// "Comercialización Vitivinícola" -> "Com. Vit.").
function abreviarMateria(nombre) {
  const ROMANO_O_NUM = /^(IV|IX|I{1,3}|VI{0,3}|X)$|^\d+$/i;
  const CONECTORES = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "a", "al"]);
  let palabras = nombre.trim().split(/\s+/);
  let sufijo = "";
  const ultima = palabras[palabras.length - 1];
  if (palabras.length > 1 && ROMANO_O_NUM.test(ultima)) {
    sufijo = ` ${ultima}`;
    palabras = palabras.slice(0, -1);
  }
  // Para abreviar, ignoramos conectores cortos ("de", "la", "a"…) salvo que
  // sean las únicas palabras que queden.
  let clave = palabras.filter((p) => !CONECTORES.has(p.toLowerCase()));
  if (clave.length === 0) clave = palabras;
  let abrev;
  if (clave.length <= 1) {
    abrev = (clave[0] || "").slice(0, 5);
  } else {
    abrev = clave.slice(0, 2).map((p) => p.slice(0, 3)).join(". ") + ".";
  }
  return (abrev + sufijo).trim();
}

/* =========================================================================
   SEED DATA
   ========================================================================= */

function seedData() {
  const hoy = new Date();
  const plus = (d) => toDateStr(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + d));

  // Datos ficticios de demostración para recorrer todas las secciones de la app.
  const definiciones = [
    // ---- 1er año (todas aprobadas) ----
    { nombre: "Contabilidad I", profesor: "Cra. Herrera", aula: "Aula 101", anio: 1, color: "#B5432E", estado: "Aprobada", fechaAprobada: plus(-650), correlativas: "",
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 8 }, { tipo: "Final", titulo: "Final", nota: 7 }],
      recursos: [{ tipo: "Libro", nombre: "Contabilidad Básica — Fowler Newton", url: "" }] },
    { nombre: "Matemática I", profesor: "Lic. Roldán", aula: "Aula 203", anio: 1, color: "#2C5C8A", estado: "Aprobada", fechaAprobada: plus(-640), correlativas: "",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 6 }] },
    { nombre: "Introducción a la Economía", profesor: "Lic. Paz", aula: "Aula 105", anio: 1, color: "#C4842E", estado: "Aprobada", fechaAprobada: plus(-620), correlativas: "",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 7 }] },
    { nombre: "Administración General", profesor: "Lic. Suárez", aula: "Aula 108", anio: 1, color: "#3D6B4F", estado: "Aprobada", fechaAprobada: plus(-610), correlativas: "",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 9 }] },
    { nombre: "Elementos de Derecho Civil", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 1, color: "#6E4C8A", estado: "Aprobada", fechaAprobada: plus(-600), correlativas: "",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 6 }] },

    // ---- 2do año (todas aprobadas, salvo Estadística I que está regular) ----
    { nombre: "Contabilidad II", profesor: "Cra. Herrera", aula: "Aula 101", anio: 2, color: "#B5432E", estado: "Aprobada", fechaAprobada: plus(-320), correlativas: "Contabilidad I",
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 7 }, { tipo: "Final", titulo: "Final", nota: 8 }] },
    { nombre: "Matemática Financiera", profesor: "Lic. Roldán", aula: "Aula 203", anio: 2, color: "#2C5C8A", estado: "Aprobada", fechaAprobada: plus(-300), correlativas: "Matemática I",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 8 }] },
    { nombre: "Estadística I", profesor: "Lic. Bianchi", aula: "Aula 204", anio: 2, color: "#2C5C8A", estado: "Regular", correlativas: "Matemática I",
      horarios: [{ dia: "Lunes", inicio: "18:00", fin: "20:00" }], asistencia: { faltas: 0, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6, fecha: plus(-22) }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 7, fecha: plus(-5) }, { tipo: "Final", titulo: "Final", nota: null, fecha: plus(12) }],
      tareas: [{ titulo: "Inscribirse a mesa de final", descripcion: "Revisar la fecha y el aula antes de confirmar.", fecha: plus(10) }],
      notas: [{ fecha: new Date().toISOString(), texto: "Repasar distribución normal y ejercicios de intervalos de confianza." }],
      recursos: [{ tipo: "PDF", nombre: "Guía de ejercicios — unidad 4", url: "https://example.com/guia-estadistica.pdf" }] },
    { nombre: "Derecho Comercial", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 2, color: "#6E4C8A", estado: "Aprobada", fechaAprobada: plus(-280), correlativas: "Elementos de Derecho Civil",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 7 }] },
    { nombre: "Microeconomía", profesor: "Lic. Paz", aula: "Aula 105", anio: 2, color: "#C4842E", estado: "Aprobada", fechaAprobada: plus(-270), correlativas: "Introducción a la Economía",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 8 }] },

    // ---- 3er año (año actual: cursando / regular) ----
    { nombre: "Contabilidad de Costos", profesor: "Cra. Molina", aula: "Aula 201", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Lunes", inicio: "08:00", fin: "10:00" }, { dia: "Miércoles", inicio: "08:00", fin: "10:00" }],
      asistencia: { faltas: 1, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — Costeo ABC", nota: 8, fecha: plus(-8) }, { tipo: "Parcial", titulo: "Primer parcial", nota: null, fecha: plus(6) }],
      tareas: [
        { titulo: "Resolver guía de costos ABC", descripcion: "Llevar los ejercicios 3, 5 y 7 resueltos.", fecha: plus(2), subtareas: [{ id: uid(), texto: "Leer el caso de la fábrica", completada: true }, { id: uid(), texto: "Calcular inductores", completada: false }, { id: uid(), texto: "Revisar resultados", completada: false }] },
        { titulo: "Repaso semanal de fórmulas", descripcion: "15 minutos de práctica.", fecha: plus(1), recurrencia: { diaSemana: 3 }, vecesCompletada: 2 },
        { titulo: "Subir el primer avance", fecha: plus(-3), completada: true },
      ],
      notas: [{ fecha: new Date(Date.now() - 86400000).toISOString(), texto: "La diferencia clave entre costeo tradicional y ABC está en la asignación de indirectos." }, { fecha: new Date().toISOString(), texto: "Preguntar en clase por el tratamiento de capacidad ociosa." }],
      recursos: [{ tipo: "Libro", nombre: "Costos para la gestión — capítulo 3", url: "https://example.com/costos-capitulo-3" }, { tipo: "Link", nombre: "Calculadora de punto de equilibrio", url: "https://example.com/punto-equilibrio" }],
      resumenes: [{ titulo: "Costeo ABC", bloques: [{ tipo: "texto", titulo: "Idea central", texto: "El costeo basado en actividades asigna los costos indirectos según las actividades que efectivamente consumen los productos, en vez de prorratearlos con una única base." }, { tipo: "texto", titulo: "Para recordar", texto: "Actividad → inductor → costo asignado." }] }] },
    { nombre: "Contabilidad Superior", profesor: "Cra. Herrera", aula: "Aula 101", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Martes", inicio: "14:00", fin: "17:00" }],
      asistencia: { faltas: 5, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6, fecha: plus(-10) }, { tipo: "Recuperatorio", titulo: "Recuperatorio primer parcial", nota: null, fecha: plus(9) }],
      tareas: [{ titulo: "Preparar exposición de EECC consolidados", descripcion: "Armar una diapositiva por ajuste de consolidación.", fecha: plus(5) }, { titulo: "Enviar consulta al equipo", fecha: plus(-1), completada: true }],
      notas: [{ fecha: new Date().toISOString(), texto: "Confirmar con el grupo quién explica eliminaciones intercompañía." }],
      recursos: [{ tipo: "Apunte", nombre: "Resumen de consolidación", url: "https://example.com/resumen-consolidacion" }] },
    { nombre: "Derecho Tributario I", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 3, color: "#6E4C8A", estado: "Regular", correlativas: "Derecho Comercial",
      horarios: [{ dia: "Jueves", inicio: "18:00", fin: "21:00" }], asistencia: { faltas: 0, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 7 }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 6 }] },
    { nombre: "Finanzas de las Organizaciones", profesor: "Lic. Roldán", aula: "Aula 203", anio: 3, color: "#2C5C8A", estado: "Cursando", correlativas: "Matemática Financiera, Estadística I",
      horarios: [{ dia: "Viernes", inicio: "10:00", fin: "13:00" }],
      asistencia: { faltas: 7, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — VAN y TIR", nota: null, fecha: plus(-1) }, { tipo: "Otro", titulo: "Presentación de cartera", nota: null, fecha: plus(15) }],
      tareas: [{ titulo: "Entregar TP de VAN y TIR", descripcion: "Subir planilla y breve informe al aula virtual.", fecha: plus(-1) }],
      notas: [{ fecha: new Date().toISOString(), texto: "El VAN compara flujos descontados contra la inversión inicial." }] },
    { nombre: "Derecho Laboral y de la Seguridad Social", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 3, color: "#6E4C8A", estado: "Cursando", correlativas: "Derecho Comercial",
      horarios: [{ dia: "Miércoles", inicio: "18:00", fin: "20:00" }],
      asistencia: { faltas: 0, inicioCursada: plus(-45), finCursada: plus(75) },
      tareas: [{ titulo: "Leer fallo CSJN asignado", fecha: plus(0) }] },

    // ---- 4to año (pendiente, todavía no empezado) ----
    { nombre: "Auditoría", profesor: "Cra. Molina", aula: "Aula 201", anio: 4, color: "#B5432E", estado: "Pendiente", correlativas: "Contabilidad Superior, Contabilidad de Costos",
      recursos: [{ tipo: "Link", nombre: "Normas de Auditoría (FACPCE)", url: "" }] },
    { nombre: "Derecho Tributario II", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 4, color: "#6E4C8A", estado: "Pendiente", correlativas: "Derecho Tributario I" },
    { nombre: "Sistemas de Costos para la Gestión", profesor: "Cra. Molina", aula: "Aula 201", anio: 4, color: "#B5432E", estado: "Pendiente", correlativas: "Contabilidad de Costos" },
    { nombre: "Concursos y Quiebras", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 4, color: "#A65A3C", estado: "Pendiente", correlativas: "Derecho Tributario I" },
    { nombre: "Seminario de Práctica Profesional", profesor: "Cra. Herrera", aula: "Aula 101", anio: 4, color: "#A65A3C", estado: "Pendiente", correlativas: "Auditoría" },
  ];

  const materias = definiciones.map((d) => ({
    id: uid(),
    nombre: d.nombre,
    profesor: d.profesor || "",
    aula: d.aula || "",
    color: d.color,
    estado: d.estado,
    anio: d.anio,
    correlativas: d.correlativas || "", // se resuelve a IDs abajo, una vez que todas ya tienen su id
    horarios: d.horarios || [],
    notas: normalizarNotasEntradas(d.notas),
    recursos: (d.recursos || []).map((r) => ({ id: uid(), url: "", archivo: "", archivoNombre: "", archivoTipo: "", ...r })),
    resumenes: (d.resumenes || []).map((r) => ({
      id: uid(),
      titulo: r.titulo,
      bloques: (r.bloques || []).map((b) => ({ id: uid(), imagen: "", ...b })),
    })),
    fechaAprobada: d.fechaAprobada || null,
    promocionada: d.promocionada || false,
    asistencia: d.asistencia || { faltas: 0, inicioCursada: "", finCursada: "" },
    examenes: (d.examenes || []).map((e) => ({ id: uid(), fecha: "", ...e })),
    tareas: (d.tareas || []).map((t) => ({ id: uid(), completada: false, subtareas: [], recurrencia: null, vecesCompletada: 0, prioridad: "Media", etiquetas: [], archivo: "", archivoNombre: "", archivoTipo: "", ...t })),
  }));

  // Ahora que todas las materias tienen su id definitivo, convertimos los
  // nombres de correlativas (como se escribieron arriba, a mano) en IDs reales.
  materias.forEach((m) => {
    m.correlativas = idsDesdeNombres(m.correlativas, materias);
  });

  return { materias };
}

/* =========================================================================
   PERSISTENCIA
   ========================================================================= */

const STORAGE_KEY = "planificador-carrera-v1";
const CALENDAR_KEY = "planificador-google-calendar-v1";
const GOOGLE_CLIENT_KEY = "planificador-google-client-id-v1";
const GOOGLE_TOKEN_KEY = "planificador-google-token-v1";
const SESIONES_KEY = "planificador-sesiones-estudio-v1";
const NOTIFICACIONES_KEY = "planificador-notificaciones-v1";
const CONFIGURACION_KEY = "planificador-configuracion-v1";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/* Adaptador de persistencia: Supabase es la fuente remota cuando las
   variables VITE_SUPABASE_* están configuradas. El almacenamiento local se
   conserva como respaldo y permite abrir la app antes de configurar el
   proyecto. */
const tieneStorageClaude = () =>
  typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

async function guardarValor(key, valor) {
  const json = JSON.stringify(valor);
  if (supabase) {
    try {
      const user = await getSupabaseUser();
      if (!user) throw new Error("No se pudo iniciar una sesión de Supabase");
      const { error } = await supabase
        .from("app_state")
        .upsert({ user_id: user.id, key, data: valor }, { onConflict: "user_id,key" });
      if (!error) {
        // Mantener una copia local permite recuperar el estado sin conexión.
        window.localStorage.setItem(key, json);
        return true;
      }
      throw error;
    } catch (e) {
      console.error("No se pudo guardar en Supabase; se usa la copia local", e);
    }
  }
  if (tieneStorageClaude()) {
    try {
      await window.storage.set(key, json, false);
      return true;
    } catch (e) {
      console.error("Fallback a localStorage tras error de window.storage", e);
    }
  }
  try {
    window.localStorage.setItem(key, json);
    return true;
  } catch (e) {
    console.error("No se pudo guardar", e);
    return false;
  }
}

async function cargarValor(key) {
  if (supabase) {
    try {
      const user = await getSupabaseUser();
      if (!user) throw new Error("No se pudo iniciar una sesión de Supabase");
      const { data, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      // Una respuesta correcta sin fila representa una cuenta nueva: no se
      // mezclan los datos locales de otra sesión o de datos de demostración.
      return data?.data || null;
    } catch (e) {
      console.error("No se pudo cargar desde Supabase; se usa la copia local", e);
    }
  }
  if (tieneStorageClaude()) {
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value) return JSON.parse(res.value);
      return null;
    } catch (e) {
      // clave inexistente u otro error: seguimos con localStorage
    }
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Migración: "notas" antes era un solo bloque de texto libre por materia.
// Ahora es una lista de entradas fechadas (mini diario). Si venía un string
// viejo guardado en storage, se convierte en la primera entrada; si ya es
// una lista, se completan los campos que puedan faltar.
function normalizarNotasEntradas(valor) {
  if (Array.isArray(valor)) {
    return valor.map((n) => ({ id: n.id || uid(), fecha: n.fecha || new Date().toISOString(), texto: n.texto || "" }));
  }
  if (typeof valor === "string" && valor.trim()) {
    return [{ id: uid(), fecha: new Date().toISOString(), texto: valor }];
  }
  return [];
}

// Convierte "Nombre A, Nombre B" en un array de IDs reales, buscando cada
// nombre dentro de una lista de materias ya generada (con sus id asignados).
function idsDesdeNombres(nombresStr, materias) {
  return (nombresStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((nombre) => materias.find((m) => m.nombre === nombre))
    .filter(Boolean)
    .map((m) => m.id);
}

// Migración: "correlativas" antes era un texto libre con nombres separados
// por coma. Ahora se eligen de una lista (selector), y se guardan como un
// array de IDs de materias reales. Si venía el string viejo, se resuelve
// por nombre; si ya es un array, se filtran los ids que ya no existan
// (por ejemplo, si esa materia se borró después).
function normalizarCorrelativas(valor, materias) {
  if (Array.isArray(valor)) {
    const idsValidos = new Set(materias.map((m) => m.id));
    return valor.filter((id) => idsValidos.has(id));
  }
  if (typeof valor === "string" && valor.trim()) {
    return idsDesdeNombres(valor, materias);
  }
  return [];
}

function useStore() {
  const [materias, setMaterias] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      const datos = await cargarValor(STORAGE_KEY);
      if (datos) {
        const base = (datos.materias || []).map((m) => ({ ...m, notas: normalizarNotasEntradas(m.notas), tareas: (m.tareas || []).map((t) => ({ prioridad: "Media", etiquetas: [], archivo: "", archivoNombre: "", archivoTipo: "", ...t })) }));
        setMaterias(base.map((m) => ({ ...m, correlativas: normalizarCorrelativas(m.correlativas, base) })));
      } else if (supabase) {
        // Cada cuenta autenticada empieza sin datos. Los ejemplos quedan solo
        // para el modo local, cuando Supabase todavía no está configurado.
        setMaterias([]);
      } else {
        const seed = seedData();
        setMaterias(seed.materias);
      }
      setCargado(true);
    })();
  }, []);

  useEffect(() => {
    if (!cargado) return;
    const t = setTimeout(async () => {
      const ok = await guardarValor(STORAGE_KEY, { materias });
      setErrorGuardado(!ok);
    }, 400);
    return () => clearTimeout(t);
  }, [materias, cargado]);

  return { materias, setMaterias, cargado, errorGuardado };
}

function useCalendarioConfig() {
  const [calendarId, setCalendarIdState] = useState("");
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    (async () => {
      const datos = await cargarValor(CALENDAR_KEY);
      if (datos && datos.calendarId) setCalendarIdState(datos.calendarId);
      setCargado(true);
    })();
  }, []);

  const setCalendarId = (id) => {
    setCalendarIdState(id);
    guardarValor(CALENDAR_KEY, { calendarId: id });
  };

  return { calendarId, setCalendarId, cargado };
}

// Guarda las sesiones de estudio completadas (timer de Focus). Mismo
// patrón que useCalendarioConfig: se cargan una vez y se persisten con
// el mismo adaptador de storage que el resto de la app.
function useSesionesEstudio() {
  const [sesiones, setSesiones] = useState([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    (async () => {
      const datos = await cargarValor(SESIONES_KEY);
      if (datos && Array.isArray(datos.sesiones)) setSesiones(datos.sesiones);
      setCargado(true);
    })();
  }, []);

  useEffect(() => {
    if (!cargado) return;
    const t = setTimeout(() => { guardarValor(SESIONES_KEY, { sesiones }); }, 400);
    return () => clearTimeout(t);
  }, [sesiones, cargado]);

  const agregarSesion = (sesion) => setSesiones((prev) => [...prev, sesion]);

  return { sesiones, agregarSesion, cargado };
}

function useGoogleClientId() {
  const [clientId, setClientIdState] = useState("");
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    (async () => {
      const datos = await cargarValor(GOOGLE_CLIENT_KEY);
      if (datos && datos.clientId) setClientIdState(datos.clientId);
      setCargado(true);
    })();
  }, []);

  const setClientId = (id) => {
    setClientIdState(id);
    guardarValor(GOOGLE_CLIENT_KEY, { clientId: id });
  };

  return { clientId, setClientId, cargado };
}

/* Adaptador de autenticación con Google. Tiene dos modos:
   - Con Supabase configurado (usaBackend=true): usa el flujo de "código de
     autorización" de Google. El código se canjea en la Edge Function
     "google-calendar", que guarda el refresh token del lado del servidor y
     lo usa para conseguir access tokens nuevos sin depender del navegador.
     Con esto, conectar una vez alcanza para siempre (hasta que el usuario
     mismo desconecte la cuenta).
   - Sin Supabase (usaBackend=false): como no hay backend para guardar un
     refresh token de forma segura, se usa el flujo implícito de antes
     (access token de ~1 hora, cacheado en el storage local del navegador y
     renovado en silencio mientras Google recuerde la sesión). */
function useGoogleAuth(clientId) {
  const usaBackend = !!supabase;
  const [accessToken, setAccessTokenState] = useState(null);
  const [tokenExpiraEn, setTokenExpiraEn] = useState(0); // epoch ms
  const [tokenListo, setTokenListo] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [errorAuth, setErrorAuth] = useState("");
  const [scriptListo, setScriptListo] = useState(
    typeof window !== "undefined" && !!window.google?.accounts?.oauth2
  );
  const codeClientRef = useRef(null); // modo con backend (código de autorización)
  const tokenClientRef = useRef(null); // modo sin backend (implícito, de respaldo)
  const intentoSilenciosoRef = useRef(false);
  const solicitudManualRef = useRef(false);

  // Solo se usa en el modo sin backend: cachea el access token en el
  // storage local del navegador para reutilizarlo entre recargas.
  const guardarTokenLocal = (token, expiresInSeg) => {
    const expiraEn = Date.now() + (Number(expiresInSeg) || 3600) * 1000;
    setAccessTokenState(token);
    setTokenExpiraEn(expiraEn);
    guardarValor(GOOGLE_TOKEN_KEY, { accessToken: token, expiraEn });
  };

  // Carga inicial: con backend, le pide un access token nuevo a la Edge
  // Function usando el refresh token guardado (no depende del navegador).
  // Sin backend, recupera el último access token cacheado si todavía es
  // válido (con 2 minutos de margen).
  useEffect(() => {
    (async () => {
      if (usaBackend) {
        try {
          const datos = await invocarGoogleCalendarAuth("refresh");
          if (datos?.accessToken) {
            setAccessTokenState(datos.accessToken);
            setTokenExpiraEn(Date.now() + (Number(datos.expiresIn) || 3600) * 1000);
          }
        } catch (e) {
          // Todavía no hay una conexión guardada, o la Edge Function no está
          // desplegada: se sigue igual, mostrando el botón de conexión.
        }
      } else {
        const datos = await cargarValor(GOOGLE_TOKEN_KEY);
        if (datos?.accessToken && datos.expiraEn > Date.now() + 120000) {
          setAccessTokenState(datos.accessToken);
          setTokenExpiraEn(datos.expiraEn);
        }
      }
      setTokenListo(true);
    })();
  }, [usaBackend]);

  useEffect(() => {
    if (scriptListo || typeof window === "undefined") return;
    const yaExiste = document.querySelector('script[data-google-identity="1"]');
    if (yaExiste) {
      yaExiste.addEventListener("load", () => setScriptListo(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "1";
    script.onload = () => setScriptListo(true);
    script.onerror = () => setErrorAuth("No se pudo cargar el script de autenticación de Google.");
    document.head.appendChild(script);
  }, [scriptListo]);

  // Modo con backend: inicializa el cliente de "código de autorización".
  useEffect(() => {
    if (!usaBackend || !scriptListo || !clientId || !window.google?.accounts?.oauth2) return;
    codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      ux_mode: "popup",
      callback: async (resp) => {
        if (resp.error) {
          setConectando(false);
          setErrorAuth("No se pudo conectar con Google (" + resp.error + ").");
          return;
        }
        try {
          const datos = await invocarGoogleCalendarAuth("exchange-code", {
            code: resp.code,
            origin: window.location.origin,
          });
          if (datos?.error) throw new Error(datos.error);
          setAccessTokenState(datos.accessToken);
          setTokenExpiraEn(Date.now() + (Number(datos.expiresIn) || 3600) * 1000);
          setErrorAuth("");
        } catch (e) {
          setErrorAuth("No se pudo completar la conexión con Google (" + (e.message || e) + ").");
        } finally {
          setConectando(false);
        }
      },
    });
  }, [usaBackend, scriptListo, clientId]);

  // Modo sin backend: inicializa el cliente implícito de siempre.
  useEffect(() => {
    if (usaBackend || !scriptListo || !clientId || !window.google?.accounts?.oauth2) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (resp) => {
        setConectando(false);
        if (resp.error) {
          if (solicitudManualRef.current) setErrorAuth("No se pudo conectar con Google (" + resp.error + ").");
          solicitudManualRef.current = false;
          return;
        }
        guardarTokenLocal(resp.access_token, resp.expires_in);
        setErrorAuth("");
        solicitudManualRef.current = false;
      },
    });
  }, [usaBackend, scriptListo, clientId]);

  // Intento silencioso inicial: solo aplica al modo sin backend (el modo
  // con backend ya resuelve esto llamando a "refresh" al montar, arriba).
  useEffect(() => {
    if (usaBackend) return;
    if (!tokenClientRef.current || intentoSilenciosoRef.current) return;
    intentoSilenciosoRef.current = true;
    tokenClientRef.current.requestAccessToken({ prompt: "none" });
  }, [usaBackend, scriptListo, clientId]);

  // Renovación automática en segundo plano, 5 minutos antes de que venza el
  // token, para no depender de que el usuario recargue la página.
  useEffect(() => {
    if (!accessToken || !tokenExpiraEn) return;
    const margen = 5 * 60 * 1000;
    const demora = Math.max(tokenExpiraEn - Date.now() - margen, 5000);
    const timer = setTimeout(async () => {
      if (usaBackend) {
        try {
          const datos = await invocarGoogleCalendarAuth("refresh");
          if (datos?.accessToken) {
            setAccessTokenState(datos.accessToken);
            setTokenExpiraEn(Date.now() + (Number(datos.expiresIn) || 3600) * 1000);
          }
        } catch (e) { /* se reintenta en la próxima carga o renovación */ }
      } else {
        tokenClientRef.current?.requestAccessToken({ prompt: "none" });
      }
    }, demora);
    return () => clearTimeout(timer);
  }, [accessToken, tokenExpiraEn, usaBackend]);

  const conectar = () => {
    setErrorAuth("");
    if (usaBackend) {
      if (!codeClientRef.current) {
        setErrorAuth("Todavía se está preparando la conexión con Google. Esperá un segundo y probá de nuevo.");
        return;
      }
      setConectando(true);
      codeClientRef.current.requestCode();
    } else {
      if (!tokenClientRef.current) {
        setErrorAuth("Todavía se está preparando la conexión con Google. Esperá un segundo y probá de nuevo.");
        return;
      }
      setConectando(true);
      solicitudManualRef.current = true;
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    }
  };

  const desconectar = async () => {
    if (usaBackend) {
      try { await invocarGoogleCalendarAuth("disconnect"); } catch (e) { /* se limpia igual del lado del cliente */ }
    } else if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    setAccessTokenState(null);
    setTokenExpiraEn(0);
    if (!usaBackend) guardarValor(GOOGLE_TOKEN_KEY, { accessToken: null, expiraEn: 0 });
  };

  return { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo, tokenListo, usaBackend };
}


// Algunas tablets con teclado/trackpad informan un viewport y un puntero de
// escritorio. Reconocemos el dispositivo táctil para no aplicarles por error
// la interfaz de PC completa ni el scroll interno de escritorio.
function useEsTablet() {
  const detectar = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const esChromeOS = /CrOS/i.test(ua);
    const esSistemaTablet = /Android|iPad|Tablet|Silk|Kindle/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const ladoMenor = Math.min(window.innerWidth, window.innerHeight);
    // ChromeOS puede no exponer touch points aunque se esté usando como
    // tablet con teclado/trackpad (como en este caso).
    return ladoMenor >= 600 && (esChromeOS || (esSistemaTablet && navigator.maxTouchPoints > 0));
  };
  const [esTablet, setEsTablet] = useState(detectar);

  useEffect(() => {
    const actualizar = () => setEsTablet(detectar());
    window.addEventListener("resize", actualizar);
    window.addEventListener("orientationchange", actualizar);
    return () => {
      window.removeEventListener("resize", actualizar);
      window.removeEventListener("orientationchange", actualizar);
    };
  }, []);

  return esTablet;
}

/* ---------- Llamadas a la API de Google Calendar ---------- */

async function extraerErrorApi(res) {
  try {
    const data = await res.json();
    return data.error?.message || "Error desconocido";
  } catch (e) {
    return "Error desconocido";
  }
}

async function apiListarEventos(accessToken, calendarId) {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: "10",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(await extraerErrorApi(res));
  const data = await res.json();
  return data.items || [];
}

async function apiListarEventosRango(accessToken, calendarId, timeMinISO, timeMaxISO) {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    maxResults: "250",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(await extraerErrorApi(res));
  const data = await res.json();
  return data.items || [];
}

async function apiCrearEvento(accessToken, calendarId, evento) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    }
  );
  if (!res.ok) throw new Error(await extraerErrorApi(res));
  return res.json();
}

async function apiActualizarEvento(accessToken, calendarId, eventId, evento) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    }
  );
  if (!res.ok) throw new Error(await extraerErrorApi(res));
  return res.json();
}

async function apiEliminarEvento(accessToken, calendarId, eventId) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 410) throw new Error(await extraerErrorApi(res));
}

/* =========================================================================
   PIEZAS CHICAS DE UI
   ========================================================================= */

// Ícono lineal y compacto para mantener el mismo lenguaje visual del resto
// de la navegación.
function IconTomate({ size = 16, className = "" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M12 7.5c-3.9-2.9-7.5-.2-7.5 4.5 0 4.1 3.2 7.5 7.5 7.5s7.5-3.4 7.5-7.5c0-4.7-3.6-7.4-7.5-4.5Z" />
      <path d="M12 7.5V4.3M12 4.3c1.1-1.1 2.5-1.4 3.8-1M12 4.3c-1.1-1.1-2.5-1.4-3.8-1" />
    </svg>
  );
}

function IconBtn({ icon: Icon, onClick, title, danger, size = 16 }) {
  return (
    <button
      type="button"
      className={`icon-btn ${danger ? "icon-btn-danger" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  );
}

/* Festejo chico al aprobar una materia: una lluvia breve de papelitos de
   colores, en CSS puro (sin librerías externas). Se desmonta solo. */
function Confetti({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), 2100);
    return () => clearTimeout(t);
  }, [onDone]);

  const piezas = useMemo(() => {
    return Array.from({ length: 78 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.48,
      duration: 1.15 + Math.random() * 0.8,
      rot: Math.round(Math.random() * 360),
      drift: Math.round((Math.random() - 0.5) * 190),
      color: COLORES[i % COLORES.length].hex,
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 6,
    }));
  }, []);

  return (
    <div className="confetti-wrap" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.id}
          className="confetti-pieza"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.h,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--rot": `${p.rot}deg`,
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-card ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <IconBtn icon={X} onClick={onClose} title="Cerrar" />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Fallback único para trackpads en Android/Chrome: algunos no trasladan la
// rueda a paneles fijos o modales. Busca el primer ancestro desplazable y lo
// mueve explícitamente, preservando el scroll táctil y los scrolls anidados.
function useTrackpadScrollFallback() {
  useEffect(() => {
    const manejarRueda = (event) => {
      if (!event.deltaY || event.ctrlKey) return;
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = event.deltaY * factor;
      let elemento = event.target instanceof Element ? event.target : null;
      while (elemento && elemento !== document.documentElement) {
        const estilo = window.getComputedStyle(elemento);
        const puedeDesplazar = /auto|scroll/.test(estilo.overflowY) && elemento.scrollHeight > elemento.clientHeight + 1;
        if (puedeDesplazar) {
          const maximo = elemento.scrollHeight - elemento.clientHeight;
          const siguiente = Math.max(0, Math.min(maximo, elemento.scrollTop + delta));
          if (siguiente !== elemento.scrollTop) {
            event.preventDefault();
            elemento.scrollTop = siguiente;
            return;
          }
        }
        elemento = elemento.parentElement;
      }
    };
    document.addEventListener("wheel", manejarRueda, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", manejarRueda, true);
  }, []);
}

function hexToHsv(hex) {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((n) => Math.round((n + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function ColorPicker({ value, onChange }) {
  const pickerRef = useRef(null);
  const { h, s, v } = hexToHsv(value);
  const setHsv = (nextH = h, nextS = s, nextV = v) => onChange(hsvToHex(nextH, nextS, nextV));
  const pickSV = (event) => {
    const bounds = pickerRef.current.getBoundingClientRect();
    const nextS = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const nextV = Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height));
    setHsv(h, nextS, nextV);
  };
  const pickHue = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setHsv(Math.min(359, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 360)));
  };
  const updateHex = (next) => {
    const normalized = next.trim().replace(/^#?/, "#").toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized);
  };

  return (
    <div className="color-picker" aria-label="Selector de color">
      <div ref={pickerRef} className="color-spectrum" style={{ "--hue": `hsl(${h} 100% 50%)`, "--x": `${s * 100}%`, "--y": `${(1 - v) * 100}%` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pickSV(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pickSV(event); }}><span className="color-spectrum-thumb" /></div>
      <div className="color-hue" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pickHue(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pickHue(event); }}><span style={{ left: `${(h / 360) * 100}%` }} /></div>
      <div className="color-picker-footer">
        <span className="color-current" style={{ background: value }} aria-hidden="true" />
        <input className="color-hex-input" value={value} onChange={(event) => updateHex(event.target.value)} aria-label="Código hexadecimal" spellCheck="false" maxLength="7" />
        <label className="color-native-input" title="Elegir color">◉<input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label="Abrir selector nativo" /></label>
      </div>
      <div className="color-preset-row" aria-label="Colores sugeridos">
        {COLORES.map((c) => <button key={c.hex} type="button" className={`color-swatch ${value === c.hex ? "color-swatch-active" : ""}`} style={{ background: c.hex }} title={c.nombre} aria-label={c.nombre} onClick={() => onChange(c.hex)} />)}
      </div>
    </div>
  );
}

/* =========================================================================
   SIDEBAR
   ========================================================================= */

const CATEGORIAS_BUSQUEDA = [
  { id: "todo", label: "Todo" },
  { id: "materias", label: "Materias" },
  { id: "resumenes", label: "Resúmenes" },
  { id: "notas", label: "Notas" },
  { id: "tareas", label: "Tareas" },
  { id: "examenes", label: "Exámenes" },
  { id: "recursos", label: "Recursos" },
];
const CATEGORIA_BUSQUEDA_COLOR = {
  todo: "#8A6F34",
  materias: "#2C5C8A",
  resumenes: "#A487D9",
  notas: "#DDBB5E",
  tareas: "#E5A164",
  examenes: "#C63637",
  recursos: "#4FBA88",
};

function resultadosBusqueda(materias, termino, categoria) {
  const q = normalizarTexto(termino);
  if (!q) return [];
  const coincide = (...campos) => normalizarTexto(campos.filter(Boolean).join(" ")).includes(q);
  const incluir = (tipo) => categoria === "todo" || categoria === tipo;
  const resultados = [];
  materias.forEach((m) => {
    if (incluir("materias") && coincide(m.nombre, m.profesor, m.aula, m.estado)) resultados.push({ id: `m-${m.id}`, tipo: "materias", titulo: m.nombre, detalle: `${m.profesor || "Sin docente"} · ${m.estado}`, materia: m, tab: "inicio" });
    if (incluir("resumenes")) (m.resumenes || []).forEach((r) => {
      const contenido = (r.bloques || []).map((b) => `${b.titulo || ""} ${b.texto || ""}`).join(" ");
      if (coincide(r.titulo, contenido)) resultados.push({ id: `r-${r.id}`, tipo: "resumenes", titulo: r.titulo || "Resumen sin título", detalle: m.nombre, materia: m, tab: "resumenes" });
    });
    if (incluir("notas")) (m.notas || []).forEach((n) => {
      if (coincide(n.texto)) resultados.push({ id: `n-${n.id}`, tipo: "notas", titulo: n.texto.slice(0, 100) || "Nota vacía", detalle: `${m.nombre} · ${fmtFechaHoraNota(n.fecha)}`, materia: m, tab: "info" });
    });
    if (incluir("tareas")) (m.tareas || []).forEach((t) => {
      if (coincide(t.titulo, t.descripcion)) resultados.push({ id: `t-${t.id}`, tipo: "tareas", titulo: t.titulo, detalle: `${m.nombre}${t.fecha ? ` · ${textoUrgencia(t.fecha)}` : ""}`, materia: m, tab: "tareas" });
    });
    if (incluir("examenes")) (m.examenes || []).forEach((e) => {
      if (coincide(e.titulo, e.tipo, e.fecha)) resultados.push({ id: `e-${e.id}`, tipo: "examenes", titulo: e.titulo || e.tipo, detalle: `${m.nombre} · ${e.tipo}${e.fecha ? ` · ${fmtFechaCorta(e.fecha)}` : ""}`, materia: m, tab: "examenes" });
    });
    if (incluir("recursos")) (m.recursos || []).forEach((r) => {
      if (coincide(r.nombre, r.tipo, r.url, r.archivoNombre)) resultados.push({ id: `rec-${r.id}`, tipo: "recursos", titulo: r.nombre || "Recurso sin nombre", detalle: `${m.nombre} · ${r.tipo || "Recurso"}`, materia: m, tab: "recursos" });
    });
  });
  return resultados.slice(0, 30);
}

function BusquedaGlobal({ materias, onAbrir, onClose }) {
  const [termino, setTermino] = useState("");
  const [categoria, setCategoria] = useState("todo");
  const [categoriaMenuAbierto, setCategoriaMenuAbierto] = useState(false);
  const inputRef = useRef(null);
  const resultados = useMemo(() => resultadosBusqueda(materias, termino, categoria), [materias, termino, categoria]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const cerrar = (e) => { if (e.key === "Escape") { categoriaMenuAbierto ? setCategoriaMenuAbierto(false) : onClose(); } };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onClose, categoriaMenuAbierto]);
  const categoriaActual = CATEGORIAS_BUSQUEDA.find((c) => c.id === categoria);
  return <div className="busqueda-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="busqueda-global" role="dialog" aria-modal="true" aria-label="Búsqueda global">
      <div className="busqueda-global-input">
        <Search size={20} />
        <input ref={inputRef} value={termino} onChange={(e) => setTermino(e.target.value)} placeholder="Buscar en todas las materias…" />
        <span className="busqueda-selector">
          <button type="button" className="busqueda-selector-btn" onClick={() => setCategoriaMenuAbierto((v) => !v)} aria-haspopup="true" aria-expanded={categoriaMenuAbierto}>
            <span className="busqueda-selector-dot" style={{ background: CATEGORIA_BUSQUEDA_COLOR[categoria] }} />
            {categoria === "todo" ? "Todo" : `en ${categoriaActual.label.toLowerCase()}`}
            <ChevronDown size={15} />
          </button>
          {categoriaMenuAbierto && (
            <>
              <div className="fila-menu-backdrop" onClick={() => setCategoriaMenuAbierto(false)} />
              <div className="fila-menu-pop busqueda-categoria-pop">
                <p className="fila-menu-label">Categoría</p>
                {CATEGORIAS_BUSQUEDA.map((c) => (
                  <button key={c.id} className={c.id === categoria ? "activo" : ""} onClick={() => { setCategoria(c.id); setCategoriaMenuAbierto(false); }}>
                    <span className="fila-menu-dot" style={{ background: CATEGORIA_BUSQUEDA_COLOR[c.id] }} /> {c.label}
                    {c.id === categoria && <Check size={13} className="busqueda-categoria-check" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </span>
        <kbd>Esc</kbd>
      </div>
      {termino.trim() && <div className="busqueda-resultados">
        {resultados.length === 0 ? <p className="muted">No encontramos resultados para “{termino}”.</p> : resultados.map((r) => <button key={r.id} className="busqueda-resultado" onClick={() => onAbrir(r.materia.id, r.tab)}><span className="busqueda-tipo">{CATEGORIAS_BUSQUEDA.find((c) => c.id === r.tipo)?.label.slice(0, -1) || "Materia"}</span><span><strong>{r.titulo}</strong><small>{r.detalle}</small></span><ChevronRight size={16} /></button>)}
      </div>}
    </div>
  </div>;
}

function Sidebar({ view, setView, materias, onBuscar }) {
  const total = materias.length;
  const aprobadas = materias.filter((m) => m.estado === "Aprobada").length;
  const pct = total ? Math.round((aprobadas / total) * 100) : 0;

  const items = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "materias", label: "Materias", icon: BookOpen },
    { id: "focus", label: "Pomodoro", icon: IconTomate },
    { id: "calendario", label: "Calendario", icon: CalendarIcon },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <GraduationCap size={22} strokeWidth={2} />
        <span>Cursada</span>
      </div>
      <div className="sidebar-nav">
        <button className="sidebar-item sidebar-buscar" onClick={onBuscar} title="Buscar en todo"><Search size={18} /><span>Buscar</span></button>
        {items.map((it) => (
          <button
            key={it.id}
            className={`sidebar-item ${view === it.id ? "sidebar-item-active" : ""}`}
            onClick={() => setView(it.id)}
            title={it.label}
            aria-label={it.label}
          >
            <it.icon size={18} strokeWidth={2} />
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-carne">
        <svg viewBox="0 0 44 44" className="ring">
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r="18" fill="none" stroke="var(--ochre)" strokeWidth="4"
            strokeDasharray={`${(pct / 100) * 113.1} 113.1`}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
        </svg>
        <div className="sidebar-carne-text">
          <strong>{pct}%</strong>
          <span>{aprobadas} de {total} aprobadas</span>
        </div>
      </div>
      <button className={`sidebar-tema ${view === "configuracion" ? "sidebar-item-active" : ""}`} onClick={() => setView("configuracion")}>
        <Settings size={13} /> Configuración
      </button>
    </nav>
  );
}

/* =========================================================================
   INICIO
   ========================================================================= */

function PlanDeEstudio({ materias, abrirMateria }) {
  const sugerencias = useMemo(() => materias.map((m) => {
    const tareas = (m.tareas || []).filter((t) => !t.completada);
    const examenes = (m.examenes || []).filter((e) => e.fecha && diffDias(e.fecha) >= 0);
    const proximo = [...tareas, ...examenes].filter((x) => x.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const urgencia = proximo ? Math.max(0, 8 - Math.min(8, diffDias(proximo.fecha))) : 0;
    const alta = tareas.filter((t) => t.prioridad === "Alta").length;
    const score = urgencia * 2 + alta * 3 + tareas.length;
    return { materia: m, proximo, minutos: score >= 12 ? 90 : score >= 6 ? 60 : 30, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3), [materias]);
  if (!sugerencias.length) return null;
  return <section className="panel plan-estudio"><div className="panel-pendientes-head"><h2>Plan de estudio sugerido</h2><span className="panel-pendientes-contador">Hoy</span></div><p className="muted">Priorizado por fecha, tareas pendientes y prioridad.</p><div className="plan-estudio-lista">{sugerencias.map((s) => <button key={s.materia.id} onClick={() => abrirMateria(s.materia.id, s.proximo?.tipo ? "examenes" : "tareas")}><span style={{ background: s.materia.color }} /><div><strong>{s.materia.nombre}</strong><small>{s.proximo ? `${s.proximo.titulo} · ${textoUrgencia(s.proximo.fecha)}` : "Repaso y avance"}</small></div><b>{s.minutos} min</b></button>)}</div></section>;
}

function Inicio({ materias, setView, abrirMateria, onCompletarTarea, asistenciaMinima }) {
  const MAX_PENDIENTES_VISIBLE = 5;
  const [pendientesExpandido, setPendientesExpandido] = useState(false);
  const pendientesOrdenadas = useMemo(() => {
    const todas = materias.flatMap((m) => (m.tareas || []).filter((t) => !t.completada).map((t) => ({ ...t, materia: m })));
    return todas.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha < b.fecha ? -1 : 1;
    });
  }, [materias]);
  const pendientesVisibles = pendientesExpandido ? pendientesOrdenadas : pendientesOrdenadas.slice(0, MAX_PENDIENTES_VISIBLE);

  const examenesProximos = useMemo(() => {
    const hoy = toDateStr(new Date());
    const todos = materias.flatMap((m) => (m.examenes || []).filter((e) => e.fecha).map((e) => ({ ...e, materia: m })));
    return todos.filter((e) => e.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }, [materias]);

  // Materias que estás cursando y a las que ya casi se les acaban las faltas
  // permitidas (1 o 2 disponibles) — se avisa sola, sin que haya que ir a
  // buscarlo a la pestaña de Asistencia de cada materia.
  const materiasFaltasRiesgo = useMemo(() => {
    return materias
      .filter((m) => m.estado === "Cursando")
      .map((m) => {
        const a = m.asistencia || { faltas: 0, inicioCursada: "", finCursada: "" };
        const total = contarClasesEnRango(m.horarios, a.inicioCursada, a.finCursada);
        if (total === null) return null;
        const max = Math.floor(total * (1 - asistenciaMinima / 100));
        const disponibles = max - (a.faltas || 0);
        return disponibles === 1 || disponibles === 2 ? { materia: m, disponibles } : null;
      })
      .filter(Boolean);
  }, [materias, asistenciaMinima]);

  const nombreDiaHoy = DIAS[(new Date().getDay() + 6) % 7]; // domingo=6, fuera de rango si es finde
  const claseHoy = DIAS.includes(nombreDiaHoy);

  const clasesDeHoy = useMemo(() => {
    if (!claseHoy) return [];
    const filas = [];
    materias.forEach((m) => {
      m.horarios.forEach((h) => {
        if (h.dia === nombreDiaHoy) filas.push({ materia: m, ...h });
      });
    });
    return filas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [materias, nombreDiaHoy, claseHoy]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Panel general</p>
          <h1>Tu cursada, de un vistazo</h1>
        </div>
      </header>

      <div className="dos-columnas">
        <div className="columna-izquierda">
          {pendientesOrdenadas.length > 0 && (
            <section className="panel panel-pendientes-grande">
              <div className="panel-pendientes-head">
                <h2>Pendientes</h2>
                <span className="panel-pendientes-contador">{pendientesOrdenadas.length}</span>
              </div>
              <ul className="lista-pendientes-grande">
                {pendientesVisibles.map((t) => (
                  <li key={t.id} className={`pendiente-fila-grande pendiente-${nivelUrgencia(t.fecha)}`}>
                    <button className="tarea-check" onClick={() => onCompletarTarea(t.materia.id, t.id)} title="Marcar como hecha">
                      <Square size={19} />
                    </button>
                    <div className="pendiente-texto-grande" onClick={() => abrirMateria(t.materia.id)}>
                      <strong>{t.titulo}</strong>
                      <span className="muted">{t.materia.nombre}</span>
                    </div>
                    <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(t.fecha)}`}>{textoUrgencia(t.fecha)}</span>
                  </li>
                ))}
              </ul>
              {pendientesOrdenadas.length > MAX_PENDIENTES_VISIBLE && (
                <button className="link-btn" onClick={() => setPendientesExpandido((v) => !v)}>
                  {pendientesExpandido ? "Ver menos" : `Ver las ${pendientesOrdenadas.length} pendientes →`}
                </button>
              )}
            </section>
          )}

          <section className="panel panel-pendientes-grande panel-examenes-grande">
            <div className="panel-pendientes-head">
              <h2>Próximos exámenes</h2>
              {examenesProximos.length > 0 && <span className="panel-pendientes-contador panel-examenes-contador">{examenesProximos.length}</span>}
            </div>
            {examenesProximos.length === 0 ? (
              <p className="muted">No tenés exámenes con fecha cargada próximamente.</p>
            ) : (
              <ul className="lista-pendientes-grande">
                {examenesProximos.map((e) => (
                  <li key={e.id} className={`pendiente-fila-grande pendiente-${nivelUrgencia(e.fecha)}`}>
                    <span className="chip-tipo" style={{ "--tc": TIPO_EXAMEN_COLOR[e.tipo] }}>{e.tipo}</span>
                    <div className="pendiente-texto-grande" onClick={() => abrirMateria(e.materia.id)}>
                      <strong>{e.titulo}</strong>
                      <span className="muted">{e.materia.nombre}</span>
                    </div>
                    <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(e.fecha)}`}>{textoUrgencia(e.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="columna-derecha">
          <section className="panel">
            <h2>{claseHoy ? `Hoy, ${nombreDiaHoy}` : "Hoy"}</h2>
            {!claseHoy && <p className="muted">Es fin de semana, no tenés cursada.</p>}
            {claseHoy && clasesDeHoy.length === 0 && <p className="muted">No tenés clases cargadas para hoy.</p>}
            <ul className="lista-eventos">
              {clasesDeHoy.map((c, i) => (
                <li key={i} className="evento-fila" onClick={() => abrirMateria(c.materia.id)}>
                  <span className="evento-tipo-dot" style={{ background: c.materia.color }} />
                  <div className="evento-fila-texto">
                    <strong>{c.materia.nombre}</strong>
                    <span className="muted">{c.inicio}–{c.fin}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button className="link-btn" onClick={() => setView("calendario")}>Ver tu Google Calendar →</button>
          </section>

          <section className="panel">
            <h2>Materias en curso</h2>
            <ul className="lista-materias-mini">
              {materias.filter((m) => m.estado === "Cursando").map((m) => (
                <li key={m.id} onClick={() => abrirMateria(m.id)}>
                  <span className="tab-color" style={{ background: m.color }} />
                  <div className="lista-materias-texto">
                    <strong>{m.nombre}</strong>
                    <span className="muted">{m.horarios.map((h) => h.dia.slice(0, 2)).join(" · ") || "Sin horario"}</span>
                  </div>
                </li>
              ))}
              {materias.filter((m) => m.estado === "Cursando").length === 0 && (
                <p className="muted">No estás cursando ninguna materia por ahora.</p>
              )}
            </ul>
            <button className="link-btn" onClick={() => setView("materias")}>Ver todas las materias →</button>
          </section>

          {materiasFaltasRiesgo.length > 0 && (
            <section className="panel panel-pendientes-grande panel-faltas-alerta">
              <div className="panel-pendientes-head">
                <h2>Atento a tus faltas</h2>
                <span className="panel-pendientes-contador panel-faltas-contador">{materiasFaltasRiesgo.length}</span>
              </div>
              <ul className="lista-pendientes-grande">
                {materiasFaltasRiesgo.map(({ materia: m, disponibles }) => (
                  <li key={m.id} className="pendiente-fila-grande">
                    <span className="fila-dot" style={{ background: m.color }} />
                    <div className="pendiente-texto-grande" onClick={() => abrirMateria(m.id)}>
                      <strong>{m.nombre}</strong>
                      <span className="muted">
                        Te queda{disponibles === 1 ? "" : "n"} {disponibles} {disponibles === 1 ? "falta disponible" : "faltas disponibles"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MATERIAS
   ========================================================================= */

// Devuelve las materias-requisito (objetos completos) que todavía no están
// Aprobadas. Un array vacío significa "correlativas cumplidas / habilitada".
function calcularCorrelativasPendientes(m, materias) {
  return (m.correlativas || [])
    .map((id) => materias.find((x) => x.id === id))
    .filter((req) => req && req.estado !== "Aprobada");
}

function calcularPromedio(examenes) {
  const notas = (examenes || []).map((e) => e.nota).filter((n) => n !== null && n !== undefined && n !== "");
  if (notas.length === 0) return null;
  const suma = notas.reduce((acc, n) => acc + Number(n), 0);
  return suma / notas.length;
}

/* Cuenta cuántas clases hay entre dos fechas, según los días de la semana
   en que se dicta la materia (a partir de sus horarios). Si un horario se
   repite dos veces por semana (ej: Lunes y Miércoles), cuenta las dos. */
function contarClasesEnRango(horarios, inicioStr, finStr) {
  if (!inicioStr || !finStr || !horarios || horarios.length === 0) return null;
  const inicio = fromDateStr(inicioStr);
  const fin = fromDateStr(finStr);
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);
  if (fin < inicio) return null;

  let total = 0;
  horarios.forEach((h) => {
    const diaIdx = DIAS.indexOf(h.dia); // 0=Lunes … 4=Viernes
    if (diaIdx === -1) return;
    const cur = new Date(inicio);
    while (((cur.getDay() + 6) % 7) !== diaIdx) cur.setDate(cur.getDate() + 1);
    while (cur <= fin) {
      total++;
      cur.setDate(cur.getDate() + 7);
    }
  });
  return total;
}

function calcularAsistenciaPct(asistencia, horarios) {
  const a = asistencia || { faltas: 0, inicioCursada: "", finCursada: "" };
  const total = contarClasesEnRango(horarios, a.inicioCursada, a.finCursada);
  if (!total) return null;
  const pct = ((total - (a.faltas || 0)) / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Busca, entre los horarios de una materia, cuál es la próxima clase que
// toca (hoy si todavía no pasó la hora, si no el próximo día que corresponda
// en la semana que viene). Devuelve el horario encontrado más "distanciaDias"
// (0 = hoy, 1 = mañana, etc.) para poder mostrarlo lindo.
function proximaClaseDeMateria(horarios) {
  if (!horarios || horarios.length === 0) return null;
  const ahora = new Date();
  const diaActualIdx = (ahora.getDay() + 6) % 7; // 0=Lunes … 4=Viernes
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
  let mejor = null;
  let mejorClave = Infinity;
  horarios.forEach((h) => {
    const diaIdx = DIAS.indexOf(h.dia);
    if (diaIdx === -1 || !h.inicio) return;
    const [hh, mm] = h.inicio.split(":").map(Number);
    const minutosInicio = hh * 60 + (mm || 0);
    let distanciaDias = (diaIdx - diaActualIdx + 7) % 7;
    if (distanciaDias === 0 && minutosInicio <= minutosActuales) distanciaDias = 7; // ya pasó hoy
    const clave = distanciaDias * 1440 + minutosInicio;
    if (clave < mejorClave) {
      mejorClave = clave;
      mejor = { ...h, distanciaDias };
    }
  });
  return mejor;
}

// % de días transcurridos del período de cursada, para una barrita de avance.
function progresoCursada(inicioStr, finStr) {
  if (!inicioStr || !finStr) return null;
  const inicio = fromDateStr(inicioStr).getTime();
  const fin = fromDateStr(finStr).getTime();
  if (fin <= inicio) return null;
  const pct = ((Date.now() - inicio) / (fin - inicio)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/* =========================================================================
   SINCRONIZACIÓN AUTOMÁTICA CON GOOGLE CALENDAR
   (horarios de cursada y fechas de examen -> eventos de Google Calendar)
   ========================================================================= */

const DIA_ISO = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5 };
const DIA_RRULE_BYDAY = { "Lunes": "MO", "Martes": "TU", "Miércoles": "WE", "Jueves": "TH", "Viernes": "FR" };

// Primer día (a partir de "desde", inclusive) que cae en el nombre de día
// pedido — para calcular la fecha de la primera clase de una materia.
function primeraOcurrencia(desdeStr, diaNombre) {
  const objetivo = DIA_ISO[diaNombre];
  if (!objetivo || !desdeStr) return null;
  const d = fromDateStr(desdeStr);
  const actual = d.getDay() === 0 ? 7 : d.getDay(); // ISO: lunes=1 … domingo=7
  let delta = objetivo - actual;
  if (delta < 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return d;
}

// Arma el "resource" de Google Calendar para la clase recurrente de un
// horario de una materia (un evento semanal por cada horario cargado).
function eventoRecurrenteHorario(materia, horario, inicioCursada, finCursada) {
  const primerDia = primeraOcurrencia(inicioCursada, horario.dia);
  if (!primerDia || !horario.inicio || !horario.fin) return null;
  const fechaStr = toDateStr(primerDia);
  const byday = DIA_RRULE_BYDAY[horario.dia];
  const evento = {
    summary: materia.nombre,
    location: materia.aula || undefined,
    start: { dateTime: `${fechaStr}T${horario.inicio}:00`, timeZone: "America/Argentina/Buenos_Aires" },
    end: { dateTime: `${fechaStr}T${horario.fin}:00`, timeZone: "America/Argentina/Buenos_Aires" },
    extendedProperties: { private: { origenApp: "planificador-carrera", tipo: "horario-materia", materiaId: materia.id } },
  };
  if (byday) {
    evento.recurrence = finCursada
      ? [`RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${finCursada.replace(/-/g, "")}T235959Z`]
      : [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`];
  }
  return evento;
}

// Arma el "resource" de Google Calendar para un examen (evento de todo el
// día, en la fecha cargada).
function eventoDeExamen(materia, examen) {
  if (!examen.fecha) return null;
  const siguienteDia = toDateStr(new Date(fromDateStr(examen.fecha).getTime() + 86400000));
  return {
    summary: `${examen.tipo}: ${materia.nombre}`,
    description: examen.titulo || undefined,
    start: { date: examen.fecha },
    end: { date: siguienteDia },
    extendedProperties: { private: { origenApp: "planificador-carrera", tipo: "examen-materia", materiaId: materia.id, examenId: examen.id } },
  };
}

// Compara los horarios "antes" y "después" de guardar una materia y crea,
// actualiza o borra en Google Calendar lo que corresponda, devolviendo la
// materia con el googleEventId de cada horario ya guardado adentro. Si no
// hay conexión con Google, devuelve la materia sin tocar nada (silencioso).
async function sincronizarHorariosConCalendario(googleCal, materiaAnterior, materiaNueva) {
  const { accessToken, calendarId } = googleCal || {};
  if (!accessToken || !calendarId) return materiaNueva;

  const asistencia = materiaNueva.asistencia || {};
  const { inicioCursada, finCursada } = asistencia;
  const asistenciaAnterior = materiaAnterior?.asistencia || {};
  const fechasCambiaron = asistenciaAnterior.inicioCursada !== inicioCursada || asistenciaAnterior.finCursada !== finCursada;

  // Cada horario necesita un id propio y estable para poder saber, entre
  // guardado y guardado, cuáles son nuevos, cuáles cambiaron y cuáles se
  // borraron (los horarios viejos no tenían id, así que se lo asignamos acá).
  const horariosPrevios = materiaAnterior?.horarios || [];
  const horarios = (materiaNueva.horarios || []).map((h) => (h.id ? h : { ...h, id: uid() }));
  const previosPorId = new Map(horariosPrevios.filter((h) => h.id).map((h) => [h.id, h]));
  const idsActuales = new Set(horarios.map((h) => h.id));

  // Bajas: horarios que existían y tenían evento, y ya no están.
  for (const h of horariosPrevios) {
    if (h.googleEventId && h.id && !idsActuales.has(h.id)) {
      try { await apiEliminarEvento(accessToken, calendarId, h.googleEventId); } catch (e) { /* silencioso */ }
    }
  }

  if (!inicioCursada) return { ...materiaNueva, horarios };

  const horariosSincronizados = [];
  for (const h of horarios) {
    const anterior = previosPorId.get(h.id);
    const payload = eventoRecurrenteHorario(materiaNueva, h, inicioCursada, finCursada);
    if (!payload) { horariosSincronizados.push(h); continue; }
    const cambioHorario = !anterior || anterior.dia !== h.dia || anterior.inicio !== h.inicio || anterior.fin !== h.fin;
    try {
      if (h.googleEventId && anterior) {
        if (cambioHorario || fechasCambiaron) {
          await apiActualizarEvento(accessToken, calendarId, h.googleEventId, payload);
        }
        horariosSincronizados.push(h);
      } else {
        const creado = await apiCrearEvento(accessToken, calendarId, payload);
        horariosSincronizados.push({ ...h, googleEventId: creado.id });
      }
    } catch (e) {
      horariosSincronizados.push(h); // si falla la llamada, el horario se guarda igual, solo que sin vincular
    }
  }

  return { ...materiaNueva, horarios: horariosSincronizados };
}

function FilaMateria({ m, materias, onOpen, onCambiarEstado, modo = "normal" }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const pendientes = calcularCorrelativasPendientes(m, materias);
  const inactiva = m.estado === "Pendiente";
  const promedio = calcularPromedio(m.examenes);
  // Una materia Pendiente todavía no tiene parciales ni final que mostrar,
  // así que no tiene sentido ofrecerle la flecha de "ver historial".
  const puedeExpandir = modo === "historial" && !inactiva;
  const examenesParciales = (m.examenes || []).filter((e) => e.tipo === "Parcial");
  const examenesFinal = (m.examenes || []).filter((e) => e.tipo === "Final");
  const notaTexto = (n) => (n !== null && n !== undefined && n !== "" ? n : "—");

  const handleClickFila = () => {
    if (puedeExpandir) setExpandido((v) => !v);
    else onOpen(m.id);
  };

  return (
    <div className={`fila-materia-wrap ${puedeExpandir ? "fila-materia-wrap-historial" : ""}`}>
      <div className={`fila-materia ${inactiva ? "fila-materia-inactiva" : ""}`} onClick={handleClickFila}>
        <span className="fila-dot" style={{ background: m.color }} />
        <div className="fila-texto">
          <div className="fila-nombre">
            <strong>{m.nombre}</strong>
            {pendientes.length > 0 && (
              <span className="fila-lock" title={`Requiere: ${pendientes.map((p) => p.nombre).join(", ")}`}>
                <Lock size={12} />
              </span>
            )}
          </div>
          <span className="muted">{m.profesor || "Sin docente"}</span>
        </div>
        {promedio !== null && <span className="fila-promedio">{promedio.toFixed(1)}</span>}
        <span
          className="fila-pill"
          style={{ "--sc": ESTADO_COLOR[m.estado] }}
          title={m.estado === "Aprobada" && m.fechaAprobada ? `Aprobada el ${fmtFechaLarga(m.fechaAprobada)}` : undefined}
        >
          {m.estado}
        </span>
        {puedeExpandir && (
          <ChevronDown size={16} className={`fila-chevron ${expandido ? "fila-chevron-abierto" : ""}`} />
        )}
        <div className="fila-menu" onClick={(e) => e.stopPropagation()}>
          <IconBtn icon={MoreVertical} title="Cambiar estado" onClick={() => setMenuAbierto((v) => !v)} />
          {menuAbierto && (
            <>
              <div className="fila-menu-backdrop" onClick={() => setMenuAbierto(false)} />
              <div className="fila-menu-pop">
                <p className="fila-menu-label">Cambiar estado</p>
                {ESTADOS.filter((e) => e !== m.estado).map((e) => (
                  <button key={e} onClick={() => { setMenuAbierto(false); onCambiarEstado(m.id, e); }}>
                    <span className="fila-menu-dot" style={{ background: ESTADO_COLOR[e] }} /> {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {puedeExpandir && expandido && (
        <div className="fila-historial">
          {examenesParciales.length === 0 && examenesFinal.length === 0 && !m.promocionada ? (
            <p className="muted fila-historial-vacio">Todavía no hay notas cargadas en esta materia.</p>
          ) : (
            <div className="fila-historial-grupos">
              <div className="fila-historial-grupo">
                <p className="fila-historial-titulo">Parciales</p>
                {examenesParciales.length === 0 ? (
                  <p className="muted fila-historial-sin">Sin parciales cargados.</p>
                ) : (
                  <ul>
                    {examenesParciales.map((e) => (
                      <li key={e.id}>
                        <span>{e.titulo || "Parcial"}</span>
                        <span className="fila-historial-nota">{notaTexto(e.nota)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="fila-historial-grupo">
                <p className="fila-historial-titulo">Final</p>
                {m.promocionada ? (
                  <p className="fila-historial-promo">🎓 Promocionada — no rindió final</p>
                ) : examenesFinal.length === 0 ? (
                  <p className="muted fila-historial-sin">Sin nota de final cargada.</p>
                ) : (
                  <ul>
                    {examenesFinal.map((e) => (
                      <li key={e.id}>
                        <span>{e.titulo || "Final"}</span>
                        <span className="fila-historial-nota">{notaTexto(e.nota)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <button className="btn-secundario btn-chico fila-historial-verdetalle" onClick={() => onOpen(m.id)}>
            Ver ficha completa →
          </button>
        </div>
      )}
    </div>
  );
}

function MateriaFormModal({ materia, materias, onSave, onClose, onDelete, guardando }) {
  const [form, setForm] = useState(
    materia || {
      nombre: "", profesor: "", aula: "", color: COLORES[0].hex, estado: "Pendiente",
      anio: 1, correlativas: [], horarios: [], notas: [], recursos: [], resumenes: [],
      fechaAprobada: null, promocionada: false, asistencia: { faltas: 0, inicioCursada: "", finCursada: "" }, examenes: [], tareas: [],
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setAsistenciaCampo = (k, v) =>
    setForm((f) => ({ ...f, asistencia: { faltas: 0, inicioCursada: "", finCursada: "", ...(f.asistencia || {}), [k]: v } }));

  const toggleCorrelativa = (id) => {
    const actuales = form.correlativas || [];
    set("correlativas", actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]);
  };
  // No podés elegirte a vos misma como tu propia correlativa.
  const opcionesCorrelativas = (materias || []).filter((m) => m.id !== form.id);
  const [busquedaCorrelativas, setBusquedaCorrelativas] = useState("");
  const opcionesCorrelativasFiltradas = useMemo(() => {
    const q = normalizarTexto(busquedaCorrelativas);
    const ordenadas = [...opcionesCorrelativas].sort((a, b) => (a.anio - b.anio) || a.nombre.localeCompare(b.nombre));
    if (!q) return ordenadas;
    return ordenadas.filter((m) => normalizarTexto(m.nombre).includes(q));
  }, [opcionesCorrelativas, busquedaCorrelativas]);

  const addHorario = () => set("horarios", [...form.horarios, { dia: "Lunes", inicio: "08:00", fin: "10:00" }]);
  const updHorario = (i, k, v) => {
    const hs = form.horarios.slice();
    hs[i] = { ...hs[i], [k]: v };
    set("horarios", hs);
  };
  const delHorario = (i) => set("horarios", form.horarios.filter((_, idx) => idx !== i));

  const guardar = () => {
    if (!form.nombre.trim()) return;
    onSave({ ...form, id: form.id || uid() });
  };

  return (
    <Modal title={materia ? "Editar materia" : "Nueva materia"} onClose={onClose} wide>
      <div className="form-grid">
        <label className="campo campo-full">
          <span>Nombre de la materia</span>
          <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Programación II" autoFocus />
        </label>
        <label className="campo">
          <span>Docente</span>
          <input value={form.profesor} onChange={(e) => set("profesor", e.target.value)} placeholder="Ej: Ing. Torres" />
        </label>
        <label className="campo">
          <span>Aula</span>
          <input value={form.aula || ""} onChange={(e) => set("aula", e.target.value)} placeholder="Ej: Lab 3" />
        </label>
        <label className="campo">
          <span>Año</span>
          <select value={form.anio} onChange={(e) => set("anio", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{anioLabel(n)}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Estado</span>
          <select
            value={form.estado}
            onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value, promocionada: e.target.value === "Aprobada" ? f.promocionada : false }))}
          >
            {ESTADOS.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </label>
        {form.estado === "Aprobada" && (
          <label className="campo campo-full campo-checkbox">
            <input
              type="checkbox"
              checked={!!form.promocionada}
              onChange={(e) => set("promocionada", e.target.checked)}
            />
            <span>Se promocionó (no rindió final)</span>
          </label>
        )}
        <div className="campo campo-full">
          <span>Correlativas</span>
          {opcionesCorrelativas.length === 0 ? (
            <p className="muted" style={{ margin: "6px 0 0" }}>Todavía no hay otras materias cargadas para elegir.</p>
          ) : (
            <>
              {opcionesCorrelativas.length > 5 && (
                <div className="correlativas-buscador">
                  <Search size={14} />
                  <input
                    value={busquedaCorrelativas}
                    onChange={(e) => setBusquedaCorrelativas(e.target.value)}
                    placeholder="Buscar materia…"
                  />
                  {busquedaCorrelativas && (
                    <button type="button" className="correlativas-buscador-limpiar" onClick={() => setBusquedaCorrelativas("")} aria-label="Limpiar búsqueda">
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}
              <div className="selector-correlativas">
                {opcionesCorrelativasFiltradas.length === 0 ? (
                  <p className="muted" style={{ margin: "6px 9px" }}>No encontramos materias con ese nombre.</p>
                ) : (
                  opcionesCorrelativasFiltradas.map((m) => {
                    const marcada = (form.correlativas || []).includes(m.id);
                    return (
                      <label key={m.id} className={`selector-correlativas-item ${marcada ? "selector-correlativas-item-on" : ""}`}>
                        <input type="checkbox" checked={marcada} onChange={() => toggleCorrelativa(m.id)} />
                        <span className="selector-correlativas-dot" style={{ background: m.color }} />
                        <span className="selector-correlativas-nombre">{m.nombre}</span>
                        <span className="selector-correlativas-anio">{anioLabel(m.anio)}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
        <div className="campo campo-full">
          <span>Color</span>
          <ColorPicker value={form.color} onChange={(v) => set("color", v)} />
        </div>

        <div className="campo campo-full">
          <span>Horarios</span>
          {form.horarios.map((h, i) => (
            <div key={i} className="horario-fila">
              <select value={h.dia} onChange={(e) => updHorario(i, "dia", e.target.value)}>
                {DIAS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <input type="time" value={h.inicio} onChange={(e) => updHorario(i, "inicio", e.target.value)} />
              <span className="muted">a</span>
              <input type="time" value={h.fin} onChange={(e) => updHorario(i, "fin", e.target.value)} />
              <IconBtn icon={Trash2} title="Quitar" danger onClick={() => delHorario(i)} />
            </div>
          ))}
          <button type="button" className="btn-secundario btn-chico" onClick={addHorario}>
            <Plus size={14} /> Agregar horario
          </button>
        </div>

        <div className="campo campo-full">
          <span>Período de cursada</span>
          <div className="periodo-cursada-fila">
            <label className="campo">
              <span className="campo-sublabel">Inicio</span>
              <input
                type="date"
                value={form.asistencia?.inicioCursada || ""}
                onChange={(e) => setAsistenciaCampo("inicioCursada", e.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo-sublabel">Fin</span>
              <input
                type="date"
                value={form.asistencia?.finCursada || ""}
                onChange={(e) => setAsistenciaCampo("finCursada", e.target.value)}
              />
            </label>
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Con estas fechas, la app calcula sola cuántas clases hay en total (según tus horarios) para llevar el control de asistencia.
          </p>
        </div>
      </div>

      <div className="modal-acciones">
        {materia && <button className="btn-peligro" onClick={onDelete} disabled={guardando}>Eliminar materia</button>}
        <button className="btn-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
        <button className="btn-primario" onClick={guardar} disabled={guardando}>
          {guardando ? "Sincronizando con Calendar…" : "Guardar materia"}
        </button>
      </div>
    </Modal>
  );
}

function BloqueResumen({ bloque, onChange, onDelete }) {
  const fileRef = useRef(null);

  const subirImagen = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      onChange({ ...bloque, imagen: dataUrl });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bloque">
      <div className="bloque-head">
        <input
          className="bloque-titulo"
          value={bloque.titulo || ""}
          onChange={(e) => onChange({ ...bloque, titulo: e.target.value })}
          placeholder="Título del bloque"
        />
        <IconBtn icon={Trash2} title="Eliminar bloque" danger onClick={onDelete} />
      </div>
      {bloque.tipo === "texto" ? (
        <textarea
          rows={4}
          className="bloque-texto"
          value={bloque.texto || ""}
          onChange={(e) => onChange({ ...bloque, texto: e.target.value })}
          placeholder="Escribí el contenido del resumen…"
        />
      ) : (
        <div className="bloque-imagen">
          {bloque.imagen ? (
            <img src={bloque.imagen} alt={bloque.titulo || "imagen"} />
          ) : (
            <button type="button" className="btn-secundario btn-chico" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={14} /> Subir imagen
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => subirImagen(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}

function MateriaDetalle({ materia, materias, onUpdate, onClose, onEdit, googleCal, asistenciaMinima, tabInicial = "inicio" }) {
  const [tab, setTab] = useState(tabInicial);
  const [resumenActivo, setResumenActivo] = useState(materia.resumenes[0]?.id || null);
  const [nuevoRecurso, setNuevoRecurso] = useState({ tipo: "Apunte", nombre: "", url: "", archivo: "", archivoNombre: "", archivoTipo: "" });
  const [errorArchivo, setErrorArchivo] = useState("");
  const [nuevoExamen, setNuevoExamen] = useState({ tipo: "Trabajo práctico", titulo: "", nota: "", fecha: "", recuperaDe: "", modalidad: "", aula: "", enlace: "", temario: "" });
  const [modoEdicionExamenes, setModoEdicionExamenes] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: "", descripcion: "", fecha: "", recurrencia: "", prioridad: "Media", etiquetas: "", archivo: "", archivoNombre: "", archivoTipo: "" });
  const [vistaTareas, setVistaTareas] = useState("Todas");
  const tareaArchivoRef = useRef(null);
  const [tareasExpandidas, setTareasExpandidas] = useState(new Set());
  const [subtareaTexto, setSubtareaTexto] = useState({});
  const [tareaAEliminar, setTareaAEliminar] = useState(null);
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false);
  const [notaNuevaTexto, setNotaNuevaTexto] = useState("");
  const [notaEnEdicionId, setNotaEnEdicionId] = useState(null);
  const [notaEnEdicionTexto, setNotaEnEdicionTexto] = useState("");
  const [tareaModalAbierto, setTareaModalAbierto] = useState(false);
  const [examenModalAbierto, setExamenModalAbierto] = useState(false);
  const [recursoModalAbierto, setRecursoModalAbierto] = useState(false);
  const [previewArchivo, setPreviewArchivo] = useState(null);

  const asistencia = materia.asistencia || { faltas: 0, inicioCursada: "", finCursada: "" };
  const examenes = materia.examenes || [];
  // El orden de la cursada se mantiene predecible. Los trabajos prácticos
  // quedan entre los parciales y conservan entre sí el orden en que fueron
  // cargados (el orden original del array es estable).
  const examenesOrdenados = examenes
    .map((e, indice) => ({ e, indice }))
    .sort((a, b) => {
      const prioridad = (x) => {
        if (x.tipo === "Parcial" && x.titulo === "Primer parcial") return 0;
        if (x.tipo === "Trabajo práctico") return 1;
        if (x.tipo === "Parcial" && x.titulo === "Segundo parcial") return 2;
        if (x.tipo === "Final") return 3;
        return 4;
      };
      return prioridad(a.e) - prioridad(b.e) || a.indice - b.indice;
    })
    .map(({ e }) => e);
  const tareas = materia.tareas || [];
  const tareasCompletadasCount = tareas.filter((t) => t.completada).length;
  const tareasPendientesCount = tareas.length - tareasCompletadasCount;
  const tareasVisibles = tareas.filter((t) => {
    if (mostrarCompletadas ? false : t.completada) return false;
    if (vistaTareas === "Hoy") return t.fecha === toDateStr(new Date());
    if (vistaTareas === "Esta semana") return t.fecha && diffDias(t.fecha) >= 0 && diffDias(t.fecha) <= 7;
    if (vistaTareas === "Vencidas") return t.fecha && diffDias(t.fecha) < 0;
    return true;
  });
  const notas = materia.notas || [];
  const promedio = calcularPromedio(examenes);
  const totalClases = contarClasesEnRango(materia.horarios, asistencia.inicioCursada, asistencia.finCursada);
  const asistenciaPct = calcularAsistenciaPct(asistencia, materia.horarios);
  const maxFaltasPermitidas = totalClases !== null ? Math.floor(totalClases * (1 - asistenciaMinima / 100)) : null;
  const faltasDisponibles = maxFaltasPermitidas !== null ? maxFaltasPermitidas - asistencia.faltas : null;

  // Datos derivados para la pestaña "Inicio" (el workspace de la materia).
  const hoyStr = toDateStr(new Date());
  const examenesProximosMateria = examenes
    .filter((e) => e.fecha && e.fecha >= hoyStr)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const tareasPendientesMateria = tareas
    .filter((t) => !t.completada)
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha < b.fecha ? -1 : 1;
    });
  const correlativasPendientesMateria = calcularCorrelativasPendientes(materia, materias);
  const materiasQueHabilita = materias.filter(
    (m) => m.id !== materia.id && (m.correlativas || []).includes(materia.id) && m.estado !== "Aprobada"
  );
  const proximaClase = proximaClaseDeMateria(materia.horarios);
  const progresoCursadaPct = progresoCursada(asistencia.inicioCursada, asistencia.finCursada);
  const progresoTareasPct = tareas.length ? Math.round((tareasCompletadasCount / tareas.length) * 100) : 0;
  const ultimaNota = notas.length > 0 ? notas.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] : null;

  const patch = (fields) => onUpdate({ ...materia, ...fields });

  const updAsistencia = (fields) => patch({ asistencia: { ...asistencia, ...fields } });
  const sumarFalta = () => updAsistencia({ faltas: asistencia.faltas + 1 });
  const restarFalta = () => updAsistencia({ faltas: Math.max(0, asistencia.faltas - 1) });
  const resetFaltas = () => updAsistencia({ faltas: 0 });

  const addNota = () => {
    if (!notaNuevaTexto.trim()) return;
    patch({ notas: [...notas, { id: uid(), fecha: new Date().toISOString(), texto: notaNuevaTexto.trim() }] });
    setNotaNuevaTexto("");
  };
  const delNota = (id) => patch({ notas: notas.filter((n) => n.id !== id) });
  const iniciarEdicionNota = (n) => { setNotaEnEdicionId(n.id); setNotaEnEdicionTexto(n.texto); };
  const cancelarEdicionNota = () => { setNotaEnEdicionId(null); setNotaEnEdicionTexto(""); };
  const guardarEdicionNota = (id) => {
    if (!notaEnEdicionTexto.trim()) return;
    patch({ notas: notas.map((n) => (n.id === id ? { ...n, texto: notaEnEdicionTexto.trim() } : n)) });
    setNotaEnEdicionId(null);
    setNotaEnEdicionTexto("");
  };

  // Crea, actualiza o borra el evento de Google Calendar de un examen, según
  // corresponda, cada vez que se carga/cambia/borra su fecha. Si no hay
  // conexión con Google, no hace nada (el examen se guarda igual, local).
  const sincronizarExamenConCalendario = async (examenNuevo, examenAnterior) => {
    const { accessToken, calendarId } = googleCal || {};
    if (!accessToken || !calendarId) return;
    try {
      if (!examenNuevo.fecha) {
        if (examenAnterior?.googleEventId) {
          await apiEliminarEvento(accessToken, calendarId, examenAnterior.googleEventId);
          patch({ examenes: (materia.examenes || []).map((e) => (e.id === examenNuevo.id ? { ...e, googleEventId: undefined } : e)) });
        }
        return;
      }
      const payload = eventoDeExamen(materia, examenNuevo);
      if (!payload) return;
      if (examenAnterior?.googleEventId) {
        await apiActualizarEvento(accessToken, calendarId, examenAnterior.googleEventId, payload);
      } else {
        const creado = await apiCrearEvento(accessToken, calendarId, payload);
        patch({ examenes: (materia.examenes || []).map((e) => (e.id === examenNuevo.id ? { ...e, googleEventId: creado.id } : e)) });
      }
    } catch (e) {
      // Silencioso: el examen ya quedó guardado localmente aunque falle Calendar.
    }
  };

  const addExamen = () => {
    const titulo = tituloAutomaticoExamen(nuevoExamen, examenes);
    if (!titulo.trim()) return;
    const nuevo = { id: uid(), tipo: nuevoExamen.tipo, titulo, nota: nuevoExamen.nota === "" ? null : Number(nuevoExamen.nota), fecha: nuevoExamen.fecha, modalidad: nuevoExamen.modalidad, aula: nuevoExamen.aula, enlace: nuevoExamen.enlace, temario: nuevoExamen.temario };
    patch({ examenes: [...examenes, nuevo] });
    setNuevoExamen({ tipo: "Trabajo práctico", titulo: "", nota: "", fecha: "", recuperaDe: "", modalidad: "", aula: "", enlace: "", temario: "" });
    setExamenModalAbierto(false);
    sincronizarExamenConCalendario(nuevo, null);
  };
  const delExamen = (id) => {
    const examen = examenes.find((e) => e.id === id);
    patch({ examenes: examenes.filter((e) => e.id !== id) });
    if (examen?.googleEventId && googleCal?.accessToken && googleCal?.calendarId) {
      apiEliminarEvento(googleCal.accessToken, googleCal.calendarId, examen.googleEventId).catch(() => {});
    }
  };
  const updNotaExamen = (id, valor) => {
    patch({ examenes: examenes.map((e) => (e.id === id ? { ...e, nota: valor === "" ? null : Number(valor) } : e)) });
  };
  const updFechaExamen = (id, valor) => {
    const examenAnterior = examenes.find((e) => e.id === id);
    const examenNuevo = { ...examenAnterior, fecha: valor };
    patch({ examenes: examenes.map((e) => (e.id === id ? examenNuevo : e)) });
    sincronizarExamenConCalendario(examenNuevo, examenAnterior);
  };

  const addTarea = () => {
    if (!nuevaTarea.titulo.trim()) return;
    const diaRec = nuevaTarea.recurrencia !== "" ? Number(nuevaTarea.recurrencia) : null;
    // Si se eligió repetición, la primera fecha es la próxima vez que cae
    // ese día (incluyendo hoy mismo, si hoy ya es ese día).
    const fechaFinal = diaRec !== null ? proximaFechaRecurrente(diaRec, null, true) : nuevaTarea.fecha;
    patch({
      tareas: [
        ...tareas,
        {
          id: uid(),
          titulo: nuevaTarea.titulo,
          descripcion: nuevaTarea.descripcion,
          prioridad: nuevaTarea.prioridad,
          etiquetas: nuevaTarea.etiquetas.split(",").map((x) => x.trim()).filter(Boolean),
          archivo: nuevaTarea.archivo,
          archivoNombre: nuevaTarea.archivoNombre,
          archivoTipo: nuevaTarea.archivoTipo,
          fecha: fechaFinal,
          completada: false,
          subtareas: [],
          recurrencia: diaRec !== null ? { diaSemana: diaRec } : null,
          vecesCompletada: 0,
        },
      ],
    });
    setNuevaTarea({ titulo: "", descripcion: "", fecha: "", recurrencia: "", prioridad: "Media", etiquetas: "", archivo: "", archivoNombre: "", archivoTipo: "" });
    setTareaModalAbierto(false);
  };
  const cargarArchivoTarea = async (file) => {
    if (!file) return;
    try { const { dataUrl, nombre, tipo } = await leerArchivoComoDataUrl(file); setNuevaTarea((t) => ({ ...t, archivo: dataUrl, archivoNombre: nombre, archivoTipo: tipo })); } catch (e) { /* se mantiene el formulario */ }
  };
  const toggleTarea = (id) => {
    const t = tareas.find((x) => x.id === id);
    if (t && t.recurrencia && !t.completada) {
      // Tarea recurrente: en vez de quedar tildada para siempre, "salta"
      // directo a la próxima fecha (el próximo martes, etc.) y suma una
      // vuelta cumplida — así siempre representa la próxima ocurrencia.
      patch({
        tareas: tareas.map((x) =>
          x.id === id
            ? { ...x, fecha: proximaFechaRecurrente(x.recurrencia.diaSemana, x.fecha), vecesCompletada: (x.vecesCompletada || 0) + 1 }
            : x
        ),
      });
      return;
    }
    patch({ tareas: tareas.map((x) => (x.id === id ? { ...x, completada: !x.completada } : x)) });
  };
  const pedirEliminarTarea = (t) => setTareaAEliminar(t);
  const confirmarEliminarTarea = () => {
    if (!tareaAEliminar) return;
    patch({ tareas: tareas.filter((t) => t.id !== tareaAEliminar.id) });
    setTareaAEliminar(null);
  };

  const toggleExpandirTarea = (id) => {
    setTareasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const addSubtarea = (tareaId) => {
    const texto = (subtareaTexto[tareaId] || "").trim();
    if (!texto) return;
    patch({
      tareas: tareas.map((t) =>
        t.id === tareaId ? { ...t, subtareas: [...(t.subtareas || []), { id: uid(), texto, completada: false }] } : t
      ),
    });
    setSubtareaTexto((s) => ({ ...s, [tareaId]: "" }));
  };
  const toggleSubtarea = (tareaId, subId) => {
    patch({
      tareas: tareas.map((t) =>
        t.id === tareaId
          ? { ...t, subtareas: (t.subtareas || []).map((s) => (s.id === subId ? { ...s, completada: !s.completada } : s)) }
          : t
      ),
    });
  };
  const delSubtarea = (tareaId, subId) => {
    patch({
      tareas: tareas.map((t) => (t.id === tareaId ? { ...t, subtareas: (t.subtareas || []).filter((s) => s.id !== subId) } : t)),
    });
  };

  const addRecurso = () => {
    if (!nuevoRecurso.nombre.trim()) return;
    patch({ recursos: [...materia.recursos, { ...nuevoRecurso, id: uid() }] });
    setNuevoRecurso({ tipo: "Apunte", nombre: "", url: "", archivo: "", archivoNombre: "", archivoTipo: "" });
    setErrorArchivo("");
    setRecursoModalAbierto(false);
  };
  const delRecurso = (id) => patch({ recursos: materia.recursos.filter((r) => r.id !== id) });

  const subirArchivoRecurso = async (file) => {
    if (!file) return;
    setErrorArchivo("");
    try {
      const { dataUrl, nombre, tipo } = await leerArchivoComoDataUrl(file);
      setNuevoRecurso((r) => ({ ...r, archivo: dataUrl, archivoNombre: nombre, archivoTipo: tipo, nombre: r.nombre || nombre }));
    } catch (e) {
      setErrorArchivo(e.message);
    }
  };
  const quitarArchivoRecurso = () => setNuevoRecurso((r) => ({ ...r, archivo: "", archivoNombre: "", archivoTipo: "" }));

  const addResumen = () => {
    const nuevo = { id: uid(), titulo: "Nuevo resumen", bloques: [] };
    patch({ resumenes: [...materia.resumenes, nuevo] });
    setResumenActivo(nuevo.id);
  };
  const delResumen = (id) => {
    patch({ resumenes: materia.resumenes.filter((r) => r.id !== id) });
    if (resumenActivo === id) setResumenActivo(null);
  };
  const updResumenTitulo = (id, titulo) => {
    patch({ resumenes: materia.resumenes.map((r) => (r.id === id ? { ...r, titulo } : r)) });
  };
  const addBloque = (resumenId, tipo) => {
    patch({
      resumenes: materia.resumenes.map((r) =>
        r.id === resumenId
          ? { ...r, bloques: [...r.bloques, { id: uid(), tipo, titulo: "", texto: "", imagen: "" }] }
          : r
      ),
    });
  };
  const updBloque = (resumenId, bloque) => {
    patch({
      resumenes: materia.resumenes.map((r) =>
        r.id === resumenId ? { ...r, bloques: r.bloques.map((b) => (b.id === bloque.id ? bloque : b)) } : r
      ),
    });
  };
  const delBloque = (resumenId, bloqueId) => {
    patch({
      resumenes: materia.resumenes.map((r) =>
        r.id === resumenId ? { ...r, bloques: r.bloques.filter((b) => b.id !== bloqueId) } : r
      ),
    });
  };

  const resumen = materia.resumenes.find((r) => r.id === resumenActivo);

  return (
    <div className="detalle-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detalle-panel">
        <div className="detalle-head" style={{ "--mc": materia.color }}>
          <button className="volver" onClick={onClose}><ArrowLeft size={18} /> Volver</button>
          <div className="detalle-head-acciones">
            <IconBtn icon={Pencil} title="Editar" onClick={onEdit} />
          </div>
        </div>

        <div className="detalle-titulo">
          <p className="detalle-estado-label" style={{ "--sc": ESTADO_COLOR[materia.estado] }}>{materia.estado}</p>
          <h2>{materia.nombre}</h2>
          <p className="muted">
            {materia.profesor || "Sin docente"} {materia.aula ? `· ${materia.aula}` : ""} · {anioLabel(materia.anio)}
            {promedio !== null && ` · Promedio ${promedio.toFixed(2)}`}
          </p>
          {materia.estado === "Aprobada" && materia.fechaAprobada && (
            <p className="detalle-fecha-aprobada">
              <GraduationCap size={13} /> Aprobada el {fmtFechaLarga(materia.fechaAprobada)}
            </p>
          )}
          {materia.horarios.length > 0 && (
            <div className="detalle-horarios">
              {materia.horarios.map((h, i) => (
                <span key={i} className="chip"><Clock size={12} /> {h.dia} {h.inicio}–{h.fin}</span>
              ))}
            </div>
          )}
        </div>

        <div className="tabs">
          {["inicio", "info", "tareas", "asistencia", "examenes", "recursos", "resumenes"].map((t) => {
            const hayPendientes = t === "tareas" && tareas.some((x) => !x.completada);
            return (
              <button key={t} className={`tab ${tab === t ? "tab-activo" : ""} ${hayPendientes ? "tab-con-alerta" : ""}`} onClick={() => setTab(t)}>
                {t === "inicio" ? "Inicio" : t === "info" ? "Notas" : t === "tareas" ? "Tareas" : t === "asistencia" ? "Asistencia" : t === "examenes" ? "Exámenes" : t === "recursos" ? "Recursos" : "Resúmenes"}
                {hayPendientes && <span className="tab-dot" />}
              </button>
            );
          })}
        </div>

        {tab === "inicio" && (
          <div className="tab-panel">
            <section className="panel progreso-general">
              <div><span className="muted">Progreso de tareas</span><strong>{progresoTareasPct}%</strong><div className="progreso-barra"><div className="progreso-barra-relleno" style={{ width: `${progresoTareasPct}%` }} /></div><small>{tareasCompletadasCount} de {tareas.length || 0} completadas</small></div>
              <div><span className="muted">Asistencia</span>{asistenciaPct === null ? <><strong>—</strong><small>Cargá el período de cursada</small></> : <><strong className={asistenciaPct < asistenciaMinima ? "asistencia-estado-riesgo" : ""}>{Math.round(asistenciaPct)}%</strong><small>{asistencia.faltas} {asistencia.faltas === 1 ? "falta" : "faltas"} de {totalClases}{faltasDisponibles !== null && (faltasDisponibles >= 0 ? ` · podés faltar ${faltasDisponibles} más` : " · superaste el máximo de faltas")}<br /><button className="link-btn progreso-link" onClick={() => setTab("asistencia")}>Ver asistencia →</button></small></>}</div>
              <div><span className="muted">Progreso de la cursada</span>{progresoCursadaPct === null ? <><strong>—</strong><small>Cargá el período de cursada</small></> : <><strong>{Math.round(progresoCursadaPct)}%</strong><div className="progreso-barra"><div className="progreso-barra-relleno" style={{ width: `${progresoCursadaPct}%` }} /></div><small>del período transcurrido</small></>}</div>
            </section>
            <div className="dos-columnas materia-inicio-layout">
              <div className="columna-izquierda">
                <section className="panel">
                  <h2>Próxima clase</h2>
                  {proximaClase ? (
                    <p className="materia-inicio-dato">
                      <strong>
                        {proximaClase.distanciaDias === 0 ? "Hoy" : proximaClase.distanciaDias === 1 ? "Mañana" : proximaClase.dia}
                      </strong>{" "}
                      · {proximaClase.inicio}–{proximaClase.fin}
                    </p>
                  ) : (
                    <p className="muted">Todavía no cargaste horarios para esta materia.</p>
                  )}
                </section>

                <section className="panel panel-pendientes-grande panel-examenes-grande">
                  <div className="panel-pendientes-head">
                    <h2>Próximo examen</h2>
                    {examenesProximosMateria.length > 0 && (
                      <span className="panel-pendientes-contador panel-examenes-contador">{examenesProximosMateria.length}</span>
                    )}
                  </div>
                  {examenesProximosMateria.length === 0 ? (
                    <p className="muted">No tenés exámenes con fecha cargada próximamente.</p>
                  ) : (
                    <ul className="lista-pendientes-grande">
                      <li className={`pendiente-fila-grande pendiente-${nivelUrgencia(examenesProximosMateria[0].fecha)}`}>
                        <span className="chip-tipo" style={{ "--tc": TIPO_EXAMEN_COLOR[examenesProximosMateria[0].tipo] }}>
                          {examenesProximosMateria[0].tipo}
                        </span>
                        <div className="pendiente-texto-grande" onClick={() => setTab("examenes")}>
                          <strong>{examenesProximosMateria[0].titulo}</strong>
                        </div>
                        <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(examenesProximosMateria[0].fecha)}`}>
                          {textoUrgencia(examenesProximosMateria[0].fecha)}
                        </span>
                      </li>
                    </ul>
                  )}
                  {examenesProximosMateria.length > 1 && (
                    <button className="link-btn" onClick={() => setTab("examenes")}>Ver los {examenesProximosMateria.length} exámenes →</button>
                  )}
                </section>

                <section className="panel panel-pendientes-grande">
                  <div className="panel-pendientes-head">
                    <h2>Tareas pendientes</h2>
                    {tareasPendientesMateria.length > 0 && (
                      <span className="panel-pendientes-contador">{tareasPendientesMateria.length}</span>
                    )}
                  </div>
                  {tareasPendientesMateria.length === 0 ? (
                    <p className="muted">No tenés tareas pendientes en esta materia.</p>
                  ) : (
                    <ul className="lista-pendientes-grande">
                      {tareasPendientesMateria.slice(0, 5).map((t) => (
                        <li key={t.id} className={`pendiente-fila-grande pendiente-${nivelUrgencia(t.fecha)}`}>
                          <button className="tarea-check" onClick={() => toggleTarea(t.id)} title="Marcar como hecha">
                            <Square size={19} />
                          </button>
                          <div className="pendiente-texto-grande" onClick={() => setTab("tareas")}>
                            <strong>{t.titulo}</strong>
                          </div>
                          <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(t.fecha)}`}>{textoUrgencia(t.fecha)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {tareasPendientesMateria.length > 5 && (
                    <button className="link-btn" onClick={() => setTab("tareas")}>Ver las {tareasPendientesMateria.length} pendientes →</button>
                  )}
                </section>
              </div>

              <div className="columna-derecha">
                {ultimaNota && (
                  <section className="panel">
                    <h2>Última nota</h2>
                    <p className="nota-entrada-texto materia-inicio-nota">{ultimaNota.texto}</p>
                    <span className="nota-entrada-fecha">{fmtFechaHoraNota(ultimaNota.fecha)}</span>
                    <div><button className="link-btn" onClick={() => setTab("info")}>Ver todas las notas →</button></div>
                  </section>
                )}

                {(correlativasPendientesMateria.length > 0 || materiasQueHabilita.length > 0) && (
                  <section className="panel">
                    <h2>Correlativas</h2>
                    {correlativasPendientesMateria.length > 0 && (
                      <>
                        <p className="muted">Te falta aprobar para poder cursarla:</p>
                        <ul className="lista-eventos-google">
                          {correlativasPendientesMateria.map((m) => (
                            <li key={m.id}>
                              <span className="lista-eventos-google-dot" style={{ background: m.color }} />
                              <span className="lista-eventos-google-texto"><strong>{m.nombre}</strong></span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {materiasQueHabilita.length > 0 && (
                      <>
                        <p className="muted" style={{ marginTop: correlativasPendientesMateria.length > 0 ? 12 : 0 }}>
                          Al aprobarla, habilitás:
                        </p>
                        <ul className="lista-eventos-google">
                          {materiasQueHabilita.map((m) => (
                            <li key={m.id}>
                              <span className="lista-eventos-google-dot" style={{ background: m.color }} />
                              <span className="lista-eventos-google-texto"><strong>{m.nombre}</strong></span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                )}

              </div>
            </div>
          </div>
        )}

        {tab === "info" && (
          <div className="tab-panel">
            <div className="nota-nueva">
              <textarea
                rows={3}
                value={notaNuevaTexto}
                onChange={(e) => setNotaNuevaTexto(e.target.value)}
                placeholder="Escribí una nota: un aviso, algo para recordar, cómo estuvo la clase de hoy…"
              />
              <button className="btn-primario btn-chico" disabled={!notaNuevaTexto.trim()} onClick={addNota}>
                <Plus size={14} /> Agregar nota
              </button>
            </div>

            {notas.length === 0 ? (
              <p className="muted">Todavía no hay notas en esta materia.</p>
            ) : (
              <ul className="lista-notas">
                {notas
                  .slice()
                  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                  .map((n) => (
                    <li key={n.id} className="nota-entrada">
                      {notaEnEdicionId === n.id ? (
                        <>
                          <textarea
                            rows={3}
                            autoFocus
                            value={notaEnEdicionTexto}
                            onChange={(e) => setNotaEnEdicionTexto(e.target.value)}
                          />
                          <div className="nota-entrada-acciones">
                            <button className="btn-secundario btn-chico" onClick={cancelarEdicionNota}>Cancelar</button>
                            <button className="btn-primario btn-chico" disabled={!notaEnEdicionTexto.trim()} onClick={() => guardarEdicionNota(n.id)}>Guardar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="nota-entrada-head">
                            <span className="nota-entrada-fecha">{fmtFechaHoraNota(n.fecha)}</span>
                            <div className="nota-entrada-botones">
                              <IconBtn icon={Pencil} title="Editar" onClick={() => iniciarEdicionNota(n)} />
                              <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => delNota(n.id)} />
                            </div>
                          </div>
                          <p className="nota-entrada-texto">{n.texto}</p>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {tab === "tareas" && (
          <div className="tab-panel">
            <div className="filtros filtros-tareas">
              {["Todas", "Hoy", "Esta semana", "Vencidas"].map((v) => <button key={v} className={`filtro-chip ${vistaTareas === v ? "filtro-chip-activo" : ""}`} onClick={() => setVistaTareas(v)}>{v}</button>)}
            </div>
            <ul className="lista-tareas">
              {tareasVisibles
                .slice()
                .sort((a, b) => {
                  if (a.completada !== b.completada) return a.completada ? 1 : -1;
                  const prioridad = { Alta: 0, Media: 1, Baja: 2 };
                  if (prioridad[a.prioridad] !== prioridad[b.prioridad]) return (prioridad[a.prioridad] ?? 1) - (prioridad[b.prioridad] ?? 1);
                  if (!a.fecha && !b.fecha) return 0;
                  if (!a.fecha) return 1;
                  if (!b.fecha) return -1;
                  return a.fecha < b.fecha ? -1 : 1;
                })
                .map((t) => {
                  const subt = t.subtareas || [];
                  const hechas = subt.filter((s) => s.completada).length;
                  const expandida = tareasExpandidas.has(t.id);
                  return (
                    <li key={t.id} className={t.completada ? "tarea-completada" : ""}>
                      <div className="tarea-fila">
                        <button
                          className="tarea-check"
                          onClick={() => toggleTarea(t.id)}
                          title={t.recurrencia ? "Marcar esta vuelta como hecha" : t.completada ? "Marcar como pendiente" : "Marcar como hecha"}
                        >
                          {t.completada ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                        <div className="tarea-texto">
                          <div className="tarea-titulo-fila">
                            <strong>{t.titulo}</strong>
                            <span className={`tarea-prioridad tarea-prioridad-${(t.prioridad || "Media").toLowerCase()}`}>{t.prioridad || "Media"}</span>
                            {subt.length > 0 && <span className="tarea-progreso">{hechas}/{subt.length}</span>}
                            {t.recurrencia && (
                              <span className="tarea-recurrente" title={`Se repite todos los ${pluralDia(t.recurrencia.diaSemana).toLowerCase()}`}>
                                <Repeat size={11} /> {pluralDia(t.recurrencia.diaSemana)}
                              </span>
                            )}
                          </div>
                          {t.descripcion && <span className="tarea-descripcion">{t.descripcion}</span>}
                          {(t.etiquetas || []).length > 0 && <span className="tarea-etiquetas">{t.etiquetas.map((e) => <em key={e}>#{e}</em>)}</span>}
                          {t.fecha && (
                            <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(t.fecha)}`}>{textoUrgencia(t.fecha)}</span>
                          )}
                        </div>
                        <IconBtn
                          icon={expandida ? ChevronDown : ChevronRight}
                          title={expandida ? "Ocultar subtareas" : "Subtareas"}
                          onClick={() => toggleExpandirTarea(t.id)}
                        />
                        {t.archivo && <a className="icon-btn" href={t.archivo} download={t.archivoNombre || t.titulo} title={`Descargar ${t.archivoNombre || "adjunto"}`}><Paperclip size={15} /></a>}
                        <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => pedirEliminarTarea(t)} />
                      </div>

                      {expandida && (
                        <div className="subtareas-panel">
                          {subt.length > 0 && (
                            <ul className="subtareas-lista">
                              {subt.map((s) => (
                                <li key={s.id} className={s.completada ? "subtarea-hecha" : ""}>
                                  <button className="tarea-check tarea-check-chico" onClick={() => toggleSubtarea(t.id, s.id)}>
                                    {s.completada ? <CheckSquare size={14} /> : <Square size={14} />}
                                  </button>
                                  <div className="subtarea-texto">
                                    <strong>{s.texto}</strong>
                                  </div>
                                  <IconBtn icon={Trash2} title="Eliminar subtarea" danger onClick={() => delSubtarea(t.id, s.id)} />
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="subtareas-agregar">
                            <input
                              value={subtareaTexto[t.id] || ""}
                              onChange={(e) => setSubtareaTexto((s) => ({ ...s, [t.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtarea(t.id); } }}
                              placeholder="Ej: leer consigna"
                            />
                            <button className="btn-secundario btn-chico" onClick={() => addSubtarea(t.id)}>
                              <Plus size={13} /> Agregar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              {tareas.length === 0 && <p className="muted">No tenés tareas pendientes en esta materia.</p>}
              {tareas.length > 0 && tareasVisibles.length === 0 && <p className="muted">No hay tareas en esta vista.</p>}
              {tareas.length > 0 && tareasPendientesCount === 0 && !mostrarCompletadas && (
                <p className="muted">Completaste todas tus tareas de esta materia. 🎉</p>
              )}
            </ul>
            {tareasCompletadasCount > 0 && (
              <button className="link-btn" onClick={() => setMostrarCompletadas((v) => !v)}>
                {mostrarCompletadas ? "Ocultar completadas" : `Mostrar completadas (${tareasCompletadasCount})`}
              </button>
            )}
            <button className="btn-agregar-ancho" onClick={() => setTareaModalAbierto(true)}>
              <Plus size={16} /> Agregar tarea
            </button>
          </div>
        )}

        {tareaModalAbierto && (
          <Modal title="Nueva tarea" onClose={() => setTareaModalAbierto(false)}>
            <div className="form-grid">
              <label className="campo campo-full">
                <span>Nombre</span>
                <input
                  value={nuevaTarea.titulo}
                  onChange={(e) => setNuevaTarea((t) => ({ ...t, titulo: e.target.value }))}
                  placeholder="Ej: Entregar TP2"
                  autoFocus
                />
              </label>
              <label className="campo campo-full">
                <span>Qué hay que hacer</span>
                <textarea
                  rows={3}
                  value={nuevaTarea.descripcion}
                  onChange={(e) => setNuevaTarea((t) => ({ ...t, descripcion: e.target.value }))}
                  placeholder="Detalle de la tarea (opcional)"
                />
              </label>
              <label className="campo campo-full">
                <span>Fecha de entrega</span>
                <input
                  type="date"
                  value={nuevaTarea.fecha}
                  onChange={(e) => setNuevaTarea((t) => ({ ...t, fecha: e.target.value }))}
                  disabled={nuevaTarea.recurrencia !== ""}
                />
              </label>
              <label className="campo">
                <span>Prioridad</span>
                <select value={nuevaTarea.prioridad} onChange={(e) => setNuevaTarea((t) => ({ ...t, prioridad: e.target.value }))}>
                  <option>Alta</option><option>Media</option><option>Baja</option>
                </select>
              </label>
              <label className="campo">
                <span>Etiquetas</span>
                <input value={nuevaTarea.etiquetas} onChange={(e) => setNuevaTarea((t) => ({ ...t, etiquetas: e.target.value }))} placeholder="TP, lectura" />
              </label>
              <div className="campo campo-full">
                <span>Adjunto</span>
                {nuevaTarea.archivo ? <span className="adjuntar-archivo-nombre"><Paperclip size={13} /> {nuevaTarea.archivoNombre}<button type="button" onClick={() => setNuevaTarea((t) => ({ ...t, archivo: "", archivoNombre: "", archivoTipo: "" }))}><X size={13} /></button></span> : <button type="button" className="btn-secundario btn-chico" onClick={() => tareaArchivoRef.current?.click()}><Paperclip size={14} /> Adjuntar archivo</button>}
                <input ref={tareaArchivoRef} type="file" hidden onChange={(e) => cargarArchivoTarea(e.target.files?.[0])} />
              </div>
              <label className="campo campo-full">
                <span>Repetir</span>
                <select
                  value={nuevaTarea.recurrencia}
                  onChange={(e) => setNuevaTarea((t) => ({ ...t, recurrencia: e.target.value }))}
                >
                  <option value="">No se repite</option>
                  {DIAS_SEMANA_NOMBRE.map((_, i) => (
                    <option key={i} value={i}>Todos los {pluralDia(i).toLowerCase()}</option>
                  ))}
                </select>
                {nuevaTarea.recurrencia !== "" && (
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 11.5 }}>
                    Al marcarla como hecha, salta sola a la semana siguiente en vez de quedar tildada para siempre.
                  </p>
                )}
              </label>
            </div>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setTareaModalAbierto(false)}>Cancelar</button>
              <button className="btn-primario" onClick={addTarea}>Agregar</button>
            </div>
          </Modal>
        )}

        {tareaAEliminar && (
          <Modal title="Eliminar tarea" onClose={() => setTareaAEliminar(null)}>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>
              ¿Seguro que querés eliminar <strong>{tareaAEliminar.titulo}</strong>
              {(tareaAEliminar.subtareas || []).length > 0
                ? ` y sus ${tareaAEliminar.subtareas.length} subtarea${tareaAEliminar.subtareas.length === 1 ? "" : "s"}`
                : ""}
              ? No se puede deshacer.
            </p>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setTareaAEliminar(null)}>Cancelar</button>
              <button className="btn-peligro" onClick={confirmarEliminarTarea}>Sí, eliminar</button>
            </div>
          </Modal>
        )}

        {tab === "asistencia" && (
          <div className="tab-panel">
            <div className="asistencia-resumen">
              <div className="asistencia-aro">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line)" strokeWidth="7" />
                  {asistenciaPct !== null && (
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke={asistenciaPct >= asistenciaMinima ? "#6FB37E" : asistenciaPct >= asistenciaMinima - 15 ? "var(--ochre)" : "var(--brick)"}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${(asistenciaPct / 100) * 213.6} 213.6`}
                      transform="rotate(-90 40 40)"
                    />
                  )}
                </svg>
                <div className="asistencia-aro-texto">
                  <strong>{asistenciaPct !== null ? `${Math.round(asistenciaPct)}%` : "—"}</strong>
                </div>
              </div>
              <div className="asistencia-datos">
                <p className={`asistencia-estado ${asistenciaPct !== null && asistenciaPct < asistenciaMinima ? "asistencia-estado-riesgo" : ""}`}>
                  {asistenciaPct === null
                    ? "Cargá el período de cursada para calcular tu asistencia."
                    : asistenciaPct >= asistenciaMinima
                    ? "Vas bien de asistencia."
                    : `Estás por debajo del mínimo configurado (${asistenciaMinima}%).`}
                </p>
                {totalClases !== null && (
                  <span className="muted">
                    {asistencia.faltas} {asistencia.faltas === 1 ? "falta" : "faltas"} de {totalClases} clases totales
                    {faltasDisponibles !== null && (
                      faltasDisponibles >= 0
                        ? ` · podés faltar ${faltasDisponibles} ${faltasDisponibles === 1 ? "vez" : "veces"} más`
                        : ` · superaste el máximo de faltas`
                    )}
                  </span>
                )}
                {faltasDisponibles !== null && (faltasDisponibles === 1 || faltasDisponibles === 2) && (
                  <span className="asistencia-alerta-chica">
                    ⚠️ Te quedan solo {faltasDisponibles} {faltasDisponibles === 1 ? "falta disponible" : "faltas disponibles"}.
                  </span>
                )}
              </div>
            </div>

            {(!asistencia.inicioCursada || !asistencia.finCursada) ? (
              <p className="asistencia-periodo-ayuda muted">
                Todavía no cargaste el período de cursada de esta materia — con esas fechas, la app calcula sola cuántas
                clases hay en total. Se carga en{" "}
                <button type="button" className="asistencia-editar-link" onClick={onEdit}>Editar materia</button>.
              </p>
            ) : (
              <p className="asistencia-periodo-ayuda muted">
                Período: {fmtFechaCorta(asistencia.inicioCursada)} — {fmtFechaCorta(asistencia.finCursada)}.{" "}
                <button type="button" className="asistencia-editar-link" onClick={onEdit}>Cambiar</button>
              </p>
            )}

            <div className="asistencia-stepper">
              <button
                className="asistencia-stepper-btn"
                onClick={restarFalta}
                disabled={asistencia.faltas === 0}
                aria-label="Quitar falta"
              >
                <Minus size={18} />
              </button>
              <div className="asistencia-stepper-num">
                <strong>{asistencia.faltas}</strong>
                <span>{asistencia.faltas === 1 ? "falta" : "faltas"}</span>
              </div>
              <button
                className="asistencia-stepper-btn asistencia-stepper-btn-sumar"
                onClick={sumarFalta}
                aria-label="Sumar falta"
              >
                <Plus size={18} />
              </button>
            </div>
            {asistencia.faltas > 0 && (
              <button type="button" className="asistencia-reset-link" onClick={resetFaltas}>Reiniciar faltas</button>
            )}
          </div>
        )}

        {tab === "examenes" && (
          <div className="tab-panel">
            <div className="promedio-card">
              <span className="muted">Promedio de la materia</span>
              <strong>{promedio !== null ? promedio.toFixed(2) : "—"}</strong>
            </div>
            {(() => { const conNota = examenes.filter((e) => e.nota !== null && e.nota !== undefined && e.nota !== ""); const sinNota = examenes.filter((e) => e.nota === null || e.nota === undefined || e.nota === ""); const suma = conNota.reduce((a, e) => a + Number(e.nota), 0); const necesaria = sinNota.length ? Math.max(0, 7 * (conNota.length + 1) - suma) : null; return necesaria !== null && <p className="meta-promocion">Para un promedio de <strong>7</strong>, necesitás al menos <strong>{necesaria.toFixed(1)}</strong> en la próxima instancia evaluable.</p>; })()}
            <ul className="lista-examenes">
              {examenesOrdenados.map((e) => (
                <li key={e.id}>
                  <span className="chip-tipo" style={{ "--tc": TIPO_EXAMEN_COLOR[e.tipo] }}>{e.tipo}</span>
                  <span className="lista-examenes-titulo"><strong>{e.titulo}</strong>{(e.modalidad || e.aula || e.temario) && <small>{[e.modalidad, e.aula, e.temario].filter(Boolean).join(" · ")}</small>}{e.enlace && <a href={e.enlace} target="_blank" rel="noreferrer">Abrir enlace</a>}</span>
                  {modoEdicionExamenes ? (
                    <>
                      <input
                        className="lista-examenes-fecha"
                        type="date"
                        value={e.fecha || ""}
                        onChange={(ev) => updFechaExamen(e.id, ev.target.value)}
                        title="Fecha"
                      />
                      <input
                        className="lista-examenes-nota"
                        type="number" min="0" max="10" step="0.1"
                        value={e.nota ?? ""}
                        placeholder="Nota"
                        onChange={(ev) => updNotaExamen(e.id, ev.target.value)}
                      />
                      <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => delExamen(e.id)} />
                    </>
                  ) : (
                    <>
                      <span className="lista-examenes-fecha-texto muted">{e.fecha ? fmtFechaCorta(e.fecha) : ""}</span>
                      <span className="lista-examenes-nota-texto">{e.nota ?? "—"}</span>
                    </>
                  )}
                </li>
              ))}
              {examenes.length === 0 && <p className="muted">Todavía no cargaste trabajos ni exámenes.</p>}
            </ul>
            <div className="examenes-botones-fila">
              <button className="btn-agregar-ancho" onClick={() => setExamenModalAbierto(true)}>
                <Plus size={16} /> Agregar examen
              </button>
              {examenes.length > 0 && (
                <button className="btn-agregar-ancho" onClick={() => setModoEdicionExamenes((v) => !v)}>
                  {modoEdicionExamenes ? (<><Check size={16} /> Listo</>) : (<><Pencil size={16} /> Modificar</>)}
                </button>
              )}
            </div>
          </div>
        )}

        {examenModalAbierto && (
          <Modal title="Nuevo trabajo o examen" onClose={() => setExamenModalAbierto(false)}>
            <div className="form-grid">
              <label className="campo campo-full">
                <span>Tipo</span>
                <select
                  value={nuevoExamen.tipo}
                  onChange={(e) => setNuevoExamen((n) => ({ ...n, tipo: e.target.value, recuperaDe: "" }))}
                >
                  {TIPOS_EXAMEN.map((t) => (<option key={t.id} value={t.id}>{t.id}</option>))}
                </select>
              </label>

              {nuevoExamen.tipo === "Trabajo práctico" && (
                <label className="campo campo-full">
                  <span>Título</span>
                  <input
                    value={nuevoExamen.titulo}
                    onChange={(e) => setNuevoExamen((n) => ({ ...n, titulo: e.target.value }))}
                    placeholder="Ej: TP2 - Base de datos"
                    autoFocus
                  />
                </label>
              )}

              {nuevoExamen.tipo === "Recuperatorio" && (
                <label className="campo campo-full">
                  <span>¿Qué parcial recupera?</span>
                  <select
                    value={nuevoExamen.recuperaDe}
                    onChange={(e) => setNuevoExamen((n) => ({ ...n, recuperaDe: e.target.value }))}
                  >
                    <option value="">Elegir…</option>
                    <option value="Primer parcial">Primer parcial</option>
                    <option value="Segundo parcial">Segundo parcial</option>
                  </select>
                </label>
              )}

              {(nuevoExamen.tipo === "Parcial" || (nuevoExamen.tipo === "Recuperatorio" && nuevoExamen.recuperaDe) || nuevoExamen.tipo === "Final" || nuevoExamen.tipo === "Otro") && (
                <p className="muted campo-full" style={{ margin: "-6px 0 0", fontSize: 12.5 }}>
                  Se va a guardar como: <strong>{tituloAutomaticoExamen(nuevoExamen, examenes)}</strong>
                </p>
              )}

              <label className="campo campo-full">
                <span>Nota (opcional)</span>
                <input
                  type="number" min="0" max="10" step="0.1"
                  value={nuevoExamen.nota}
                  onChange={(e) => setNuevoExamen((n) => ({ ...n, nota: e.target.value }))}
                  placeholder="Ej: 8"
                />
              </label>
              <label className="campo campo-full">
                <span>Fecha (opcional)</span>
                <input
                  type="date"
                  value={nuevoExamen.fecha}
                  onChange={(e) => setNuevoExamen((n) => ({ ...n, fecha: e.target.value }))}
                />
              </label>
              <label className="campo">
                <span>Modalidad</span>
                <select value={nuevoExamen.modalidad} onChange={(e) => setNuevoExamen((n) => ({ ...n, modalidad: e.target.value }))}><option value="">Sin definir</option><option>Presencial</option><option>Virtual</option><option>Oral</option><option>Escrito</option></select>
              </label>
              <label className="campo">
                <span>Aula o lugar</span>
                <input value={nuevoExamen.aula} onChange={(e) => setNuevoExamen((n) => ({ ...n, aula: e.target.value }))} placeholder="Aula 101" />
              </label>
              <label className="campo campo-full">
                <span>Enlace (opcional)</span>
                <input type="url" value={nuevoExamen.enlace} onChange={(e) => setNuevoExamen((n) => ({ ...n, enlace: e.target.value }))} placeholder="https://…" />
              </label>
              <label className="campo campo-full">
                <span>Temario / materiales permitidos</span>
                <textarea rows={3} value={nuevoExamen.temario} onChange={(e) => setNuevoExamen((n) => ({ ...n, temario: e.target.value }))} placeholder="Unidades, consignas, materiales…" />
              </label>
            </div>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setExamenModalAbierto(false)}>Cancelar</button>
              <button
                className="btn-primario"
                disabled={!tituloAutomaticoExamen(nuevoExamen, examenes).trim()}
                onClick={addExamen}
              >
                Agregar
              </button>
            </div>
          </Modal>
        )}

        {tab === "recursos" && (
          <div className="tab-panel">
            <ul className="lista-recursos">
              {materia.recursos.map((r) => {
                const Icon = recursoIcon(r.tipo);
                return (
                  <li key={r.id}>
                    <Icon size={16} />
                    <div className="lista-recursos-texto">
                      <strong>{r.nombre}</strong>
                      <span className="muted">{r.tipo}{r.archivo ? " · archivo adjunto" : ""}</span>
                    </div>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="icon-btn" title="Abrir enlace">
                        <LinkIcon size={15} />
                      </a>
                    )}
                    {r.archivo && (r.archivoTipo === "application/pdf" || r.archivoTipo?.startsWith("image/")) && (
                      <IconBtn icon={Eye} title="Ver archivo" onClick={() => setPreviewArchivo(r)} />
                    )}
                    {r.archivo && (
                      <a href={r.archivo} download={r.archivoNombre || r.nombre} className="icon-btn" title="Descargar archivo">
                        <Download size={15} />
                      </a>
                    )}
                    <IconBtn icon={Trash2} title="Quitar" danger onClick={() => delRecurso(r.id)} />
                  </li>
                );
              })}
              {materia.recursos.length === 0 && <p className="muted">Todavía no agregaste recursos.</p>}
            </ul>
            <button className="btn-agregar-ancho" onClick={() => setRecursoModalAbierto(true)}>
              <Plus size={16} /> Agregar recurso
            </button>
          </div>
        )}

        {recursoModalAbierto && (
          <Modal title="Nuevo recurso" onClose={() => setRecursoModalAbierto(false)}>
            <div className="form-grid">
              <label className="campo campo-full">
                <span>Tipo</span>
                <select value={nuevoRecurso.tipo} onChange={(e) => setNuevoRecurso((r) => ({ ...r, tipo: e.target.value }))}>
                  {RECURSO_TIPOS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </label>
              <label className="campo campo-full">
                <span>Nombre</span>
                <input
                  value={nuevoRecurso.nombre}
                  onChange={(e) => setNuevoRecurso((r) => ({ ...r, nombre: e.target.value }))}
                  placeholder="Nombre del recurso"
                  autoFocus
                />
              </label>
              <label className="campo campo-full">
                <span>URL (opcional)</span>
                <input
                  value={nuevoRecurso.url}
                  onChange={(e) => setNuevoRecurso((r) => ({ ...r, url: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <div className="campo campo-full">
                <span>Archivo (opcional)</span>
                <div className="adjuntar-archivo">
                  <label className="btn-secundario btn-chico adjuntar-archivo-btn">
                    <Paperclip size={14} /> Adjuntar archivo
                    <input type="file" hidden onChange={(e) => subirArchivoRecurso(e.target.files?.[0])} />
                  </label>
                  {nuevoRecurso.archivoNombre && (
                    <span className="adjuntar-archivo-nombre">
                      {nuevoRecurso.archivoNombre}
                      <button type="button" onClick={quitarArchivoRecurso} title="Quitar archivo"><X size={12} /></button>
                    </span>
                  )}
                </div>
                <span className="adjuntar-archivo-ayuda">Sin límite de tamaño fijo, pero si el archivo es muy pesado el guardado puede fallar — si eso pasa, mejor usá un link de Drive.</span>
                {errorArchivo && <p className="adjuntar-archivo-error">{errorArchivo}</p>}
              </div>
            </div>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setRecursoModalAbierto(false)}>Cancelar</button>
              <button className="btn-primario" onClick={addRecurso}>Agregar</button>
            </div>
          </Modal>
        )}

        {previewArchivo && (
          <div className="visor-overlay">
            <div className="visor-barra">
              <button className="volver" onClick={() => setPreviewArchivo(null)}>
                <ArrowLeft size={18} /> Volver
              </button>
              <span className="visor-nombre">{previewArchivo.archivoNombre || previewArchivo.nombre}</span>
              <IconBtn icon={X} title="Cerrar" onClick={() => setPreviewArchivo(null)} />
            </div>
            <div className="visor-contenido">
              {previewArchivo.archivoTipo === "application/pdf" ? (
                <iframe src={previewArchivo.archivo} title="Vista previa del PDF" className="visor-pdf-full" />
              ) : previewArchivo.archivoTipo?.startsWith("image/") ? (
                <img src={previewArchivo.archivo} alt={previewArchivo.archivoNombre || previewArchivo.nombre} className="visor-imagen-full" />
              ) : (
                <p className="muted" style={{ padding: 24 }}>No hay vista previa disponible para este tipo de archivo.</p>
              )}
            </div>
          </div>
        )}

        {tab === "resumenes" && (
          <div className="tab-panel resumenes-layout">
            <div className="resumenes-lista">
              {materia.resumenes.map((r) => (
                <div key={r.id} className={`resumen-item ${resumenActivo === r.id ? "resumen-item-activo" : ""}`}>
                  <button className="resumen-item-btn" onClick={() => setResumenActivo(r.id)}>{r.titulo || "Sin título"}</button>
                  <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => delResumen(r.id)} />
                </div>
              ))}
              <button className="btn-agregar-ancho btn-agregar-ancho-chico" onClick={addResumen}><Plus size={16} /> Nuevo resumen</button>
            </div>
            <div className="resumen-contenido">
              {resumen ? (
                <>
                  <input
                    className="resumen-titulo-input"
                    value={resumen.titulo}
                    onChange={(e) => updResumenTitulo(resumen.id, e.target.value)}
                  />
                  {resumen.bloques.map((b) => (
                    <BloqueResumen
                      key={b.id}
                      bloque={b}
                      onChange={(nb) => updBloque(resumen.id, nb)}
                      onDelete={() => delBloque(resumen.id, b.id)}
                    />
                  ))}
                  <div className="bloque-agregar">
                    <button className="btn-agregar-ancho" onClick={() => addBloque(resumen.id, "texto")}>
                      <Type size={16} /> Bloque de texto
                    </button>
                    <button className="btn-agregar-ancho" onClick={() => addBloque(resumen.id, "imagen")}>
                      <ImageIcon size={16} /> Bloque de imagen
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">Elegí un resumen o creá uno nuevo.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MAPA DE CORRELATIVAS
   ========================================================================= */

const MAPA_NODO_W = 190;
const MAPA_NODO_H = 56;
const MAPA_COL_GAP = 86;
const MAPA_ROW_GAP = 18;
const MAPA_PAD = 24;
const MAPA_HEADER_H = 34;

// Clasifica cada materia en el mapa según su situación real de correlativas,
// que es lo que importa acá (no el detalle de si está Cursando o Regular):
//  - "aprobada": ya la tenés aprobada.
//  - "habilitada": no está aprobada todavía, pero ya cumplís todo lo que pide.
//  - "bloqueada": le falta aprobar alguna correlativa.
function estadoMapaNodo(m, materias) {
  if (m.estado === "Aprobada") return "aprobada";
  return calcularCorrelativasPendientes(m, materias).length === 0 ? "habilitada" : "bloqueada";
}
const MAPA_NODO_COLOR = {
  aprobada: "#6FB37E",
  habilitada: "#A49F90",
  bloqueada: "#BF8C7C",
};

// Agrupa las materias por año (columna) y decide en qué fila va cada una
// dentro de su columna. En vez de dejarlas en el orden en que se cargaron
// (lo que hacía que las líneas de correlativas subieran y bajaran sin
// ningún criterio), cada materia intenta ubicarse en la misma fila que su
// correlativa —o el promedio de filas, si depende de varias—. Así, una
// cadena de materias consecutivas (Derecho I → Derecho II → Derecho del
// Trabajo...) tiende a quedar en línea recta en vez de zigzagueando.
//
// Es el método de "baricentro" que se usa para acomodar grafos por capas:
// se hacen varias pasadas de izquierda a derecha (cada materia mira el
// promedio de fila de sus correlativas, que están en columnas anteriores) y
// de derecha a izquierda (cada materia mira el promedio de fila de las
// materias que la requieren, en columnas posteriores), repitiendo un par de
// veces para que la cadena completa se termine de acomodar, no solo el año
// inmediato anterior.
function ordenarMateriasParaMapa(materias) {
  const porAnio = new Map();
  materias.forEach((m) => {
    const key = m.anio || 0;
    if (!porAnio.has(key)) porAnio.set(key, []);
    porAnio.get(key).push(m);
  });
  const anios = [...porAnio.keys()].sort((a, b) => a - b);

  // Orden de partida: el de carga, como antes (sirve de desempate estable).
  const filaPorId = {};
  anios.forEach((anio) => {
    porAnio.get(anio).forEach((m, i) => { filaPorId[m.id] = i; });
  });

  // Quién requiere a cada materia (el sentido inverso de "correlativas").
  const requeridaPor = new Map();
  materias.forEach((m) => {
    (m.correlativas || []).forEach((reqId) => {
      if (!requeridaPor.has(reqId)) requeridaPor.set(reqId, []);
      requeridaPor.get(reqId).push(m.id);
    });
  });

  const ordenarColumna = (anio, mirarCorrelativas) => {
    const items = porAnio.get(anio);
    const conPuntaje = items.map((m, i) => {
      const vecinos = mirarCorrelativas ? (m.correlativas || []) : (requeridaPor.get(m.id) || []);
      const filas = vecinos.map((id) => filaPorId[id]).filter((v) => v !== undefined);
      const puntaje = filas.length > 0 ? filas.reduce((a, b) => a + b, 0) / filas.length : i;
      return { m, puntaje, i };
    });
    conPuntaje.sort((a, b) => a.puntaje - b.puntaje || a.i - b.i);
    conPuntaje.forEach((x, idx) => { filaPorId[x.m.id] = idx; });
    porAnio.set(anio, conPuntaje.map((x) => x.m));
  };

  for (let pasada = 0; pasada < 3; pasada++) {
    anios.forEach((anio) => ordenarColumna(anio, true));
    [...anios].reverse().forEach((anio) => ordenarColumna(anio, false));
  }

  return anios.map((anio) => [anio, porAnio.get(anio)]);
}

function MapaMaterias({ materias, abrirMateria }) {
  const columnas = useMemo(() => {

    return ordenarMateriasParaMapa(materias);
  }, [materias]);

  const posiciones = useMemo(() => {
    const map = {};
    columnas.forEach(([, items], colIdx) => {
      items.forEach((m, rowIdx) => {
        map[m.id] = {
          x: MAPA_PAD + colIdx * (MAPA_NODO_W + MAPA_COL_GAP),
          y: MAPA_PAD + MAPA_HEADER_H + rowIdx * (MAPA_NODO_H + MAPA_ROW_GAP),
        };
      });
    });
    return map;
  }, [columnas]);

  // Siempre se dibuja la línea entre una materia y su correlativa, para que
  // se note la relación aunque todavía no esté cumplida: verde si la
  // correlativa ya está aprobada (el "camino recorrido"), gris punteada si
  // todavía falta aprobarla.
  const lineas = useMemo(() => {
    const out = [];
    materias.forEach((m) => {
      const destino = posiciones[m.id];
      if (!destino) return;
      (m.correlativas || []).forEach((reqId) => {
        const req = materias.find((x) => x.id === reqId);
        if (!req) return;
        const origen = posiciones[req.id];
        if (!origen) return;
        const x1 = origen.x + MAPA_NODO_W;
        const y1 = origen.y + MAPA_NODO_H / 2;
        const x2 = destino.x;
        const y2 = destino.y + MAPA_NODO_H / 2;
        const midX = (x1 + x2) / 2;
        out.push({
          id: `${req.id}-${m.id}`,
          d: `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`,
          cumplida: req.estado === "Aprobada",
        });
      });
    });
    return out;
  }, [materias, posiciones]);

  // Quién requiere a cada materia (el sentido inverso de "correlativas"),
  // para poder subir y bajar por toda la cadena a partir de cualquier nodo.
  const requeridaPor = useMemo(() => {
    const map = new Map();
    materias.forEach((m) => {
      (m.correlativas || []).forEach((reqId) => {
        if (!map.has(reqId)) map.set(reqId, []);
        map.get(reqId).push(m.id);
      });
    });
    return map;
  }, [materias]);

  // Al pasar el mouse por una materia, se arma toda su cadena: para atrás
  // (todo lo que necesitó, directa o indirectamente, para llegar hasta acá)
  // y para adelante (todo lo que esta materia habilita más adelante). El
  // resto del mapa se atenúa, para poder seguir esa cadena sin que compita
  // visualmente con el resto de líneas cruzadas.
  const [hoverId, setHoverId] = useState(null);
  const cadena = useMemo(() => {
    if (!hoverId) return null;
    const materiaPorId = new Map(materias.map((m) => [m.id, m]));
    const nodos = new Set([hoverId]);
    const aristas = new Set();

    const pilaArriba = [hoverId];
    while (pilaArriba.length) {
      const actual = pilaArriba.pop();
      (materiaPorId.get(actual)?.correlativas || []).forEach((reqId) => {
        if (!materiaPorId.has(reqId)) return;
        aristas.add(`${reqId}-${actual}`);
        if (!nodos.has(reqId)) { nodos.add(reqId); pilaArriba.push(reqId); }
      });
    }

    const pilaAbajo = [hoverId];
    while (pilaAbajo.length) {
      const actual = pilaAbajo.pop();
      (requeridaPor.get(actual) || []).forEach((depId) => {
        aristas.add(`${actual}-${depId}`);
        if (!nodos.has(depId)) { nodos.add(depId); pilaAbajo.push(depId); }
      });
    }

    return { nodos, aristas };
  }, [hoverId, materias, requeridaPor]);

  const salirDeNodo = (id) => setHoverId((h) => (h === id ? null : h));

  const maxFilas = Math.max(1, ...columnas.map(([, items]) => items.length));
  const anchoTotal = MAPA_PAD * 2 + columnas.length * MAPA_NODO_W + Math.max(0, columnas.length - 1) * MAPA_COL_GAP;
  const altoTotal = MAPA_PAD * 2 + MAPA_HEADER_H + maxFilas * (MAPA_NODO_H + MAPA_ROW_GAP);

  if (materias.length === 0) {
    return <p className="muted" style={{ padding: 20 }}>Todavía no cargaste materias.</p>;
  }

  return (
    <div className="mapa-wrap">
      <div className="mapa-scroll">
        <div className={`mapa-lienzo ${cadena ? "mapa-lienzo-con-foco" : ""}`} style={{ width: anchoTotal, height: altoTotal }}>
          {columnas.map(([anio], colIdx) => (
            <div
              key={anio}
              className="mapa-col-titulo"
              style={{ left: MAPA_PAD + colIdx * (MAPA_NODO_W + MAPA_COL_GAP), width: MAPA_NODO_W }}
            >
              {anio === 0 ? "Sin año" : anioLabel(anio)}
            </div>
          ))}

          <svg className="mapa-svg" width={anchoTotal} height={altoTotal}>
            {lineas.map((l) => (
              <path
                key={l.id}
                d={l.d}
                fill="none"
                stroke={l.cumplida ? "#6FB37E" : "#CBC3A6"}
                strokeWidth={l.cumplida ? 2 : 1.5}
                strokeDasharray={l.cumplida ? "0" : "4 3"}
                className={`mapa-linea ${cadena ? (cadena.aristas.has(l.id) ? "mapa-linea-foco" : "mapa-linea-atenuada") : ""}`}
              />
            ))}
          </svg>

          {materias.map((m) => {
            const pos = posiciones[m.id];
            if (!pos) return null;
            const estadoNodo = estadoMapaNodo(m, materias);
            const enFoco = cadena ? cadena.nodos.has(m.id) : true;
            return (
              <button
                key={m.id}
                className={`mapa-nodo ${estadoNodo === "bloqueada" ? "mapa-nodo-bloqueada" : ""} ${!enFoco ? "mapa-nodo-atenuado" : ""} ${m.id === hoverId ? "mapa-nodo-activo" : ""}`}
                style={{
                  left: pos.x, top: pos.y, width: MAPA_NODO_W, height: MAPA_NODO_H,
                  "--sc": MAPA_NODO_COLOR[estadoNodo], "--mc": m.color,
                }}
                onClick={() => abrirMateria(m.id)}
                onMouseEnter={() => setHoverId(m.id)}
                onMouseLeave={() => salirDeNodo(m.id)}
                onFocus={() => setHoverId(m.id)}
                onBlur={() => salirDeNodo(m.id)}
                title={m.nombre}
              >
                <span className="mapa-nodo-dot" />
                {estadoNodo === "bloqueada" && <Lock size={11} className="mapa-nodo-lock" />}
                <span className="mapa-nodo-nombre">{m.nombre}</span>
                <span className="mapa-nodo-estado">{m.estado}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MateriasView({ materias, setMaterias, materiaAbiertaId, setMateriaAbiertaId, tabMateriaInicial, onAprobada, googleCal, asistenciaMinima }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState("Cursando");
  const [vistaAnio, setVistaAnio] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState("lista"); // "lista" | "mapa"
  const [materiaAEliminar, setMateriaAEliminar] = useState(null);
  const [sincronizandoMateria, setSincronizandoMateria] = useState(false);

  const materiaAbierta = materias.find((m) => m.id === materiaAbiertaId);

  const guardarMateria = async (m) => {
    const existente = materias.find((x) => x.id === m.id);
    const pasaAAprobada = m.estado === "Aprobada" && (!existente || existente.estado !== "Aprobada");
    let final = pasaAAprobada ? { ...m, fechaAprobada: toDateStr(new Date()) } : m;

    // Si hay horario y fecha de inicio de cursada cargados, y estás
    // conectado con Google Calendar, se crea/actualiza automáticamente un
    // evento semanal recurrente por cada horario de la materia.
    setSincronizandoMateria(true);
    try {
      final = await sincronizarHorariosConCalendario(googleCal, existente, final);
    } finally {
      setSincronizandoMateria(false);
    }

    if (pasaAAprobada) onAprobada?.();
    setMaterias((prev) => (existente ? prev.map((x) => (x.id === m.id ? final : x)) : [...prev, final]));
    setFormAbierto(false);
    setEditando(null);
  };

  const pedirEliminar = (id) => {
    const m = materias.find((x) => x.id === id);
    setMateriaAEliminar({ id, nombre: m ? m.nombre : "" });
  };

  const confirmarEliminar = () => {
    if (!materiaAEliminar) return;
    const materia = materias.find((m) => m.id === materiaAEliminar.id);
    // Best-effort: borramos también los eventos de Calendar que hubieran
    // quedado vinculados (horarios recurrentes y exámenes). Si falla algo acá
    // no bloqueamos el borrado local — la materia se borra igual.
    const { accessToken, calendarId } = googleCal || {};
    if (materia && accessToken && calendarId) {
      const idsEventos = [
        ...(materia.horarios || []).map((h) => h.googleEventId),
        ...(materia.examenes || []).map((e) => e.googleEventId),
      ].filter(Boolean);
      idsEventos.forEach((eventId) => {
        apiEliminarEvento(accessToken, calendarId, eventId).catch(() => {});
      });
    }
    setMaterias((prev) => prev.filter((m) => m.id !== materiaAEliminar.id));
    setMateriaAbiertaId(null);
    setMateriaAEliminar(null);
  };

  const abrirEdicion = (m) => { setEditando(m); setFormAbierto(true); };

  const cambiarEstado = (id, nuevoEstado) => {
    setMaterias((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const pasaAAprobada = nuevoEstado === "Aprobada" && m.estado !== "Aprobada";
      if (pasaAAprobada) onAprobada?.();
      return { ...m, estado: nuevoEstado, fechaAprobada: pasaAAprobada ? toDateStr(new Date()) : m.fechaAprobada };
    }));
  };

  const filtradasEstado = filtro === "Todas" ? materias : materias.filter((m) => m.estado === filtro);
  const termino = busqueda.trim().toLowerCase();
  const filtradas = termino
    ? filtradasEstado.filter((m) => m.nombre.toLowerCase().includes(termino) || (m.profesor || "").toLowerCase().includes(termino))
    : filtradasEstado;

  const aniosPresentes = useMemo(() => {
    const set = new Set(filtradas.map((m) => m.anio || 0));
    return [...set].sort((a, b) => a - b);
  }, [filtradas]);

  useEffect(() => {
    if (vistaAnio !== "Todos" && !aniosPresentes.includes(vistaAnio)) setVistaAnio("Todos");
  }, [aniosPresentes, vistaAnio]);

  const grupos = useMemo(() => {
    const map = new Map();
    aniosPresentes.forEach((a) => map.set(a, []));
    filtradas.forEach((m) => {
      const key = m.anio || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return [...map.entries()];
  }, [filtradas, aniosPresentes]);

  const listaPlana = vistaAnio === "Todos" ? null : filtradas.filter((m) => (m.anio || 0) === vistaAnio);

  const filaProps = {
    materias,
    onOpen: setMateriaAbiertaId,
    onCambiarEstado: cambiarEstado,
    modo: filtro === "Todas" ? "historial" : "normal",
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Fichero</p>
          <h1>Materias</h1>
        </div>
        <button className="btn-primario" onClick={() => { setEditando(null); setFormAbierto(true); }}>
          <Plus size={16} /> Nueva materia
        </button>
      </header>

      <div className="materias-toolbar">
        <div className="buscador">
          <Search size={15} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar materia o docente…"
          />
          {busqueda && (
            <button className="buscador-limpiar" onClick={() => setBusqueda("")} title="Limpiar búsqueda">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="modo-toggle">
          <button className={modo === "lista" ? "modo-toggle-activo" : ""} onClick={() => setModo("lista")}>
            <List size={14} /> Lista
          </button>
          <button className={modo === "mapa" ? "modo-toggle-activo" : ""} onClick={() => setModo("mapa")}>
            <Network size={14} /> Mapa
          </button>
        </div>
      </div>

      {modo === "mapa" ? (
        <MapaMaterias materias={materias} abrirMateria={setMateriaAbiertaId} />
      ) : (
        <>
          <div className="filtros">
            {["Todas", "Cursando", "Pendiente", "Regular", "Aprobada"].map((f) => (
              <button key={f} className={`filtro-chip ${filtro === f ? "filtro-chip-activo" : ""}`} onClick={() => setFiltro(f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="lista-materias-panel">
            {vistaAnio === "Todos"
              ? grupos.map(([anio, items]) => items.length > 0 && (
                  <div key={anio} className="grupo-anio">
                    {aniosPresentes.length > 1 && (
                      <p className="grupo-anio-titulo">{anio === 0 ? "Sin año" : anioLabel(anio)}</p>
                    )}
                    {items.map((m) => (<FilaMateria key={m.id} m={m} {...filaProps} />))}
                  </div>
                ))
              : listaPlana.map((m) => (<FilaMateria key={m.id} m={m} {...filaProps} />))}
            {filtradas.length === 0 && <p className="muted lista-materias-vacia">No hay materias que coincidan.</p>}
          </div>
        </>
      )}

      {formAbierto && (
        <MateriaFormModal
          materia={editando}
          materias={materias}
          onSave={guardarMateria}
          onClose={() => { setFormAbierto(false); setEditando(null); }}
          onDelete={editando ? () => { const id = editando.id; setFormAbierto(false); setEditando(null); pedirEliminar(id); } : undefined}
          guardando={sincronizandoMateria}
        />
      )}

      {materiaAbierta && !formAbierto && (
        <MateriaDetalle
          materia={materiaAbierta}
          materias={materias}
          onUpdate={(m) => setMaterias((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
          onClose={() => setMateriaAbiertaId(null)}
          onEdit={() => { setEditando(materiaAbierta); setFormAbierto(true); }}
          googleCal={googleCal}
          asistenciaMinima={asistenciaMinima}
          tabInicial={tabMateriaInicial}
        />
      )}

      {materiaAEliminar && (
        <Modal title="Eliminar materia" onClose={() => setMateriaAEliminar(null)}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            ¿Seguro que querés eliminar <strong>{materiaAEliminar.nombre}</strong>? También se van a
            borrar sus tareas, exámenes, recursos y resúmenes. No se puede deshacer.
          </p>
          <div className="modal-acciones">
            <button className="btn-secundario" onClick={() => setMateriaAEliminar(null)}>Cancelar</button>
            <button className="btn-peligro" onClick={confirmarEliminar}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   HORARIO SEMANAL
   ========================================================================= */

/* =========================================================================
   CALENDARIO — Google Calendar embebido
   ========================================================================= */

function ConfigCalendarioModal({ valorInicial, onSave, onClose }) {
  const [valor, setValor] = useState(valorInicial);
  const idNormalizado = normalizarCalendarId(valor);
  const sePudoExtraer = valor.trim().startsWith("http") && idNormalizado && !idNormalizado.startsWith("http");

  return (
    <Modal title="Conectar tu Google Calendar" onClose={onClose} wide>
      <div className="form-grid">
        <label className="campo campo-full">
          <span>ID de calendario (o cualquier link de Google Calendar)</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="xxxxx@group.calendar.google.com"
            autoFocus
          />
        </label>
      </div>

      {valor.trim() && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: -8 }}>
          {idNormalizado
            ? <>Se va a guardar como: <strong>{idNormalizado}</strong>{sePudoExtraer ? " (extraído del link)" : ""}</>
            : "Pegá un ID o un link de Google Calendar."}
        </p>
      )}

      <div className="ayuda-calendario ayuda-calendario-aviso">
        <p className="ayuda-calendario-titulo">⚠️ Usá un calendario aparte, no tu cuenta personal</p>
        <p>
          Si pegás el ID de tu Gmail principal, para que se pueda mostrar acá tendrías que hacer
          <strong> público todo tu calendario personal</strong> (cualquiera con el link vería todos tus eventos).
          Mejor creá un calendario nuevo solo para la facultad y hacé público ese.
        </p>
      </div>

      <div className="ayuda-calendario">
        <p className="ayuda-calendario-titulo">¿Cómo lo creo y consigo el ID?</p>
        <ol>
          <li>En Google Calendar, al lado de <strong>"Otros calendarios"</strong>, tocá el <strong>+</strong> → <strong>"Crear un calendario nuevo"</strong> (ej: "Facultad").</li>
          <li>Cargá ahí tus parciales y entregas, en vez de en tu calendario principal.</li>
          <li>En los <strong>tres puntos</strong> junto al nombre del calendario nuevo → <strong>Configuración</strong>.</li>
          <li>En <strong>"Permisos de acceso"</strong> activá <strong>"Hacer disponible al público"</strong>.</li>
          <li>Bajá hasta <strong>"Integrar calendario"</strong> y copiá el <strong>ID de calendario</strong> (termina en @group.calendar.google.com).</li>
        </ol>
      </div>

      <div className="modal-acciones">
        <button className="btn-secundario" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" onClick={() => onSave(valor)}>Guardar</button>
      </div>
    </Modal>
  );
}

function ConfigGoogleClientModal({ valorInicial, usaBackend, onSave, onClose }) {
  const [valor, setValor] = useState(valorInicial);
  const [clientSecret, setClientSecret] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const clientIdLimpio = valor.trim();
  const clientSecretLimpio = clientSecret.trim();
  const puedeGuardar = usaBackend ? clientIdLimpio && clientSecretLimpio : clientIdLimpio;

  const guardar = async () => {
    setError("");
    if (!usaBackend) {
      onSave(clientIdLimpio);
      return;
    }
    setGuardando(true);
    try {
      const datos = await invocarGoogleCalendarAuth("save-credentials", {
        clientId: clientIdLimpio,
        clientSecret: clientSecretLimpio,
      });
      if (datos?.error) throw new Error(datos.error);
      onSave(clientIdLimpio);
    } catch (e) {
      setError(e.message || "No se pudieron guardar las credenciales.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title="Editar eventos desde la app" onClose={onClose} wide>
      <div className="form-grid">
        <label className="campo campo-full">
          <span>ID de cliente de OAuth (Google Cloud)</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="xxxxxxxxxx.apps.googleusercontent.com"
            autoFocus
          />
        </label>
        {usaBackend && (
          <label className="campo campo-full">
            <span>Client Secret (Google Cloud)</span>
            <input
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-…"
              type="password"
            />
          </label>
        )}
      </div>

      {error && <p role="alert" style={{ margin: "-8px 0 0", color: "#B5432E", fontSize: 13 }}>{error}</p>}

      {usaBackend ? (
        <div className="ayuda-calendario ayuda-calendario-aviso">
          <p className="ayuda-calendario-titulo">🔒 El Client Secret queda guardado del lado del servidor</p>
          <p>
            Se envía directo a una Edge Function de Supabase que lo guarda en una tabla protegida
            (no accesible desde el navegador). Con esto, la conexión con Google Calendar no depende
            de reconectar cada vez: se conecta una sola vez y queda.
          </p>
        </div>
      ) : (
        <div className="ayuda-calendario ayuda-calendario-aviso">
          <p className="ayuda-calendario-titulo">⚠️ Esto solo funciona en tu página publicada</p>
          <p>
            El login de Google necesita que el origen exacto de tu sitio (por ejemplo
            https://tu-proyecto.vercel.app) esté autorizado en Google Cloud. No va a funcionar acá
            en la vista previa de Claude, ni si copiás la app a otro dominio sin agregarlo también.
          </p>
        </div>
      )}

      <div className="ayuda-calendario">
        <p className="ayuda-calendario-titulo">¿Cómo consigo el ID de cliente{usaBackend ? " y el Client Secret" : ""}?</p>
        <ol>
          <li>Entrá a <strong>console.cloud.google.com</strong> y creá un proyecto (o usá uno existente).</li>
          <li>En el buscador de arriba, buscá <strong>"Google Calendar API"</strong> y tocá <strong>Habilitar</strong>.</li>
          <li>
            Andá a <strong>APIs y servicios → Pantalla de consentimiento de OAuth</strong>, elegí "Externo", completá el
            nombre de la app y tu email, y agregate a vos mismo como <strong>usuario de prueba</strong>.
            {usaBackend && (
              <> Para que la conexión no se corte a los 7 días, en <strong>Público</strong> (Publishing status) tocá
              <strong> Publicar la aplicación</strong>: al ser una app no verificada vas a ver una pantalla de aviso al
              conectar, tocá "Ir a (nombre de tu app), no seguro" y seguí normalmente.</>
            )}
          </li>
          <li>Andá a <strong>APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth</strong>, tipo <strong>"Aplicación web"</strong>.</li>
          <li>
            En <strong>"Orígenes de JavaScript autorizados"</strong> agregá la URL exacta de tu sitio
            (ej: https://tu-proyecto.vercel.app). Si querés probarlo en tu compu, agregá también
            http://localhost:5173.
          </li>
          {usaBackend ? (
            <li>Copiá el <strong>ID de cliente</strong> y el <strong>Client Secret</strong> (Google te los muestra juntos al crear la credencial, y siempre podés volver a verlos entrando a esa credencial desde Credenciales) y pegalos acá.</li>
          ) : (
            <li>Copiá el <strong>ID de cliente</strong> (termina en .apps.googleusercontent.com) y pegalo acá.</li>
          )}
        </ol>
      </div>

      <div className="modal-acciones">
        <button className="btn-secundario" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" disabled={!puedeGuardar || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

function EventoGoogleFormModal({ eventoInicial, fechaSugerida, horaSugerida, onGuardar, onClose, guardando, error, materias }) {
  const esNuevo = !eventoInicial;
  const [form, setForm] = useState(
    eventoInicial || {
      titulo: "",
      descripcion: "",
      fecha: fechaSugerida || toDateStr(new Date()),
      horaInicio: horaSugerida || "09:00",
      horaFin: sumarHora(horaSugerida || "09:00", 1),
      repetir: false,
      diasRepeticion: [],
      repetirHasta: "",
      vincularExamen: false,
      examenMateriaId: materias?.[0]?.id || "",
      examenTipo: "Parcial",
      color: COLORES[0].hex,
      usarColorPersonalizado: false,
    }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Detecta, a partir del título, si esto es un examen de alguna materia
  // cargada (ej: "Parcial Derecho I" -> Parcial, Derecho I). Mientras el
  // título coincida, el evento se vincula solo — no hace falta elegir la
  // materia ni el tipo a mano, solo confirmar (o destildar) más abajo.
  const deteccionExamen = useMemo(
    () => (esNuevo ? detectarExamenDesdeTitulo(form.titulo, materias) : null),
    [esNuevo, form.titulo, materias]
  );
  useEffect(() => {
    if (!esNuevo) return;
    if (deteccionExamen) {
      setForm((f) =>
        f.vincularExamen && f.examenMateriaId === deteccionExamen.materia.id && f.examenTipo === deteccionExamen.tipo
          ? f
          : { ...f, vincularExamen: true, examenMateriaId: deteccionExamen.materia.id, examenTipo: deteccionExamen.tipo }
      );
    } else {
      setForm((f) => (f.vincularExamen ? { ...f, vincularExamen: false } : f));
    }
  }, [deteccionExamen, esNuevo]);

  const toggleRepetir = (checked) => {
    setForm((f) => ({
      ...f,
      repetir: checked,
      // Si todavía no eligió ningún día, precarga el día de la semana que
      // corresponde a la fecha del evento (lo más común: la clase se repite
      // el mismo día de la semana en que la estás cargando ahora).
      diasRepeticion: checked && f.diasRepeticion.length === 0 ? [fromDateStr(f.fecha).getDay()] : f.diasRepeticion,
    }));
  };
  const toggleDiaRepeticion = (dia) => {
    setForm((f) => ({
      ...f,
      diasRepeticion: f.diasRepeticion.includes(dia)
        ? f.diasRepeticion.filter((d) => d !== dia)
        : [...f.diasRepeticion, dia].sort((a, b) => a - b),
    }));
  };

  return (
    <Modal title={esNuevo ? "Nuevo evento" : "Editar evento"} onClose={onClose}>
      <div className="form-grid">
        <label className="campo campo-full">
          <span>Título</span>
          <input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Parcial Derecho I" autoFocus />
        </label>
        <label className="campo">
          <span>Fecha</span>
          <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </label>
        <label className="campo">
          <span>Hora inicio</span>
          <input type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} />
        </label>
        <label className="campo">
          <span>Hora fin</span>
          <input type="time" value={form.horaFin} onChange={(e) => set("horaFin", e.target.value)} />
        </label>
        <label className="campo campo-full">
          <span>Descripción (opcional)</span>
          <textarea rows={3} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Detalle del evento" />
        </label>
        <div className="campo campo-full">
          <span>Color del evento</span>
          <div className="evento-color-personalizado">
            <button
              type="button"
              className={`evento-color-default ${!form.usarColorPersonalizado ? "evento-color-activo" : ""}`}
              aria-pressed={!form.usarColorPersonalizado}
              onClick={() => set("usarColorPersonalizado", false)}
            >
              Predeterminado de Google
            </button>
            <ColorPicker
              value={form.color || COLORES[0].hex}
              onChange={(color) => setForm((f) => ({ ...f, color, usarColorPersonalizado: true }))}
              descripcionDegradado="Elegí el color principal para identificar este evento en el calendario."
            />
          </div>
        </div>

        {esNuevo && (
          <>
            <label className="campo campo-full campo-checkbox">
              <input type="checkbox" checked={!!form.repetir} onChange={(e) => toggleRepetir(e.target.checked)} />
              <span>Repetir evento cada semana</span>
            </label>
            {form.repetir && (
              <>
                <div className="campo campo-full">
                  <span>Repetir los días</span>
                  <div className="dias-repeticion-selector">
                    {DIAS_SEMANA_NOMBRE.map((nombre, i) => (
                      <button
                        type="button"
                        key={i}
                        className={`dia-repeticion-chip ${form.diasRepeticion.includes(i) ? "dia-repeticion-chip-activo" : ""}`}
                        onClick={() => toggleDiaRepeticion(i)}
                        title={nombre}
                      >
                        {nombre.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="campo campo-full">
                  <span>Repetir hasta</span>
                  <input type="date" value={form.repetirHasta} onChange={(e) => set("repetirHasta", e.target.value)} />
                </label>
                <p className="muted campo-full" style={{ margin: "-6px 0 0", fontSize: 12 }}>
                  Con esto alcanza con cargar la clase una sola vez: se crea un evento recurrente en Google
                  Calendar que se repite solo hasta la fecha que pongas (por ejemplo, el fin de la cursada).
                </p>
              </>
            )}
            {deteccionExamen && (
              <>
                <label className="campo campo-full campo-checkbox">
                  <input type="checkbox" checked={!!form.vincularExamen} onChange={(e) => set("vincularExamen", e.target.checked)} />
                  <span>
                    Vincular como <strong>{deteccionExamen.tipo}</strong> de <strong>{deteccionExamen.materia.nombre}</strong>
                  </span>
                </label>
                {form.vincularExamen && (
                  <p className="muted campo-full" style={{ margin: "-6px 0 0", fontSize: 12 }}>
                    Además de crear el evento acá, va a aparecer como examen de esa materia — en su pestaña
                    Exámenes y en Próximos exámenes del Inicio.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      {error && <p className="adjuntar-archivo-error">{error}</p>}
      <div className="modal-acciones">
        <button className="btn-secundario" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" disabled={guardando} onClick={() => onGuardar(form)}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

/* Vista semanal estilo Google Calendar: columnas por día, grilla horaria,
   bloques de eventos posicionados y coloreados según su horario real. */
function CalendarioSemana({ dias, eventosPorDia, diaSel, onSeleccionarDia, onSeleccionarDiaConHora, materias }) {
  const horas = [];
  for (let h = CAL_HORA_INICIO; h < CAL_HORA_FIN; h++) horas.push(h);
  const rowH = 52;
  const hoyStr = toDateStr(new Date());
  const ahora = new Date();
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;

  return (
    <div className="semana-grid-wrap">
      <div className="semana-grid" style={{ gridTemplateRows: `56px repeat(${horas.length}, ${rowH}px)` }}>
        <div className="semana-esquina" />
        {dias.map((d) => {
          const fechaStr = toDateStr(d);
          const esHoy = fechaStr === hoyStr;
          const todoElDia = (eventosPorDia.get(fechaStr) || []).filter((ev) => !ev.start?.dateTime);
          return (
            <button
              key={fechaStr}
              className={`semana-dia-header ${diaSel === fechaStr ? "semana-dia-header-sel" : ""}`}
              onClick={() => onSeleccionarDia(fechaStr)}
            >
              <span className="semana-dia-nombre">{DIAS_SEMANA_CORTOS[(d.getDay() + 6) % 7]}</span>
              <span className={`semana-dia-numero ${esHoy ? "semana-dia-numero-hoy" : ""}`}>{d.getDate()}</span>
              {todoElDia.length > 0 && (
                <span className="semana-dia-todoeldia">{todoElDia.length} todo el día</span>
              )}
            </button>
          );
        })}

        {horas.map((h) => (
          <div key={h} className="semana-hora-label" style={{ gridRow: h - CAL_HORA_INICIO + 2 }}>
            {String(h).padStart(2, "0")}:00
          </div>
        ))}

        {dias.map((d, di) => {
          const fechaStr = toDateStr(d);
          const esHoy = fechaStr === hoyStr;
          const evs = (eventosPorDia.get(fechaStr) || []).filter((ev) => ev.start?.dateTime);
          return (
            <div key={fechaStr} className="semana-columna" style={{ gridColumn: di + 2, gridRow: `2 / span ${horas.length}` }}>
              {horas.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="semana-celda"
                  style={{ top: (h - CAL_HORA_INICIO) * rowH, height: rowH }}
                  onClick={() => onSeleccionarDiaConHora(fechaStr, h)}
                  aria-label={`Ver el día, agregar evento cerca de las ${String(h).padStart(2, "0")}:00`}
                />
              ))}
              {esHoy && horaActual >= CAL_HORA_INICIO && horaActual <= CAL_HORA_FIN && (
                <div className="semana-hora-actual" style={{ top: (horaActual - CAL_HORA_INICIO) * rowH }} />
              )}
              {evs.map((ev) => {
                const inicioH = horaDecimalDe(ev.start.dateTime);
                const finH = ev.end?.dateTime ? horaDecimalDe(ev.end.dateTime) : inicioH + 1;
                const top = Math.max((inicioH - CAL_HORA_INICIO) * rowH, 0);
                const height = Math.max((finH - inicioH) * rowH - 3, 20);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="semana-evento"
                    style={{ top, height, background: colorParaEvento(ev, materias) }}
                    onClick={(e) => { e.stopPropagation(); onSeleccionarDia(fechaStr); }}
                    title={ev.summary || "(sin título)"}
                  >
                    <strong>{ev.summary || "(sin título)"}</strong>
                    {ev.description && <span className="semana-evento-desc">{ev.description}</span>}
                    <span>{fmtHoraEvento(ev.start.dateTime)}{ev.end?.dateTime ? ` – ${fmtHoraEvento(ev.end.dateTime)}` : ""}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioView({ calendarId, setCalendarId, materias, googleCal, onVincularExamenDesdeEvento }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [menuConfigAbierto, setMenuConfigAbierto] = useState(false);
  const { clientId, setClientId } = googleCal;
  const [clientModalAbierto, setClientModalAbierto] = useState(false);
  const { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo, tokenListo, usaBackend } = googleCal;

  const [cursor, setCursor] = useState(new Date());
  const [vista, setVista] = useState("mes"); // "mes" | "semana"
  const [diaSel, setDiaSel] = useState(null);
  const [modoEdicionDia, setModoEdicionDia] = useState(false);
  const [eventosPeriodo, setEventosPeriodo] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [errorEventos, setErrorEventos] = useState("");
  const [eventoModal, setEventoModal] = useState(null); // null | "nuevo" | evento a editar
  const [guardandoEvento, setGuardandoEvento] = useState(false);
  const [errorGuardarEvento, setErrorGuardarEvento] = useState("");
  const [eventoAEliminar, setEventoAEliminar] = useState(null);
  const [horaSugerida, setHoraSugerida] = useState("09:00");

  // El ID guardado debería venir siempre normalizado (ver ConfigCalendarioModal),
  // pero por las dudas de que haya quedado una URL vieja guardada de antes de
  // este arreglo, se normaliza también acá antes de cualquier uso.
  const calendarIdNormalizado = useMemo(() => normalizarCalendarId(calendarId), [calendarId]);
  const urlEmbed = armarUrlEmbedCalendario(calendarId);
  const enClaude = tieneStorageClaude();
  const conectadoDeVerdad = accessToken && !enClaude;

  const inicioSemanaDe = (d) => {
    const offset = (d.getDay() + 6) % 7; // lunes = 0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  };

  // Rango de fechas realmente visible según la vista activa: todo el mes,
  // o solo la semana (lunes a domingo) que contiene al cursor.
  const { rangoInicio, rangoFin } = useMemo(() => {
    if (vista === "semana") {
      const inicio = inicioSemanaDe(cursor);
      const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7);
      return { rangoInicio: inicio, rangoFin: fin };
    }
    const inicio = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const fin = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return { rangoInicio: inicio, rangoFin: fin };
  }, [vista, cursor]);

  const diasSemana = useMemo(() => {
    if (vista !== "semana") return [];
    return Array.from({ length: 7 }, (_, i) => new Date(rangoInicio.getFullYear(), rangoInicio.getMonth(), rangoInicio.getDate() + i));
  }, [vista, rangoInicio]);

  const refrescarEventosPeriodo = async () => {
    if (!accessToken || !calendarIdNormalizado) return;
    setCargandoEventos(true);
    setErrorEventos("");
    try {
      const items = await apiListarEventosRango(accessToken, calendarIdNormalizado, rangoInicio.toISOString(), rangoFin.toISOString());
      setEventosPeriodo(items);
    } catch (e) {
      const msg = e.message || "";
      if (/not found/i.test(msg)) {
        setErrorEventos(
          `No se encontró el calendario "${calendarIdNormalizado}". Revisá que el ID esté bien copiado ` +
          `(termina en @group.calendar.google.com) y que el calendario esté configurado como público.`
        );
      } else if (/notauthorized|forbidden/i.test(msg)) {
        setErrorEventos("Tu cuenta de Google no tiene permiso para ver ese calendario. Hacelo público o compartilo con tu cuenta.");
      } else {
        setErrorEventos(msg || "No se pudieron cargar los eventos.");
      }
    } finally {
      setCargandoEventos(false);
    }
  };

  useEffect(() => {
    if (accessToken && calendarIdNormalizado) refrescarEventosPeriodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, calendarIdNormalizado, rangoInicio.getTime(), rangoFin.getTime()]);

  const eventoAApi = (form) => {
    const payload = {
      summary: form.titulo,
      description: form.descripcion || undefined,
      start: { dateTime: `${form.fecha}T${form.horaInicio}:00`, timeZone: "America/Argentina/Mendoza" },
      end: { dateTime: `${form.fecha}T${form.horaFin}:00`, timeZone: "America/Argentina/Mendoza" },
    };
    // "0" devuelve el evento al color predeterminado cuando se está editando
    // uno que antes tenía un color personalizado.
    payload.colorId = form.usarColorPersonalizado ? colorIdGoogleMasCercano(form.color) : "0";
    if (form.repetir && form.diasRepeticion && form.diasRepeticion.length > 0) {
      const DIA_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // índice = Date.getDay()
      const byday = form.diasRepeticion.map((d) => DIA_RRULE[d]).join(",");
      let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byday}`;
      if (form.repetirHasta) {
        rrule += `;UNTIL=${form.repetirHasta.replace(/-/g, "")}T235959Z`;
      }
      payload.recurrence = [rrule];
    }
    return payload;
  };

  const abrirNuevoEvento = () => { setHoraSugerida("09:00"); setEventoModal("nuevo"); };
  // En la vista semanal, tanto tocar un evento como tocar una celda vacía
  // primero abren la tarjeta resumen del día (igual que en la vista
  // mensual); recién desde ahí, con "Editar" o con "Nuevo evento" del menú
  // de configuración, se llega al formulario editable.
  const seleccionarDia = (fechaStr) => {
    setHoraSugerida("09:00");
    setModoEdicionDia(false);
    setDiaSel(fechaStr);
  };
  const seleccionarDiaConHora = (fechaStr, hora) => {
    setHoraSugerida(`${String(hora).padStart(2, "0")}:00`);
    setModoEdicionDia(false);
    setDiaSel(fechaStr);
  };
  const esNuevoEvento = eventoModal === "nuevo";

  const guardarEvento = async (form) => {
    if (!form.titulo.trim() || !eventoModal) return;
    setGuardandoEvento(true);
    setErrorGuardarEvento("");
    try {
      if (esNuevoEvento) {
        const creado = await apiCrearEvento(accessToken, calendarIdNormalizado, eventoAApi(form));
        if (form.vincularExamen && form.examenMateriaId) {
          onVincularExamenDesdeEvento?.(form.examenMateriaId, {
            id: uid(),
            tipo: form.examenTipo,
            titulo: form.titulo.trim(),
            nota: null,
            fecha: form.fecha,
            googleEventId: creado.id,
          });
        }
      } else {
        await apiActualizarEvento(accessToken, calendarIdNormalizado, eventoModal.id, eventoAApi(form));
      }
      setEventoModal(null);
      refrescarEventosPeriodo();
    } catch (e) {
      setErrorGuardarEvento(e.message || "No se pudo guardar el evento.");
    } finally {
      setGuardandoEvento(false);
    }
  };

  const confirmarEliminarEvento = async () => {
    if (!eventoAEliminar) return;
    try {
      await apiEliminarEvento(accessToken, calendarIdNormalizado, eventoAEliminar.id);
      setEventoAEliminar(null);
      refrescarEventosPeriodo();
    } catch (e) {
      setErrorEventos(e.message || "No se pudo eliminar el evento.");
      setEventoAEliminar(null);
    }
  };

  const formInicialDesdeEvento = (ev) => {
    const inicio = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
    const fin = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    const hhmm = (d) => (d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "09:00");
    return {
      titulo: ev.summary || "",
      descripcion: ev.description || "",
      fecha: inicio ? toDateStr(inicio) : toDateStr(new Date()),
      horaInicio: hhmm(inicio),
      horaFin: hhmm(fin),
      color: GOOGLE_EVENTO_COLORES[ev.colorId] || COLORES[0].hex,
      usarColorPersonalizado: !!GOOGLE_EVENTO_COLORES[ev.colorId],
    };
  };

  // ---- Armado de la grilla mensual nativa ----
  const primerDiaMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const diasEnMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const offset = (primerDiaMes.getDay() + 6) % 7; // lunes = 0
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  // La agenda propia se arma desde las materias aunque Google no esté conectado:
  // clases recurrentes, vencimientos y exámenes locales siempre son visibles.
  const eventosLocales = useMemo(() => {
    const eventos = [];
    const desde = new Date(rangoInicio); const hasta = new Date(rangoFin);
    materias.forEach((m) => {
      (m.tareas || []).filter((t) => t.fecha && t.fecha >= toDateStr(desde) && t.fecha < toDateStr(hasta) && !t.completada).forEach((t) => eventos.push({ id: `t-${t.id}`, summary: `Tarea: ${t.titulo}`, description: m.nombre, start: { date: t.fecha }, end: { date: t.fecha }, colorId: "5" }));
      (m.examenes || []).filter((e) => e.fecha && e.fecha >= toDateStr(desde) && e.fecha < toDateStr(hasta)).forEach((e) => eventos.push({ id: `e-${e.id}`, summary: `${e.tipo}: ${e.titulo}`, description: m.nombre, start: { date: e.fecha }, end: { date: e.fecha }, colorId: "4" }));
      for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) {
        const dia = DIAS[(d.getDay() + 6) % 7];
        (m.horarios || []).filter((h) => h.dia === dia).forEach((h, i) => eventos.push({ id: `c-${m.id}-${toDateStr(d)}-${i}`, summary: m.nombre, description: m.aula || "", start: { dateTime: `${toDateStr(d)}T${h.inicio}:00` }, end: { dateTime: `${toDateStr(d)}T${h.fin}:00` }, colorId: undefined }));
      }
    });
    return eventos;
  }, [materias, rangoInicio, rangoFin]);
  const eventosMostrados = conectadoDeVerdad ? eventosPeriodo : eventosLocales;
  const eventosPorDia = useMemo(() => {
    const map = new Map();
    eventosMostrados.forEach((ev) => {
      const fechaStr = ev.start?.dateTime ? toDateStr(new Date(ev.start.dateTime)) : ev.start?.date;
      if (!fechaStr) return;
      if (!map.has(fechaStr)) map.set(fechaStr, []);
      map.get(fechaStr).push(ev);
    });
    map.forEach((lista) => lista.sort((a, b) => (a.start?.dateTime || a.start?.date || "").localeCompare(b.start?.dateTime || b.start?.date || "")));
    return map;
  }, [eventosMostrados]);

  const eventosDelDiaSel = (diaSel ? (eventosPorDia.get(diaSel) || []) : [])
    .slice()
    .sort((a, b) => {
      const aImportante = !claseDeEvento(a, materias);
      const bImportante = !claseDeEvento(b, materias);
      if (aImportante !== bImportante) return aImportante ? -1 : 1;
      return (a.start?.dateTime || a.start?.date || "").localeCompare(b.start?.dateTime || b.start?.date || "");
    });
  const cambiarPeriodo = (delta) => {
    if (vista === "semana") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    }
    setDiaSel(null);
  };
  const cambiarVista = (v) => { setVista(v); setDiaSel(null); };

  const etiquetaPeriodo =
    vista === "semana"
      ? (rangoInicio.getMonth() === new Date(rangoFin.getTime() - 86400000).getMonth()
          ? `${rangoInicio.getDate()}–${new Date(rangoFin.getTime() - 86400000).getDate()} ${MESES[rangoInicio.getMonth()]} ${rangoInicio.getFullYear()}`
          : `${rangoInicio.getDate()} ${MESES[rangoInicio.getMonth()].slice(0, 3)} – ${new Date(rangoFin.getTime() - 86400000).getDate()} ${MESES[new Date(rangoFin.getTime() - 86400000).getMonth()].slice(0, 3)}`)
      : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="view view-sin-padding-abajo">
      <header className="view-head view-head-calendario">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1>Calendario</h1>
        </div>
        <div className="calendario-acciones-head">
          <div className="calendario-menu-config">
            <IconBtn icon={Settings} title="Configuración del calendario" onClick={() => setMenuConfigAbierto((v) => !v)} />
            {menuConfigAbierto && (
              <>
                <div className="fila-menu-backdrop" onClick={() => setMenuConfigAbierto(false)} />
                <div className="fila-menu-pop calendario-menu-pop">
                  <button onClick={() => { setMenuConfigAbierto(false); abrirNuevoEvento(); }}>
                    <Plus size={13} /> Nuevo evento
                  </button>
                  {calendarId && (
                    <a
                      href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarIdNormalizado)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setMenuConfigAbierto(false)}
                    >
                      <ExternalLink size={13} /> Abrir en Google Calendar
                    </a>
                  )}
                  <button onClick={() => { setMenuConfigAbierto(false); setFormAbierto(true); }}>
                    <Pencil size={13} /> {calendarId ? "Cambiar calendario" : "Conectar calendario"}
                  </button>
                  {accessToken && !enClaude && (
                    <>
                      <div className="fila-menu-separador" />
                      <button className="fila-menu-danger" onClick={() => { setMenuConfigAbierto(false); desconectar(); }}>
                        <X size={13} /> Desconectar de Google
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {calendarId && (!clientId || enClaude || (tokenListo && !accessToken) || errorAuth) && (
        <div className="calendario-edicion-barra">
          {!clientId ? (
            <button className="btn-secundario btn-chico" onClick={() => setClientModalAbierto(true)}>
              <Pencil size={13} /> Usar el calendario nativo, conectado a Google
            </button>
          ) : enClaude ? (
            <span className="calendario-edicion-nota muted">
              El calendario conectado solo funciona en tu página publicada, no en esta vista previa.
            </span>
          ) : tokenListo && !accessToken ? (
            <>
              <button className="btn-secundario btn-chico" onClick={conectar} disabled={conectando || !scriptListo}>
                {conectando ? "Conectando…" : "Conectar con Google"}
              </button>
              <button className="link-btn-chico" onClick={() => setClientModalAbierto(true)}>Cambiar credenciales</button>
            </>
          ) : null}
          {errorAuth && <span className="adjuntar-archivo-error">{errorAuth}</span>}
        </div>
      )}

      {false ? (
        <div className="panel calendario-vacio">
          <CalendarIcon size={28} strokeWidth={1.5} />
          <h2>Todavía no conectaste tu Google Calendar</h2>
          <p className="muted">
            Pegá el ID de tu calendario para verlo acá directamente, con tus fechas reales.
          </p>
          <button className="btn-primario" onClick={() => setFormAbierto(true)}>
            <Plus size={16} /> Conectar calendario
          </button>
        </div>
      ) : (
        <div className="calendario-nativo">
          <div className="panel calendario-nativo-panel">
            <div className="calendario-nav">
              <div className="calendario-nav-izq">
                <div className="modo-toggle">
                  <button className={vista === "semana" ? "modo-toggle-activo" : ""} onClick={() => cambiarVista("semana")}>Semana</button>
                  <button className={vista === "mes" ? "modo-toggle-activo" : ""} onClick={() => cambiarVista("mes")}>Mes</button>
                </div>
              </div>
              <div className="calendario-nav-centro">
                <IconBtn icon={ChevronLeft} title={vista === "semana" ? "Semana anterior" : "Mes anterior"} onClick={() => cambiarPeriodo(-1)} />
                <strong>{etiquetaPeriodo}</strong>
                <IconBtn icon={ChevronRight} title={vista === "semana" ? "Semana siguiente" : "Mes siguiente"} onClick={() => cambiarPeriodo(1)} />
              </div>
            </div>
            {cargandoEventos && <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Cargando…</p>}
            {errorEventos && <p className="adjuntar-archivo-error">{errorEventos}</p>}

            {vista === "semana" ? (
              <CalendarioSemana
                dias={diasSemana}
                eventosPorDia={eventosPorDia}
                diaSel={diaSel}
                onSeleccionarDia={seleccionarDia}
                onSeleccionarDiaConHora={seleccionarDiaConHora}
                materias={materias}
              />
            ) : (
              <>
                <div className="calendario-dias-header">
                  {DIAS_SEMANA_CORTOS.map((d) => (<span key={d}>{d}</span>))}
                </div>
                <div className="calendario-grid">
                  {celdas.map((d, i) => {
                    if (d === null) return <div key={i} className="calendario-celda calendario-celda-vacia" />;
                    const fechaStr = toDateStr(new Date(cursor.getFullYear(), cursor.getMonth(), d));
                    const evs = eventosPorDia.get(fechaStr) || [];
                    const esHoy = fechaStr === toDateStr(new Date());
                    return (
                      <button
                        key={i}
                        className={`calendario-celda ${diaSel === fechaStr ? "calendario-celda-sel" : ""} ${esHoy ? "calendario-celda-hoy" : ""}`}
                        onClick={() => seleccionarDia(fechaStr)}
                      >
                        <span className="calendario-celda-num">{d}</span>
                        {(() => {
                          const clases = evs
                            .map((ev) => ({ ev, materia: claseDeEvento(ev, materias) }))
                            .filter((x) => x.materia);
                          const importantes = evs.filter((ev) => !claseDeEvento(ev, materias));
                          const MAX_IMPORTANTES = 3;
                          const visibles = importantes.slice(0, MAX_IMPORTANTES);
                          const ocultos = importantes.length - visibles.length;
                          return (
                            <>
                              {visibles.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="calendario-evento-chip calendario-evento-chip-importante"
                                  style={{ background: colorParaEvento(ev, materias) }}
                                >
                                  <span className="calendario-evento-chip-titulo">{ev.summary || "(sin título)"}</span>
                                  {ev.description && <span className="calendario-evento-chip-desc">{ev.description}</span>}
                                </div>
                              ))}
                              {ocultos > 0 && <span className="calendario-evento-mas">+{ocultos} más</span>}
                              {clases.length > 0 && (
                                <div
                                  className="calendario-clases-barra"
                                  title={clases.map((x) => x.materia.nombre).join(" · ")}
                                >
                                  {clases.map((x) => (
                                    <span
                                      key={x.ev.id}
                                      className="calendario-clases-seg"
                                      style={{ background: x.materia.color }}
                                    >
                                      {abreviarMateria(x.materia.nombre)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {diaSel && !eventoModal && !eventoAEliminar && (
            <Modal title={fmtFechaLarga(diaSel)} onClose={() => { setDiaSel(null); setModoEdicionDia(false); }}>
              {eventosDelDiaSel.length === 0 ? (
                <p className="muted">Sin eventos este día.</p>
              ) : (
                <ul className="lista-eventos-google">
                  {eventosDelDiaSel.map((ev) => (
                    <li key={ev.id}>
                      <span className="lista-eventos-google-dot" style={{ background: colorParaEvento(ev, materias) }} />
                      <div className="lista-eventos-google-texto">
                        <strong>{ev.summary || "(sin título)"}</strong>
                        <span className="muted">
                          {ev.start?.dateTime
                            ? new Date(ev.start.dateTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                            : "Todo el día"}
                        </span>
                      </div>
                      {modoEdicionDia && (
                        <>
                          <IconBtn icon={Pencil} title="Editar" onClick={() => setEventoModal(ev)} />
                          <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => setEventoAEliminar(ev)} />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="dia-popup-botones">
                <button className="btn-agregar-ancho" onClick={abrirNuevoEvento}>
                  <Plus size={16} /> Nuevo evento
                </button>
                {eventosDelDiaSel.length > 0 && (
                  <button className="btn-agregar-ancho" onClick={() => setModoEdicionDia((v) => !v)}>
                    {modoEdicionDia ? (<><Check size={16} /> Listo</>) : (<><Pencil size={16} /> Modificar</>)}
                  </button>
                )}
              </div>
            </Modal>
          )}
        </div>
      )}

      {formAbierto && (
        <ConfigCalendarioModal
          valorInicial={calendarId}
          onSave={(v) => { setCalendarId(v); setFormAbierto(false); }}
          onClose={() => setFormAbierto(false)}
        />
      )}

      {clientModalAbierto && (
        <ConfigGoogleClientModal
          valorInicial={clientId}
          usaBackend={usaBackend}
          onSave={(v) => { setClientId(v); setClientModalAbierto(false); }}
          onClose={() => setClientModalAbierto(false)}
        />
      )}

      {eventoModal && (
        <EventoGoogleFormModal
          eventoInicial={esNuevoEvento ? null : formInicialDesdeEvento(eventoModal)}
          fechaSugerida={diaSel || toDateStr(new Date())}
          horaSugerida={horaSugerida}
          onGuardar={guardarEvento}
          onClose={() => { setEventoModal(null); setErrorGuardarEvento(""); }}
          guardando={guardandoEvento}
          error={errorGuardarEvento}
          materias={materias}
        />
      )}

      {eventoAEliminar && (
        <Modal title="Eliminar evento" onClose={() => setEventoAEliminar(null)}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            ¿Seguro que querés eliminar <strong>{eventoAEliminar.summary || "este evento"}</strong> de tu
            Google Calendar? No se puede deshacer.
          </p>
          <div className="modal-acciones">
            <button className="btn-secundario" onClick={() => setEventoAEliminar(null)}>Cancelar</button>
            <button className="btn-peligro" onClick={confirmarEliminarEvento}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   FOCUS — timer de sesiones de estudio, vinculado a una materia
   ========================================================================= */

const FOCUS_RADIO = 96;
const FOCUS_CIRCUNFERENCIA = 2 * Math.PI * FOCUS_RADIO;

function FocusView({ materias, sesiones, agregarSesion, abrirMateria }) {
  const materiasCursando = useMemo(() => materias.filter((m) => m.estado === "Cursando"), [materias]);
  const [materiaId, setMateriaId] = useState(materiasCursando[0]?.id || "");
  const [duracionMin, setDuracionMin] = useState(25);
  const [descansoMin, setDescansoMin] = useState(5);
  const [editandoDuraciones, setEditandoDuraciones] = useState(false);
  const [fase, setFase] = useState("inactivo"); // "inactivo" | "estudio" | "descanso"
  const [corriendo, setCorriendo] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(25 * 60);
  const [finTimestamp, setFinTimestamp] = useState(null);
  const [rango, setRango] = useState("semana"); // "semana" | "mes"

  // Si cambiás la duración mientras está inactivo, se refleja en el
  // número grande antes de arrancar.
  useEffect(() => {
    if (fase === "inactivo") setSegundosRestantes(duracionMin * 60);
  }, [duracionMin, fase]);

  useEffect(() => {
    if (fase !== "inactivo") setEditandoDuraciones(false);
  }, [fase]);

  // La materia elegida solo puede ser una que estés cursando ahora mismo;
  // si la que tenías elegida deja de estarlo (o no había ninguna todavía),
  // se reacomoda sola a la primera disponible.
  useEffect(() => {
    if (materiasCursando.length === 0) {
      if (materiaId) setMateriaId("");
      return;
    }
    if (!materiasCursando.some((m) => m.id === materiaId)) {
      setMateriaId(materiasCursando[0].id);
    }
  }, [materiasCursando, materiaId]);

  const registrarSesion = (minutos) => {
    if (!materiaId || minutos < 1) return;
    agregarSesion({ id: uid(), materiaId, fecha: new Date().toISOString(), minutos: Math.round(minutos) });
  };

  // Señal de fin generada con Web Audio, sin depender de archivos externos.
  // El contexto se habilita al iniciar/reanudar (gesto del usuario), para que
  // el navegador permita reproducir la alarma aunque termine más tarde.
  const audioCtxRef = useRef(null);
  const prepararAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    } catch (e) {
      // El navegador no ofrece Web Audio; el timer sigue funcionando igual.
    }
  };
  const reproducirBeepFin = () => {
    try {
      prepararAudio();
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== "running") return;
      const master = ctx.createGain();
      master.gain.value = 0.62;
      master.connect(ctx.destination);
      const sonar = (frecuencia, inicio, duracion) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = frecuencia;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
        gain.gain.exponentialRampToValueAtTime(0.58, ctx.currentTime + inicio + 0.025);
        gain.gain.setValueAtTime(0.42, ctx.currentTime + inicio + duracion * 0.58);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
        osc.connect(gain);
        gain.connect(master);
        osc.start(ctx.currentTime + inicio);
        osc.stop(ctx.currentTime + inicio + duracion + 0.03);
      };
      // Acorde ascendente de aproximadamente 1,5 s: más fácil de percibir
      // que el beep anterior incluso mientras se estudia con la pestaña abierta.
      sonar(659.25, 0, 0.38);
      sonar(783.99, 0.42, 0.38);
      sonar(1046.5, 0.84, 0.62);
    } catch (e) {
      // El navegador bloqueó el audio (o no está disponible) — no pasa nada.
    }
  };

  const manejarFinDeFase = (faseQueTermina) => {
    reproducirBeepFin();
    if (faseQueTermina === "estudio") {
      registrarSesion(duracionMin);
      setFase("descanso");
      setSegundosRestantes(descansoMin * 60);
      setFinTimestamp(Date.now() + descansoMin * 60000);
    } else {
      setFase("inactivo");
      setCorriendo(false);
      setFinTimestamp(null);
      setSegundosRestantes(duracionMin * 60);
    }
  };

  useEffect(() => {
    if (!corriendo || !finTimestamp) return;
    const tick = () => {
      const restante = Math.round((finTimestamp - Date.now()) / 1000);
      if (restante <= 0) {
        setSegundosRestantes(0);
        manejarFinDeFase(fase);
      } else {
        setSegundosRestantes(restante);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo, finTimestamp, fase]);

  const iniciar = () => {
    if (!materiaId) return;
    prepararAudio();
    setFase("estudio");
    setSegundosRestantes(duracionMin * 60);
    setFinTimestamp(Date.now() + duracionMin * 60000);
    setCorriendo(true);
  };
  const pausar = () => {
    setCorriendo(false);
    setFinTimestamp(null);
  };
  const reanudar = () => {
    if (fase === "inactivo") return;
    prepararAudio();
    setFinTimestamp(Date.now() + segundosRestantes * 1000);
    setCorriendo(true);
  };
  const detener = () => {
    if (fase === "estudio") {
      const transcurridos = duracionMin * 60 - segundosRestantes;
      if (transcurridos >= 60) registrarSesion(transcurridos / 60);
    }
    setFase("inactivo");
    setCorriendo(false);
    setFinTimestamp(null);
    setSegundosRestantes(duracionMin * 60);
  };

  const totalSegundosFase = fase === "descanso" ? descansoMin * 60 : duracionMin * 60;
  const progreso = totalSegundosFase > 0 ? segundosRestantes / totalSegundosFase : 0;
  const mm = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
  const ss = String(segundosRestantes % 60).padStart(2, "0");
  const materiaActiva = materias.find((m) => m.id === materiaId);

  const resumen = useMemo(() => {
    const ahora = new Date();
    const desde = rango === "semana" ? inicioDeSemana(ahora) : new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const filtradas = sesiones.filter((s) => new Date(s.fecha) >= desde);
    const map = new Map();
    filtradas.forEach((s) => map.set(s.materiaId, (map.get(s.materiaId) || 0) + s.minutos));
    const porMateria = materias
      .map((m) => ({ materia: m, minutos: map.get(m.id) || 0 }))
      .filter((x) => x.minutos > 0)
      .sort((a, b) => b.minutos - a.minutos);
    const totalMinutos = porMateria.reduce((acc, x) => acc + x.minutos, 0);
    const maxMinutos = porMateria.length > 0 ? porMateria[0].minutos : 0;
    return { porMateria, totalMinutos, maxMinutos };
  }, [sesiones, materias, rango]);

  const sesionesRecientes = useMemo(() => {
    return sesiones
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, 8);
  }, [sesiones]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Pomodoro</p>
          <h1>Sesiones de estudio</h1>
        </div>
      </header>

      {materias.length === 0 ? (
        <p className="muted">Cargá alguna materia primero para poder arrancar una sesión de estudio.</p>
      ) : (
        <div className="dos-columnas">
          <div className="columna-izquierda">
            <section className="panel focus-panel-timer">
              {materiasCursando.length === 0 ? (
                <p className="muted" style={{ textAlign: "center", margin: 0 }}>
                  No tenés materias en curso ahora mismo. Marcá alguna como "Cursando" para poder arrancar una sesión de Focus.
                </p>
              ) : (
                <>
                  <label className="campo campo-full focus-select-materia">
                    <span>Materia</span>
                    <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} disabled={fase !== "inactivo"}>
                      {materiasCursando.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
                    </select>
                  </label>

                  <div className="focus-timer-wrap">
                    <svg viewBox="0 0 220 220" className="focus-timer-svg" shapeRendering="geometricPrecision">
                      <circle cx="110" cy="110" r={FOCUS_RADIO} fill="none" stroke="var(--line)" strokeWidth="10" />
                      <circle
                        cx="110" cy="110" r={FOCUS_RADIO} fill="none"
                        stroke={materiaActiva?.color || (fase === "descanso" ? "var(--ochre)" : "var(--forest)")}
                        strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${progreso * FOCUS_CIRCUNFERENCIA} ${FOCUS_CIRCUNFERENCIA}`}
                        transform="rotate(-90 110 110)"
                        style={{ transition: "stroke-dasharray 0.3s linear" }}
                      />
                    </svg>
                    <div className="focus-timer-texto">
                      <strong>{mm}:{ss}</strong>
                    </div>
                  </div>
                  <p className="muted focus-fase-label">
                    {fase === "inactivo" && "Elegí una materia y arrancá"}
                    {fase === "estudio" && `Estudiando ${materiaActiva?.nombre || ""}`}
                    {fase === "descanso" && "Descanso"}
                  </p>

                  <div className="focus-controles">
                    {fase === "inactivo" && (
                      <button className="btn-primario" onClick={iniciar} disabled={!materiaId}>
                        <Play size={16} /> Iniciar
                      </button>
                    )}
                    {fase !== "inactivo" && corriendo && (
                      <button className="btn-secundario" onClick={pausar}>
                        <Pause size={16} /> Pausar
                      </button>
                    )}
                    {fase !== "inactivo" && !corriendo && (
                      <button className="btn-primario" onClick={reanudar}>
                        <Play size={16} /> Reanudar
                      </button>
                    )}
                    {fase !== "inactivo" && (
                      <button className="btn-secundario" onClick={detener}>
                        <RotateCcw size={16} /> Terminar
                      </button>
                    )}
                  </div>

                  {editandoDuraciones ? (
                    <div className="focus-duraciones">
                      <label className="campo">
                        <span className="campo-sublabel">Estudio (min)</span>
                        <input
                          type="number" min={1} max={180}
                          value={duracionMin}
                          onChange={(e) => setDuracionMin(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                      <label className="campo">
                        <span className="campo-sublabel">Descanso (min)</span>
                        <input
                          type="number" min={1} max={60}
                          value={descansoMin}
                          onChange={(e) => setDescansoMin(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                      <button type="button" className="btn-secundario btn-chico focus-duraciones-listo" onClick={() => setEditandoDuraciones(false)}>
                        Listo
                      </button>
                    </div>
                  ) : (
                    <div className="focus-duraciones-resumen">
                      <span className="muted">Estudio: <strong>{duracionMin} min</strong></span>
                      <span className="muted">Descanso: <strong>{descansoMin} min</strong></span>
                      {fase === "inactivo" && (
                        <button type="button" className="link-btn" onClick={() => setEditandoDuraciones(true)}>
                          Modificar
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <div className="columna-derecha">
            <PlanDeEstudio materias={materias} abrirMateria={abrirMateria} />
            <section className="panel">
              <div className="focus-resumen-head">
                <h2>Horas de estudio</h2>
                <div className="modo-toggle focus-rango-toggle">
                  <button className={rango === "semana" ? "modo-toggle-activo" : ""} onClick={() => setRango("semana")}>Esta semana</button>
                  <button className={rango === "mes" ? "modo-toggle-activo" : ""} onClick={() => setRango("mes")}>Este mes</button>
                </div>
              </div>
              {resumen.porMateria.length === 0 ? (
                <p className="muted">Todavía no completaste ninguna sesión {rango === "semana" ? "esta semana" : "este mes"}.</p>
              ) : (
                <>
                  <p className="focus-resumen-total"><strong>{fmtDuracionMin(resumen.totalMinutos)}</strong> en total</p>
                  <ul className="focus-resumen-lista">
                    {resumen.porMateria.map(({ materia, minutos }) => (
                      <li key={materia.id}>
                        <div className="focus-resumen-fila-head">
                          <span className="focus-resumen-nombre">{materia.nombre}</span>
                          <span className="muted">{fmtDuracionMin(minutos)}</span>
                        </div>
                        <div className="focus-resumen-barra">
                          <div
                            className="focus-resumen-barra-relleno"
                            style={{ width: `${(minutos / resumen.maxMinutos) * 100}%`, background: materia.color }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {sesionesRecientes.length > 0 && (
              <section className="panel">
                <h2>Sesiones recientes</h2>
                <ul className="lista-eventos-google">
                  {sesionesRecientes.map((s) => {
                    const m = materias.find((mm) => mm.id === s.materiaId);
                    return (
                      <li key={s.id}>
                        <span className="lista-eventos-google-dot" style={{ background: m?.color || "#999" }} />
                        <span className="lista-eventos-google-texto">
                          <strong>{m?.nombre || "Materia eliminada"}</strong>
                          <span className="muted">{fmtFechaHoraNota(s.fecha)} · {fmtDuracionMin(s.minutos)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   APP
   ========================================================================= */

function ConfiguracionView({ tema, onToggleTema, asistenciaMinima, setAsistenciaMinima, configNotificaciones, setConfigNotificaciones, user, onSignOut }) {
  const [permiso, setPermiso] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const activar = async () => {
    if (!("Notification" in window)) return;
    const resultado = await Notification.requestPermission();
    setPermiso(resultado);
    if (resultado === "granted") setConfigNotificaciones((c) => ({ ...c, activadas: true }));
  };
  const toggle = (campo) => setConfigNotificaciones((c) => ({ ...c, [campo]: !c[campo] }));
  return <div className="view configuracion-view">
    <header className="view-head"><div><p className="eyebrow">Preferencias</p><h1>Configuración</h1></div></header>
    <section className="panel configuracion-seccion">
      <div><h2>Apariencia</h2><p className="muted">Elegí cómo se ve el planificador.</p></div>
      <button className="btn-secundario" onClick={onToggleTema}>{tema === "oscuro" ? <><Sun size={16} /> Usar modo claro</> : <><Moon size={16} /> Usar modo oscuro</>}</button>
    </section>
    {user && <section className="panel configuracion-seccion">
      <div><h2>Cuenta</h2><p className="muted">Sesión iniciada como {user.email}.</p></div>
      <button className="btn-secundario" onClick={onSignOut}><LogOut size={16} /> Cerrar sesión</button>
    </section>}
    <section className="panel configuracion-seccion">
      <div><h2>Asistencia</h2><p className="muted">Porcentaje mínimo para no quedar libre por faltas.</p></div>
      <label className="configuracion-porcentaje"><span>Mínimo</span><input type="number" min="0" max="100" value={asistenciaMinima} onChange={(e) => setAsistenciaMinima(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><b>%</b></label>
    </section>
    <section className="panel configuracion-recordatorios">
      <div><h2>Recordatorios</h2><p className="muted">Recibí avisos de tareas, exámenes, clases y asistencia.</p></div>
      {permiso !== "granted" ? <button className="btn-primario" onClick={activar}><BellRing size={16} /> Permitir notificaciones</button> : <p className="notificacion-permitida"><Check size={15} /> Notificaciones permitidas</p>}
      <div className="notificaciones-opciones">
        {[['tareas', 'Vencimientos de tareas'], ['examenes', 'Parciales y exámenes'], ['clases', 'Clases próximas'], ['asistencia', 'Riesgo de asistencia']].map(([id, label]) => <label key={id} className="notificacion-opcion"><span>{label}</span><input type="checkbox" checked={configNotificaciones[id]} disabled={permiso !== "granted"} onChange={() => toggle(id)} /></label>)}
      </div>
      <div className="configuracion-selects">
        <label className="notificacion-select">Avisar de clases con anticipación<select value={configNotificaciones.minutosClase} onChange={(e) => setConfigNotificaciones((c) => ({ ...c, minutosClase: Number(e.target.value) }))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option></select></label>
        <label className="notificacion-select">Avisar de vencimientos y exámenes<select value={configNotificaciones.diasAnticipacion} onChange={(e) => setConfigNotificaciones((c) => ({ ...c, diasAnticipacion: Number(e.target.value) }))}><option value={0}>El mismo día</option><option value={1}>1 día antes</option><option value={2}>2 días antes</option><option value={7}>1 semana antes</option></select></label>
      </div>
    </section>
  </div>;
}

function usarRecordatorios(materias, config, asistenciaMinima, configuracionCargada) {
  useEffect(() => { if (configuracionCargada) guardarValor(NOTIFICACIONES_KEY, config); }, [config, configuracionCargada]);
  useEffect(() => {
    if (!config.activadas || !("Notification" in window) || Notification.permission !== "granted") return;
    const enviados = new Set();
    try { JSON.parse(localStorage.getItem(`${NOTIFICACIONES_KEY}-enviados`) || "[]").forEach((x) => enviados.add(x)); } catch (e) { /* noop */ }
    const avisar = (id, titulo, cuerpo) => {
      if (enviados.has(id)) return;
      new Notification(titulo, { body: cuerpo, icon: "/favicon-192.png", tag: id });
      enviados.add(id);
      try { localStorage.setItem(`${NOTIFICACIONES_KEY}-enviados`, JSON.stringify([...enviados].slice(-200))); } catch (e) { /* noop */ }
    };
    const revisar = () => {
      const hoy = toDateStr(new Date());
      const ahora = new Date();
      materias.forEach((m) => {
        if (config.tareas) (m.tareas || []).filter((t) => !t.completada && t.fecha && diffDias(t.fecha) <= config.diasAnticipacion && diffDias(t.fecha) >= 0).forEach((t) => avisar(`tarea-${t.id}-${t.fecha}`, "Tarea próxima", `${t.titulo} · ${m.nombre} · ${textoUrgencia(t.fecha)}`));
        if (config.examenes) (m.examenes || []).filter((e) => e.fecha && diffDias(e.fecha) <= config.diasAnticipacion && diffDias(e.fecha) >= 0).forEach((e) => avisar(`examen-${e.id}-${e.fecha}`, "Examen próximo", `${e.titulo || e.tipo} · ${m.nombre} · ${textoUrgencia(e.fecha)}`));
        if (config.clases && m.estado === "Cursando") (m.horarios || []).forEach((h) => {
          const dia = DIAS.indexOf(h.dia); if (dia < 0) return;
          const hoyDia = (ahora.getDay() + 6) % 7;
          if (dia !== hoyDia) return;
          const [hh, mm] = h.inicio.split(":").map(Number); const inicio = new Date(ahora); inicio.setHours(hh, mm, 0, 0);
          const mins = (inicio - ahora) / 60000;
          if (mins >= 0 && mins <= config.minutosClase) avisar(`clase-${m.id}-${h.dia}-${h.inicio}-${hoy}`, "Clase próxima", `${m.nombre} empieza a las ${h.inicio}${m.aula ? ` · ${m.aula}` : ""}`);
        });
        if (config.asistencia && m.estado === "Cursando") {
          const pct = calcularAsistenciaPct(m.asistencia, m.horarios);
          if (pct !== null && pct < asistenciaMinima) avisar(`asistencia-${m.id}-${hoy}`, "Riesgo de asistencia", `${m.nombre}: ${Math.round(pct)}% de asistencia. El mínimo es ${asistenciaMinima}%.`);
        }
      });
    };
    revisar(); const intervalo = window.setInterval(revisar, 60000); return () => window.clearInterval(intervalo);
  }, [materias, config, asistenciaMinima]);
}

function PlanificadorApp({ user, onSignOut }) {
  const { materias, setMaterias, cargado, errorGuardado } = useStore();
  const { calendarId, setCalendarId, cargado: calCargado } = useCalendarioConfig();
  const { sesiones, agregarSesion, cargado: sesionesCargado } = useSesionesEstudio();
  const { clientId, setClientId } = useGoogleClientId();
  const { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo, tokenListo, usaBackend } = useGoogleAuth(clientId);
  // Bundle chico con todo lo necesario para leer/escribir en Google Calendar,
  // para pasarlo a cualquier parte de la app que necesite sincronizar algo
  // (materias con horario, exámenes, o la vista de Calendario en sí).
  const googleCal = {
    clientId, setClientId,
    accessToken, conectar, desconectar, conectando, errorAuth, scriptListo, tokenListo, usaBackend,
    calendarId: useMemo(() => normalizarCalendarId(calendarId), [calendarId]),
    calendarIdCrudo: calendarId, setCalendarId,
  };
  const [view, setView] = useState("inicio");
  const [materiaAbiertaId, setMateriaAbiertaId] = useState(null);
  const [tabMateriaInicial, setTabMateriaInicial] = useState("inicio");
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [configNotificaciones, setConfigNotificaciones] = useState({ activadas: false, tareas: true, examenes: true, clases: true, asistencia: true, minutosClase: 30, diasAnticipacion: 1 });
  const [configNotificacionesCargada, setConfigNotificacionesCargada] = useState(false);
  const [configuracion, setConfiguracion] = useState({ asistenciaMinima: ASISTENCIA_MINIMA_DEFAULT });
  const [configuracionCargada, setConfiguracionCargada] = useState(false);
  const [tema, setTema] = useState(() => {
    try { return window.localStorage.getItem("planificador-tema") || "claro"; } catch (e) { return "claro"; }
  });
  const toggleTema = () => {
    setTema((t) => {
      const next = t === "oscuro" ? "claro" : "oscuro";
      try { window.localStorage.setItem("planificador-tema", next); } catch (e) { /* noop */ }
      return next;
    });
  };
  const [confettiActivo, setConfettiActivo] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const dispararConfetti = () => {
    setConfettiKey((k) => k + 1);
    setConfettiActivo(true);
  };
  const [confirmarReset, setConfirmarReset] = useState(false);
  const esTablet = useEsTablet();

  useEffect(() => { (async () => { const guardada = await cargarValor(NOTIFICACIONES_KEY); if (guardada) setConfigNotificaciones((c) => ({ ...c, ...guardada })); setConfigNotificacionesCargada(true); })(); }, []);
  useEffect(() => { (async () => { const guardada = await cargarValor(CONFIGURACION_KEY); if (guardada) setConfiguracion((c) => ({ ...c, ...guardada })); setConfiguracionCargada(true); })(); }, []);
  useEffect(() => { if (configuracionCargada) guardarValor(CONFIGURACION_KEY, configuracion); }, [configuracion, configuracionCargada]);
  usarRecordatorios(materias, configNotificaciones, configuracion.asistenciaMinima, configNotificacionesCargada);
  useEffect(() => {
    const atajo = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setBusquedaAbierta((v) => !v); }
    };
    window.addEventListener("keydown", atajo); return () => window.removeEventListener("keydown", atajo);
  }, []);

  const abrirMateria = (id, tab = "inicio") => {
    setMateriaAbiertaId(id);
    setTabMateriaInicial(tab);
    if (view !== "materias") setView("materias");
  };

  // Cuando cargás un evento en Calendario y elegís "vincular como examen",
  // esto lo agrega a la materia correspondiente — así aparece también en
  // Próximos exámenes de esa materia y en el Inicio general.
  const vincularExamenDesdeEvento = (materiaId, examen) => {
    setMaterias((prev) => prev.map((m) => (m.id === materiaId ? { ...m, examenes: [...(m.examenes || []), examen] } : m)));
  };

  const completarTarea = (materiaId, tareaId) => {
    setMaterias((prev) => prev.map((m) => {
      if (m.id !== materiaId) return m;
      return {
        ...m,
        tareas: (m.tareas || []).map((t) => {
          if (t.id !== tareaId) return t;
          if (t.recurrencia && !t.completada) {
            // Misma lógica que en el detalle de materia: una tarea
            // recurrente no queda tildada para siempre, salta a la
            // próxima fecha.
            return { ...t, fecha: proximaFechaRecurrente(t.recurrencia.diaSemana, t.fecha), vecesCompletada: (t.vecesCompletada || 0) + 1 };
          }
          return { ...t, completada: !t.completada };
        }),
      };
    }));
  };

  const confirmarResetDatosEjemplo = () => {
    setMaterias(seedData().materias);
    setMateriaAbiertaId(null);
    setConfirmarReset(false);
  };

  return (
    <div className={`app-shell ${tema === "oscuro" ? "app-shell-oscuro" : ""} ${esTablet ? "app-shell-tablet" : ""}`}>
      <style>{`
        ${FONT_IMPORT}

        /* Animaciones compartidas para overlays, modales y menús — suaves
           pero rápidas (120–220ms) para que se sientan ágiles, no lentas. */
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPopIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panelSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes menuPopIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes revealIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes confettiCaida {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), 105vh) rotate(var(--rot)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .modal-overlay, .modal-card, .detalle-overlay, .detalle-panel, .visor-overlay, .fila-menu-pop,
          .fila-historial, .subtareas-panel {
            animation: none !important;
          }
          .confetti-wrap { display: none; }
        }

        .app-shell, .app-shell * { box-sizing: border-box; }
        .app-shell {
          color-scheme: light;
          --ink: #23271F;
          --ink-soft: #666157;
          --paper: #EDEADD;
          --paper-2: #E2DDC9;
          --card: #F6F3E7;
          --forest: #2F4D34;
          --forest-dark: #203524;
          --ochre: #C4842E;
          --brick: #9C3B2E;
          --line: #CBC3A6;
          --line-soft: #DDD6BC;
          --input-bg: #FFFEF9;
          --sidebar-bg: #2F4D34;
          font-family: 'IBM Plex Sans', sans-serif;
          color: var(--ink);
          background: var(--paper);
          height: 100vh;
          height: 100dvh;
          display: flex;
          overflow: hidden;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .app-shell-oscuro {
          color-scheme: dark;
          --ink: #EDE9DC;
          --ink-soft: #A79F8C;
          --paper: #1B1C16;
          --paper-2: #2C2D21;
          --card: #232419;
          --forest: #4E8A63;
          --forest-dark: #3D6E50;
          --ochre: #DBA35C;
          --brick: #D97A62;
          --line: #3C3D30;
          --line-soft: #2C2D22;
          --input-bg: #17180F;
        }
        .app-shell-oscuro, .app-shell-oscuro * { transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
        h1, h2, h3 { font-family: 'Fraunces', serif; font-weight: 600; margin: 0; color: var(--ink); }
        h1 { font-size: 26px; letter-spacing: -0.01em; }
        h2 { font-size: 16px; margin-bottom: 12px; }
        h3 { font-size: 17px; margin: 10px 0 4px; }
        p { margin: 0; }
        .muted { color: var(--ink-soft); font-size: 13px; }
        .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ochre); margin: 0 0 4px; }

        /* Sidebar */
        .sidebar { width: 208px; flex-shrink: 0; background: var(--sidebar-bg); color: #EDE9D8; display: flex; flex-direction: column; padding: 20px 14px; gap: 22px; }
        .sidebar-brand { display: flex; align-items: center; gap: 8px; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; padding: 0 6px; }
        .sidebar-nav { display: flex; flex-direction: column; gap: 3px; }
        .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; background: none; border: none; color: #D8D3BE; font-size: 14px; font-family: inherit; cursor: pointer; text-align: left; transition: background 0.15s; }
        .sidebar-item:hover { background: rgba(237,233,216,0.08); color: #F6F3E7; }
        .sidebar-item-active { background: rgba(237,233,216,0.14); color: #FDFBF2; font-weight: 600; }
        .sidebar-buscar { background: rgba(237,233,216,0.08); margin-bottom: 5px; }
        .sidebar-carne { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--forest-dark); border-radius: 10px; }
        .ring { width: 40px; height: 40px; flex-shrink: 0; }
        .sidebar-carne-text { display: flex; flex-direction: column; line-height: 1.25; }
        .sidebar-carne-text strong { font-family: 'IBM Plex Mono', monospace; font-size: 15px; }
        .sidebar-carne-text span { font-size: 11px; color: #B9B49C; }
        .sidebar-reset { display: flex; align-items: center; gap: 6px; justify-content: center; background: none; border: none; font-family: inherit; font-size: 10.5px; color: #A39C7F; cursor: pointer; padding: 8px 4px 2px; text-align: center; }
        .sidebar-reset:hover { color: #F6F3E7; text-decoration: underline; }
        .sidebar-tema { display: flex; align-items: center; gap: 6px; justify-content: center; background: rgba(237,233,216,0.08); border: 1px solid rgba(237,233,216,0.18); border-radius: 8px; font-family: inherit; font-size: 11px; font-weight: 600; color: #EDE9D8; cursor: pointer; padding: 8px; margin-top: 4px; transition: background 0.15s; }
        .sidebar-tema:hover { background: rgba(237,233,216,0.16); }

        /* Layout general */
        .main-area { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
        .calendario-persistente { flex: 1; min-height: 0; flex-direction: column; }
        .focus-persistente { flex: 1; min-height: 0; flex-direction: column; }
        .aviso-guardado { flex-shrink: 0; background: #F1DAD3; border-bottom: 1px solid #E0B8AC; color: var(--brick); font-size: 12.5px; font-weight: 600; padding: 10px 24px; }
        .view { flex: 1; min-width: 0; min-height: 0; padding: 32px 36px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .view-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }

        .busqueda-overlay { position: fixed; z-index: 200; inset: 0; padding: 7vh 20px 20px; background: rgba(24, 27, 20, 0.28); display: flex; justify-content: center; align-items: flex-start; animation: overlayFadeIn .15s ease-out; }
        .busqueda-global { width: min(720px, 100%); display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 12px 34px rgba(0,0,0,.24); animation: modalPopIn .18s ease-out; }
        .busqueda-global-input { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: var(--ink-soft); border-radius: 10px; }
        .busqueda-global-input:not(:only-child) { border-radius: 10px 10px 0 0; }
        .busqueda-global-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; font-size: 15px; }
        .busqueda-global kbd { border: 1px solid var(--line); border-radius: 4px; padding: 2px 5px; font: 10px 'IBM Plex Mono', monospace; color: var(--ink-soft); }
        .busqueda-selector { position: relative; display: flex; align-items: center; flex: 0 0 auto; border-left: 1px solid var(--line); padding-left: 12px; }
        .busqueda-selector-btn { display: flex; align-items: center; gap: 6px; border: 0; outline: 0; background: transparent; color: var(--ink-soft); padding: 4px 0; font: 13px inherit; cursor: pointer; white-space: nowrap; }
        .busqueda-selector-btn:hover { color: var(--ink); }
        .busqueda-selector-btn svg:last-child { flex-shrink: 0; }
        .busqueda-selector-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .busqueda-categoria-pop { top: 36px; min-width: 190px; }
        .fila-menu-pop button.activo { background: var(--paper-2); font-weight: 600; }
        .busqueda-categoria-check { margin-left: auto; color: var(--ink-soft); flex-shrink: 0; }
        .busqueda-resultados { max-height: min(480px, 62vh); overflow-y: auto; padding: 7px; border-top: 1px solid var(--line); border-radius: 0 0 10px 10px; }
        .busqueda-resultados > .muted { padding: 20px 12px; line-height: 1.5; }
        .busqueda-resultado { width: 100%; display: grid; grid-template-columns: 78px minmax(0,1fr) 18px; align-items: center; gap: 10px; text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 10px; color: var(--ink); cursor: pointer; font-family: inherit; }
        .busqueda-resultado:hover { background: var(--paper-2); }
        .busqueda-resultado strong, .busqueda-resultado small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .busqueda-resultado strong { font-size: 13px; }.busqueda-resultado small { margin-top: 3px; color: var(--ink-soft); font-size: 11.5px; }.busqueda-tipo { color: var(--ochre); font: 700 9.5px 'IBM Plex Mono', monospace; text-transform: uppercase; }
        .notificacion-permitida { display: flex; align-items: center; gap: 7px; color: var(--forest); font-size: 13px; font-weight: 600; padding: 8px 0; }
        .notificaciones-opciones { border-top: 1px solid var(--line-soft); border-bottom: 1px solid var(--line-soft); margin: 16px 0; }
        .notificacion-opcion { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; font-size: 13.5px; }.notificacion-opcion input { width: 17px; height: 17px; accent-color: var(--forest); }
        .notificacion-select { display: flex; flex-direction: column; gap: 6px; margin: 13px 0; color: var(--ink-soft); font-size: 12px; font-weight: 600; }.notificacion-select select { color: var(--ink); background: var(--input-bg); border: 1px solid var(--line); padding: 8px; border-radius: 6px; font: inherit; }
        .configuracion-view { max-width: 760px; }
        .configuracion-seccion { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
        .configuracion-seccion h2, .configuracion-recordatorios h2 { margin-bottom: 5px; }
        .configuracion-seccion .muted, .configuracion-recordatorios > div > .muted { margin: 0; }
        .configuracion-porcentaje { display: flex; align-items: center; gap: 7px; flex-shrink: 0; color: var(--ink-soft); font-size: 12px; font-weight: 600; }
        .configuracion-porcentaje input { width: 64px; padding: 8px; text-align: center; color: var(--ink); background: var(--input-bg); border: 1px solid var(--line); border-radius: 6px; font: inherit; }
        .configuracion-porcentaje b { color: var(--ink); }
        .configuracion-recordatorios { margin-bottom: 14px; }
        .configuracion-recordatorios .btn-primario { margin-top: 16px; }
        .configuracion-selects { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .btn-primario { display: inline-flex; align-items: center; gap: 6px; background: var(--forest); color: #F6F3E7; border: none; padding: 10px 16px; border-radius: 8px; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-primario:hover { background: var(--forest-dark); }
        .btn-primario:disabled, .btn-secundario:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-peligro { display: inline-flex; align-items: center; gap: 6px; background: var(--brick); color: #FBEEE9; border: none; padding: 10px 16px; border-radius: 8px; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-peligro:hover { background: #7E2F22; }
        .btn-secundario { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--ink); border: 1px solid var(--line); padding: 9px 14px; border-radius: 8px; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-secundario:hover { border-color: var(--ink); }
        .btn-chico { padding: 6px 11px; font-size: 12.5px; }
        .link-btn { background: none; border: none; color: var(--forest); font-family: inherit; font-weight: 600; font-size: 12.5px; cursor: pointer; padding: 10px 0 0; }
        .link-btn:hover { text-decoration: underline; }

        .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 7px; background: transparent; border: none; color: var(--ink-soft); cursor: pointer; transition: all 0.15s; }
        .icon-btn:hover { background: var(--paper-2); color: var(--ink); }
        .icon-btn-danger:hover { background: #F1DAD3; color: var(--brick); }


        /* Dashboard */
        .dos-columnas { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start; }
        .columna-izquierda, .columna-derecha { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .panel { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 20px; }

        .lista-eventos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .evento-fila { display: flex; align-items: center; gap: 10px; padding: 9px 6px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
        .evento-fila:hover { background: var(--paper-2); }
        .evento-tipo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .evento-fila-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .evento-fila-texto strong { font-size: 13.5px; }
        .evento-dias { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); white-space: nowrap; }

        .lista-materias-mini { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-materias-mini li { display: flex; align-items: center; gap: 10px; padding: 9px 6px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
        .lista-materias-mini li:hover { background: var(--paper-2); }
        .tab-color { width: 4px; align-self: stretch; border-radius: 3px; flex-shrink: 0; }
        .lista-materias-texto { display: flex; flex-direction: column; }
        .lista-materias-texto strong { font-size: 13.5px; }

        .panel-pendientes-grande { border-top: 3px solid var(--ochre); padding: 22px 24px; }
        .panel-examenes-grande { border-top-color: var(--brick); }
        .panel-examenes-contador { background: var(--brick); }
        .panel-faltas-alerta { border-top-color: var(--brick); }
        .panel-faltas-contador { background: var(--brick); }
        .panel-pendientes-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .panel-pendientes-head h2 { margin: 0; font-size: 18px; }
        .panel-pendientes-contador { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: #F6F3E7; background: var(--ochre); border-radius: 20px; padding: 2px 10px; }
        .plan-estudio > .muted { margin: -6px 0 10px; }.plan-estudio-lista { display: flex; flex-direction: column; gap: 4px; }.plan-estudio-lista button { display: grid; grid-template-columns: 8px 1fr auto; gap: 10px; align-items: center; padding: 9px 6px; border: 0; border-radius: 8px; text-align: left; background: transparent; color: var(--ink); font: inherit; cursor: pointer; }.plan-estudio-lista button:hover { background: var(--paper-2); }.plan-estudio-lista button > span { width: 7px; height: 30px; border-radius: 6px; }.plan-estudio-lista strong,.plan-estudio-lista small { display: block; }.plan-estudio-lista strong { font-size: 13px; }.plan-estudio-lista small { color: var(--ink-soft); font-size: 11.5px; margin-top: 2px; }.plan-estudio-lista b { font: 700 11px 'IBM Plex Mono', monospace; color: var(--forest); white-space: nowrap; }
        .lista-pendientes-grande { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .pendiente-fila-grande { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; align-items: center; column-gap: 14px; padding: 13px 10px; border-radius: 10px; border-bottom: 1px solid var(--line-soft); }
        .pendiente-fila-grande:last-child { border-bottom: none; }
        .pendiente-fila-grande:hover { background: var(--paper-2); }
        .pendiente-texto-grande { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; cursor: pointer; }
        .pendiente-texto-grande strong { font-size: 14.5px; }
        .pendiente-texto-grande .muted { font-size: 12.5px; }

        /* Materias */
        .materias-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .buscador { display: flex; align-items: center; gap: 8px; background: var(--input-bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 200px; max-width: 320px; color: var(--ink-soft); }
        .buscador input { border: none; padding: 0; background: none; flex: 1; }
        .buscador input:focus { outline: none; }
        .buscador-limpiar { background: none; border: none; color: var(--ink-soft); cursor: pointer; display: flex; padding: 2px; }
        .modo-toggle { display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
        .modo-toggle button { display: flex; align-items: center; gap: 6px; padding: 8px 13px; background: transparent; border: none; border-right: 1px solid var(--line); font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
        .modo-toggle button:last-child { border-right: none; }
        .modo-toggle-activo { background: var(--forest) !important; color: #F6F3E7 !important; }

        .filtros { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filtro-chip { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--ink-soft); cursor: pointer; }
        .filtro-chip-activo { background: var(--forest); color: #F6F3E7; border-color: var(--forest); }

        .tabs-anio { display: flex; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); margin-bottom: 18px; }
        .tab-anio { flex: 1; padding: 11px 8px; border: none; border-right: 1px solid rgba(0,0,0,0.08); background: var(--tc); color: var(--tct); font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; opacity: 0.68; transition: opacity 0.15s; }
        .tab-anio:last-child { border-right: none; }
        .tab-anio:hover { opacity: 0.85; }
        .tab-anio-activo { opacity: 1; box-shadow: inset 0 -3px 0 var(--ochre); }

        .lista-materias-panel { background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
        .lista-materias-vacia { padding: 22px; }
        .grupo-anio-titulo { font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-soft); font-weight: 700; padding: 9px 18px; margin: 0; background: var(--paper-2); border-top: 1px solid var(--line-soft); border-bottom: 1px solid var(--line-soft); }
        .grupo-anio:first-child .grupo-anio-titulo { border-top: none; border-top-left-radius: 12px; border-top-right-radius: 12px; }

        .fila-materia-wrap { position: relative; }
        .fila-materia { position: relative; display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--line-soft); cursor: pointer; transition: background 0.15s; }
        .grupo-anio:first-child .fila-materia-wrap:first-child .fila-materia, .lista-materias-panel > .fila-materia-wrap:first-child .fila-materia { border-top: none; border-top-left-radius: 12px; border-top-right-radius: 12px; }
        .grupo-anio:last-child .fila-materia-wrap:last-child .fila-materia, .lista-materias-panel > .fila-materia-wrap:last-child .fila-materia { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
        .fila-materia:hover { background: var(--paper-2); }
        /* Ojo: el atenuado de "Pendiente" se aplica solo al contenido visual
           (punto, texto, pill, flecha), nunca a .fila-menu. Si opacity/filter
           envuelve también al menú "⋮", crea un nuevo contexto de apilamiento
           que hace que el desplegable de opciones se renderice mal (atrapado
           detrás de las filas siguientes). */
        .fila-materia-inactiva .fila-dot,
        .fila-materia-inactiva .fila-texto,
        .fila-materia-inactiva .fila-promedio,
        .fila-materia-inactiva .fila-pill,
        .fila-materia-inactiva .fila-chevron {
          opacity: 0.55;
          filter: grayscale(0.7);
        }
        .fila-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .fila-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .fila-nombre { display: flex; align-items: center; gap: 6px; }
        .fila-nombre strong { font-size: 14px; }
        .fila-lock { display: inline-flex; color: var(--ochre); }
        .fila-promedio { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: var(--forest); }
        .fila-pill { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; color: var(--sc); border: 1.5px solid var(--sc); border-radius: 20px; padding: 4px 11px; background: color-mix(in srgb, var(--sc) 10%, transparent); }
        .fila-chevron { flex-shrink: 0; color: var(--ink-soft); transition: transform 0.15s; }
        .fila-chevron-abierto { transform: rotate(180deg); color: var(--forest); }
        .fila-historial { padding: 4px 18px 18px 39px; border-top: 1px dashed var(--line); background: var(--paper-2); animation: revealIn 0.15s ease-out; }
        .grupo-anio:last-child .fila-materia-wrap:last-child .fila-historial, .lista-materias-panel > .fila-materia-wrap:last-child .fila-historial { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
        .fila-historial-vacio, .fila-historial-sin { margin: 8px 0; font-size: 12.5px; }
        .fila-historial-promo { margin: 8px 0; font-size: 12.5px; font-weight: 600; color: var(--forest); }
        .fila-historial-grupos { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding-top: 12px; }
        .fila-historial-titulo { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ochre); font-weight: 700; margin: 0 0 6px; }
        .fila-historial-grupo ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .fila-historial-grupo li { display: flex; align-items: center; gap: 9px; font-size: 12.5px; padding: 5px 8px; border-radius: 7px; }
        .fila-historial-grupo li:hover { background: var(--card); }
        .fila-historial-grupo li > span:first-child { color: var(--ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fila-historial-nota { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; font-weight: 700; color: var(--forest); background: color-mix(in srgb, var(--forest) 14%, transparent); padding: 2px 9px; border-radius: 20px; }
        .fila-historial-verdetalle { margin-top: 14px; }
        .fila-menu { position: relative; flex-shrink: 0; }
        .fila-menu-backdrop { position: fixed; inset: 0; z-index: 10; }
        .fila-menu-pop { position: absolute; right: 0; top: 34px; z-index: 11; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 6px 18px rgba(35,39,31,0.18); overflow: hidden; min-width: 168px; transform-origin: top right; animation: menuPopIn 0.12s ease-out; }
        .fila-menu-pop button, .fila-menu-pop a { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 12px; background: none; border: none; font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; text-align: left; text-decoration: none; }
        .fila-menu-pop button:hover, .fila-menu-pop a:hover { background: var(--paper-2); }
        .fila-menu-danger { color: var(--brick) !important; }
        .fila-menu-label { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); padding: 8px 12px 2px; margin: 0; }
        .fila-menu-separador { height: 1px; background: var(--line-soft); margin: 4px 0; }
        .fila-menu-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .calendario-menu-config { position: relative; }
        .calendario-menu-pop { min-width: 210px; }

        /* Formularios */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .campo { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
        .campo-full { grid-column: 1 / -1; }
        .campo-checkbox { flex-direction: row; align-items: center; gap: 8px; }
        .campo-checkbox input[type="checkbox"] { width: 15px; height: 15px; flex-shrink: 0; }
        .campo-checkbox span { font-weight: 500; color: var(--ink); }
        .selector-correlativas { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--line); border-radius: 8px; padding: 4px; }
        .correlativas-buscador { display: flex; align-items: center; gap: 7px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; margin: 6px 0; color: var(--ink-soft); }
        .correlativas-buscador input { flex: 1; border: 0; outline: 0; background: transparent; font: inherit; color: var(--ink); padding: 0; }
        .correlativas-buscador-limpiar { border: 0; background: transparent; color: var(--ink-soft); cursor: pointer; display: flex; padding: 2px; flex-shrink: 0; }
        .correlativas-buscador-limpiar:hover { color: var(--ink); }
        .selector-correlativas-item { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 6px; cursor: pointer; font-weight: 500; color: var(--ink); }
        .selector-correlativas-item:hover { background: var(--paper-2); }
        .selector-correlativas-item-on { background: color-mix(in srgb, var(--forest) 10%, transparent); }
        .selector-correlativas-item input { margin: 0; flex-shrink: 0; width: 15px; height: 15px; padding: 0; border-radius: 4px; }
        .selector-correlativas-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .selector-correlativas-nombre { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .selector-correlativas-anio { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-soft); flex-shrink: 0; }
        input, select, textarea { font-family: inherit; font-size: 13.5px; color: var(--ink); background: var(--input-bg); border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; width: 100%; }
        input:focus, select:focus, textarea:focus { outline: 2px solid var(--forest); outline-offset: 1px; border-color: var(--forest); }
        textarea { resize: vertical; font-weight: 400; }

        .color-picker { width: 100%; max-width: none; padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); box-shadow: 0 5px 16px rgba(35,39,31,0.06); }
        .color-picker-tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
        .color-picker-tabs button { position: relative; border: 0; background: transparent; padding: 0 2px 10px; color: var(--ink-soft); font: inherit; cursor: pointer; }
        .color-picker-tabs button.color-picker-tab-active { color: var(--ink); font-weight: 700; }
        .color-picker-tabs button.color-picker-tab-active:after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: 3px; border-radius: 3px; background: #9147ff; }
        .color-spectrum { position: relative; height: 140px; border-radius: 10px; background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--hue)); cursor: crosshair; touch-action: none; }
        .color-spectrum-thumb { position: absolute; left: var(--x); top: var(--y); width: 18px; height: 18px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #0007; transform: translate(-50%, -50%); pointer-events: none; }
        .color-hue { position: relative; height: 14px; margin: 12px 0; border-radius: 999px; background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); cursor: pointer; touch-action: none; }
        .color-hue span { position: absolute; top: 50%; width: 18px; height: 18px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #0007; transform: translate(-50%, -50%); pointer-events: none; }
        .color-gradient-preview { display: grid; min-height: 166px; place-items: center; border-radius: 10px; padding: 20px; color: #fff; text-align: center; text-shadow: 0 1px 3px #0008; }
        .color-gradient-preview p { max-width: 210px; margin: 0; font-size: 13px; font-weight: 600; line-height: 1.4; }
        .color-picker-footer { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .color-current { width: 26px; height: 26px; border: 1px solid var(--line); border-radius: 50%; flex: none; }
        .color-hex-input { min-width: 0; flex: 1; margin: 0; padding: 8px 10px; }
        .color-native-input { position: relative; display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); font-size: 18px; cursor: pointer; }
        .color-native-input input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; }
        .color-preset-row { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 13px; }
        .color-swatch { width: 21px; height: 21px; border: 2px solid transparent; border-radius: 50%; cursor: pointer; }
        .color-swatch-active { outline: 2px solid var(--ink); outline-offset: 2px; }

        .horario-fila { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .periodo-cursada-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .campo-sublabel { font-size: 11.5px; }
        .horario-fila select, .horario-fila input { width: auto; flex: 1; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(35,39,31,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: overlayFadeIn 0.15s ease-out; }
        .modal-card { background: var(--paper); border-radius: 14px; width: 460px; max-width: 100%; max-height: 88vh; overflow-y: auto; border: 1px solid var(--line); animation: modalPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-wide { width: 620px; }
        .visor-overlay { position: fixed; inset: 0; z-index: 130; background: var(--paper); display: flex; flex-direction: column; animation: overlayFadeIn 0.15s ease-out; }
        .confetti-wrap { position: fixed; inset: 0; z-index: 200; overflow: hidden; pointer-events: none; }
        .confetti-pieza { position: absolute; top: -12px; border-radius: 2px; opacity: 0.95; animation-name: confettiCaida; animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); animation-fill-mode: forwards; }
        .visor-barra { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: var(--card); }
        .visor-nombre { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .visor-contenido { flex: 1; min-height: 0; overflow: auto; display: flex; background: #5B5B52; }
        .visor-pdf-full { flex: 1; border: none; width: 100%; height: 100%; }
        .visor-imagen-full { max-width: 100%; max-height: 100%; margin: auto; display: block; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 6px; }
        .modal-body { padding: 6px 20px 20px; }
        .modal-acciones { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; grid-column: 1 / -1; }

        /* Calendario — Google Calendar embebido */
        .view-sin-padding-abajo { display: flex; flex-direction: column; padding-bottom: 24px; }
        .view-head-calendario { flex-shrink: 0; }
        .calendario-acciones-head { display: flex; gap: 8px; flex-wrap: wrap; }
        .calendario-embed-col { flex: 1; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
        .calendario-embed-wrap { flex: 1; min-height: 420px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
        .aviso-preview { flex-shrink: 0; background: #FBE9CE; border: 1px solid #E0BE85; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; line-height: 1.5; color: var(--ink); }
        .calendario-embed { width: 100%; height: calc(100% + 68px); min-height: 628px; margin-bottom: -68px; border: none; display: block; }
        .calendario-vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; max-width: 420px; color: var(--ink-soft); }
        .calendario-vacio h2 { color: var(--ink); }
        .calendario-edicion-barra { flex-shrink: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 10px 0 4px; }
        .calendario-edicion-nota { font-size: 12.5px; }
        .link-btn-chico { background: none; border: none; color: var(--ink-soft); font-family: inherit; font-weight: 600; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 0; }

        /* Calendario nativo (conectado con Google) */
        .calendario-nativo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; }
        .calendario-nativo-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        .calendario-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
        .calendario-nav-izq { display: flex; align-items: center; gap: 10px; }
        .calendario-nav-centro { display: flex; align-items: center; gap: 8px; font-family: 'Fraunces', serif; font-size: 15px; }
        .calendario-dias-header { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); margin-bottom: 4px; }
        .calendario-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: minmax(84px, 1fr); gap: 4px; }
        .calendario-celda { position: relative; border-radius: 8px; border: 2px solid transparent; background: var(--paper-2); font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink); cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 6px; text-align: left; overflow: hidden; }
        .calendario-celda:hover { border-color: var(--line); }
        .calendario-celda-vacia { background: transparent; cursor: default; }
        .calendario-celda-vacia:hover { border-color: transparent; }
        .calendario-celda-hoy { background: color-mix(in srgb, var(--forest) 8%, var(--paper-2)); border-color: color-mix(in srgb, var(--forest) 40%, var(--line)); }
        .calendario-celda-hoy .calendario-celda-num { color: var(--forest); font-weight: 700; }
        .calendario-celda-sel { border-color: var(--forest); }
        .calendario-celda-num { font-weight: 600; }
        .calendario-evento-chip { width: 100%; font-family: 'IBM Plex Sans', sans-serif; font-size: 10px; color: #fff; border-radius: 4px; padding: 1px 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .calendario-evento-chip-importante { display: flex; flex-direction: column; gap: 0; width: calc(100% + 6px); margin: 0 -3px; padding: 2.5px 8px; box-shadow: 0 1px 3px rgba(35,39,31,0.28); white-space: normal; }
        .calendario-evento-chip-titulo { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .calendario-evento-chip-desc { font-size: 8.5px; font-weight: 400; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .calendario-evento-mas { font-size: 9.5px; color: var(--ink-soft); }
        .calendario-clases-barra { display: flex; width: 100%; height: 16px; border-radius: 999px; overflow: hidden; margin-top: 2px; }
        .calendario-clases-seg { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Sans', sans-serif; font-size: 8.5px; font-weight: 700; color: #fff; overflow: hidden; white-space: nowrap; padding: 0 2px; }
        .lista-eventos-google { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-eventos-google li { display: flex; align-items: center; gap: 8px; padding: 8px 6px; border-radius: 8px; }
        .lista-eventos-google li:hover { background: var(--paper-2); }
        .lista-eventos-google-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .lista-eventos-google-texto strong { font-size: 13px; }
        .lista-eventos-google-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        /* Pestaña "Inicio" de cada materia (el mini-workspace) */
        .materia-inicio-layout .panel { margin-bottom: 14px; }
        .materia-inicio-layout .columna-izquierda .panel:last-child,
        .materia-inicio-layout .columna-derecha .panel:last-child { margin-bottom: 0; }
        .materia-inicio-dato { font-size: 15px; margin: 0 0 4px; }
        .materia-inicio-nota { max-height: 90px; overflow: hidden; text-overflow: ellipsis; }
        .progreso-barra { width: 100%; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 8px 0 6px; }
        .progreso-barra-relleno { height: 100%; background: var(--forest); border-radius: 999px; transition: width 0.2s; }
        .progreso-general { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 14px; }.progreso-general > div { min-width: 0; }.progreso-general strong,.progreso-general small { display: block; }.progreso-general strong { font: 600 21px 'Fraunces', serif; margin-top: 3px; color: var(--forest); }.progreso-general small { color: var(--ink-soft); font-size: 10.5px; }.progreso-general .progreso-barra { margin: 8px 0 6px; }.progreso-link { display: inline; padding: 0; font-size: inherit; }

        /* Vista semanal (grilla horaria estilo Google Calendar) */
        .semana-grid-wrap { overflow-x: auto; }
        .semana-grid { display: grid; grid-template-columns: 52px repeat(7, minmax(108px, 1fr)); min-width: 760px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
        .semana-esquina { grid-column: 1; grid-row: 1; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); }
        .semana-dia-header { grid-row: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line-soft); background: transparent; cursor: pointer; font-family: inherit; padding: 6px 2px; }
        .semana-dia-header:hover { background: var(--paper-2); }
        .semana-dia-header-sel { background: var(--paper-2); }
        .semana-dia-nombre { font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); }
        .semana-dia-numero { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; color: var(--ink); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .semana-dia-numero-hoy { background: var(--forest); color: #F6F3E7; }
        .semana-dia-todoeldia { font-size: 9px; color: var(--ink-soft); }
        .semana-hora-label { grid-column: 1; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); text-align: right; padding-right: 8px; border-right: 1px solid var(--line); border-top: 1px solid var(--line-soft); display: flex; align-items: flex-start; justify-content: flex-end; padding-top: 2px; }
        .semana-columna { position: relative; border-right: 1px solid var(--line-soft); }
        .semana-celda { position: absolute; left: 0; right: 0; border: none; background: transparent; border-top: 1px solid var(--line-soft); cursor: pointer; padding: 0; }
        .semana-celda:hover { background: var(--paper-2); }
        .semana-hora-actual { position: absolute; left: 0; right: 0; height: 0; border-top: 2px solid var(--brick); z-index: 3; }
        .semana-hora-actual::before { content: ""; position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--brick); }
        .semana-evento { position: absolute; left: 2px; right: 2px; z-index: 4; border-radius: 6px; border: none; color: #fff; text-align: left; padding: 4px 6px; cursor: pointer; display: flex; flex-direction: column; gap: 1px; overflow: hidden; font-family: inherit; box-shadow: 0 1px 3px rgba(35,39,31,0.18); }
        .semana-evento strong { font-size: 10.5px; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .semana-evento span { font-family: 'IBM Plex Mono', monospace; font-size: 9px; opacity: 0.9; }
        .semana-evento .semana-evento-desc { font-family: 'IBM Plex Sans', sans-serif; font-size: 8.5px; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ayuda-calendario { background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: 10px; padding: 14px 16px; margin-top: 4px; }
        .ayuda-calendario-aviso { background: #F1DAD3; border-color: #E0B8AC; margin-bottom: 10px; }
        .ayuda-calendario-aviso p:last-child { font-size: 12.5px; color: var(--ink); margin: 0; line-height: 1.5; }
        .ayuda-calendario-titulo { font-weight: 700; font-size: 12.5px; margin-bottom: 6px; }
        .ayuda-calendario ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--ink-soft); }
        .ayuda-calendario li strong { color: var(--ink); }

        .chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: 20px; padding: 3px 9px; margin: 2px 4px 2px 0; }

        /* Detalle materia */
        .detalle-overlay { position: fixed; inset: 0; background: rgba(35,39,31,0.45); z-index: 90; display: flex; justify-content: flex-end; animation: overlayFadeIn 0.15s ease-out; }
        .detalle-panel { width: max(560px, 50vw); max-width: 100%; height: 100%; background: var(--paper); overflow-y: auto; padding-bottom: 30px; animation: panelSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
        .detalle-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 3px solid var(--mc); background: var(--card); }
        .volver { display: flex; align-items: center; gap: 6px; background: none; border: none; font-family: inherit; font-weight: 600; font-size: 13.5px; color: var(--ink); cursor: pointer; }
        .detalle-head-acciones { display: flex; gap: 4px; }
        .detalle-titulo { padding: 20px 24px 6px; }
        .detalle-estado-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sc); margin: 0; }
        .detalle-fecha-aprobada { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #3D6B4F; font-weight: 600; margin-top: 6px; }
        .detalle-titulo h2 { margin-top: 4px; font-size: 22px; }
        .detalle-horarios { margin-top: 10px; }

        .tabs { display: flex; gap: 4px; padding: 16px 24px 0; border-bottom: 1px solid var(--line); }
        .tab { position: relative; font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 14px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--ink-soft); cursor: pointer; }
        .tab-activo { color: var(--forest); border-color: var(--forest); font-weight: 700; }
        .tab-con-alerta { color: var(--brick); }
        .tab-dot { position: absolute; top: 5px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--brick); }
        .tab-panel { padding: 20px 24px; }

        .lista-recursos { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-recursos li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; }
        .lista-recursos li:hover { background: var(--paper-2); }
        .lista-recursos-texto { display: flex; flex-direction: column; flex: 1; }
        .lista-recursos-texto strong { font-size: 13px; }
                .adjuntar-archivo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
        .adjuntar-archivo-btn { cursor: pointer; }
        .adjuntar-archivo-nombre { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: var(--paper-2); border-radius: 20px; padding: 4px 10px; }
        .adjuntar-archivo-nombre button { background: none; border: none; display: flex; cursor: pointer; color: var(--ink-soft); padding: 0; }
        .adjuntar-archivo-ayuda { font-size: 11px; color: var(--ink-soft); }
        .adjuntar-archivo-error { font-size: 12px; color: var(--brick); margin-top: 6px; }

        /* Asistencia */
        .asistencia-resumen { display: flex; align-items: center; gap: 20px; width: 100%; margin-bottom: 20px; }
        .asistencia-aro { position: relative; width: 84px; height: 84px; flex-shrink: 0; }
        .asistencia-aro svg { width: 100%; height: 100%; }
        .asistencia-aro-texto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; }
        .asistencia-datos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .asistencia-estado { font-weight: 600; font-size: 14px; color: #3D6B4F; }
        .asistencia-estado-riesgo { color: var(--brick); }

        .asistencia-alerta-chica { display: inline-block; margin-top: 4px; font-size: 12px; font-weight: 600; color: var(--brick); }
        .asistencia-periodo-ayuda { margin: 0 0 18px; font-size: 12.5px; line-height: 1.5; }
        .asistencia-editar-link { display: inline; background: none; border: none; padding: 0; margin: 0; font: inherit; font-weight: 600; color: var(--forest); text-decoration: underline; cursor: pointer; }
        .asistencia-editar-link:hover { color: var(--forest-dark); }

        .asistencia-stepper { display: flex; align-items: center; justify-content: center; gap: 26px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
        .asistencia-stepper-btn { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--paper); color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
        .asistencia-stepper-btn:hover { border-color: var(--forest); color: var(--forest); background: var(--paper-2); }
        .asistencia-stepper-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .asistencia-stepper-btn-sumar:hover { border-color: var(--brick); color: var(--brick); }
        .asistencia-stepper-num { display: flex; flex-direction: column; align-items: center; min-width: 76px; }
        .asistencia-stepper-num strong { font-family: 'Fraunces', serif; font-size: 36px; line-height: 1; color: var(--brick); }
        .asistencia-stepper-num span { margin-top: 4px; font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; }
        .asistencia-reset-link { display: block; margin: 10px auto 0; background: none; border: none; padding: 4px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }
        .asistencia-reset-link:hover { color: var(--brick); }

        /* Focus */
        .focus-panel-timer { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .focus-select-materia { width: 100%; }
        .focus-timer-wrap { position: relative; width: 220px; height: 220px; flex-shrink: 0; }
        .focus-timer-svg { width: 100%; height: 100%; }
        .focus-timer-texto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 20px; }
        .focus-timer-texto strong { font-family: 'IBM Plex Mono', monospace; font-size: 42px; font-weight: 700; color: var(--ink); line-height: 1; }
        .focus-fase-label { margin: 2px 0 0; font-size: 12.5px; text-align: center; }
        .focus-controles { display: flex; gap: 10px; }
        .focus-duraciones { display: flex; gap: 14px; width: 100%; align-items: flex-end; }
        .focus-duraciones .campo { flex: 1; }
        .focus-duraciones-listo { flex-shrink: 0; }
        .focus-duraciones-resumen { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; font-size: 13px; }
        .focus-duraciones-resumen strong { color: var(--ink); }
        .focus-duraciones-resumen .link-btn { padding: 0; }
        .focus-resumen-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .focus-resumen-head h2 { margin: 0; }
        .focus-rango-toggle { flex-shrink: 0; }
        .focus-resumen-total { margin: 0 0 14px; font-size: 14px; }
        .focus-resumen-total strong { font-family: 'Fraunces', serif; font-size: 20px; color: var(--forest); }
        .focus-resumen-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .focus-resumen-fila-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
        .focus-resumen-nombre { font-size: 13px; font-weight: 600; }
        .focus-resumen-barra { width: 100%; height: 7px; border-radius: 999px; background: var(--line); overflow: hidden; }
        .focus-resumen-barra-relleno { height: 100%; border-radius: 999px; transition: width 0.2s; }

        /* Exámenes */
        .promedio-card { display: flex; align-items: baseline; justify-content: space-between; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
        .promedio-card strong { font-family: 'Fraunces', serif; font-size: 22px; color: var(--forest); }
        .lista-examenes { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-examenes li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; }
        .lista-examenes li:hover { background: var(--paper-2); }
        .lista-examenes-titulo { flex: 1; font-size: 13px; }
        .lista-examenes-titulo strong,.lista-examenes-titulo small { display: block; }.lista-examenes-titulo small { color: var(--ink-soft); font-size: 10.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.lista-examenes-titulo a { font-size: 10.5px; color: var(--forest); }.meta-promocion { margin: -7px 0 13px; padding: 8px 10px; background: var(--paper-2); border-radius: 7px; color: var(--ink-soft); font-size: 12px; }.meta-promocion strong { color: var(--forest); }
        .lista-examenes-fecha { width: 132px; flex-shrink: 0; font-size: 12px; padding: 6px 8px; }
        .lista-examenes-nota { width: 56px; flex-shrink: 0; text-align: center; }
        .lista-examenes-fecha-texto { width: 90px; flex-shrink: 0; font-size: 12px; text-align: right; white-space: nowrap; }
        .lista-examenes-nota-texto { width: 56px; flex-shrink: 0; text-align: center; font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: var(--forest); }
        .chip-tipo { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #fff; background: var(--tc); border-radius: 20px; padding: 3px 9px; }

        /* Tareas */
        .lista-tareas { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-tareas li { display: flex; flex-direction: column; border-radius: 8px; padding: 0 6px; }
        .lista-tareas li:hover { background: var(--paper-2); }
        .tarea-fila { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .tarea-check { background: none; border: none; display: flex; color: var(--forest); cursor: pointer; padding: 0; flex-shrink: 0; }
        .tarea-check-chico { flex-shrink: 0; }
        .tarea-completada { opacity: 0.55; }
        .tarea-completada .tarea-texto strong { text-decoration: line-through; }
        .tarea-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .tarea-texto strong { font-size: 13px; }
        .tarea-titulo-fila { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .tarea-progreso { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: var(--ink-soft); background: var(--paper-2); border-radius: 10px; padding: 2px 8px; flex-shrink: 0; }
        .tarea-recurrente { display: inline-flex; align-items: center; gap: 3px; font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--forest); background: color-mix(in srgb, var(--forest) 12%, transparent); border-radius: 10px; padding: 1px 7px 1px 6px; flex-shrink: 0; }
        .filtros-tareas { margin: 0 0 12px; }.tarea-prioridad,.tarea-etiquetas em { display: inline-flex; align-items: center; border-radius: 10px; padding: 2px 7px; font: 700 9.5px 'IBM Plex Mono', monospace; text-transform: uppercase; font-style: normal; }.tarea-prioridad-alta { color: var(--brick); background: color-mix(in srgb, var(--brick) 13%, transparent); }.tarea-prioridad-media { color: var(--ochre); background: color-mix(in srgb, var(--ochre) 14%, transparent); }.tarea-prioridad-baja { color: var(--forest); background: color-mix(in srgb, var(--forest) 12%, transparent); }.tarea-etiquetas { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }.tarea-etiquetas em { color: var(--ink-soft); background: var(--paper-2); text-transform: none; font-weight: 600; }
        .tarea-fecha { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 600; color: var(--ink-soft); white-space: nowrap; text-align: right; }
        .tarea-fecha-vencida { color: var(--brick); }
        .tarea-fecha-urgente { color: var(--brick); }
        .tarea-fecha-proxima { color: var(--ochre); }
        .tarea-fecha-lejana { color: #3D6B4F; }
        .tarea-descripcion { font-size: 12px; color: var(--ink-soft); }
        .subtareas-panel { padding: 0 0 10px 27px; animation: revealIn 0.15s ease-out; }
        .subtareas-lista { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 1px; }
        .subtareas-lista li { display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 5px 6px 5px 14px; border-radius: 6px; }
        .subtareas-lista li:hover { background: var(--card); }
        .subtarea-texto { flex: 1; min-width: 0; }
        .subtarea-texto strong { font-size: 12px; font-weight: 600; color: var(--ink); }
        .subtarea-hecha .subtarea-texto strong { text-decoration: line-through; opacity: 0.55; }
        .subtareas-agregar { display: flex; gap: 6px; }
        .subtareas-agregar input { flex: 1; }

        /* Notas — mini diario por materia */
        .nota-nueva { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .nota-nueva textarea { width: 100%; }
        .nota-nueva button { align-self: flex-end; }
        .lista-notas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .nota-entrada { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: var(--paper-2); }
        .nota-entrada textarea { width: 100%; margin-bottom: 8px; }
        .nota-entrada-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
        .nota-entrada-fecha { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); }
        .nota-entrada-botones { display: flex; gap: 2px; flex-shrink: 0; }
        .nota-entrada-texto { margin: 0; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }
        .nota-entrada-acciones { display: flex; justify-content: flex-end; gap: 8px; }
        .btn-agregar-ancho { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: 1.5px dashed var(--line); border-radius: 10px; background: transparent; color: var(--ink-soft); font-family: inherit; font-weight: 600; font-size: 13px; cursor: pointer; margin-top: 6px; transition: all 0.15s; }
        .btn-agregar-ancho:hover { border-color: var(--forest); color: var(--forest); background: var(--paper-2); }
        .btn-agregar-ancho-chico { padding: 9px; font-size: 12px; }
        .examenes-botones-fila { display: flex; gap: 10px; }
        .examenes-botones-fila .btn-agregar-ancho { width: auto; flex: 1; }
        .dia-popup-botones { display: flex; gap: 10px; margin-top: 14px; }
        .dia-popup-botones .btn-agregar-ancho { width: auto; flex: 1; margin-top: 0; }
        .dias-repeticion-selector { display: flex; gap: 6px; flex-wrap: wrap; }
        .dia-repeticion-chip { width: 40px; height: 34px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--input-bg); color: var(--ink); font-family: inherit; font-size: 11.5px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .dia-repeticion-chip:hover { border-color: var(--forest); }
        .dia-repeticion-chip-activo { background: var(--forest); border-color: var(--forest); color: #F6F3E7; }
        .evento-color-selector { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .evento-color-personalizado { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
        .evento-color-default { border: 1px solid var(--line); border-radius: 18px; padding: 5px 10px; background: var(--input-bg); color: var(--ink-soft); font: inherit; font-size: 12px; cursor: pointer; }
        .evento-color-opcion { width: 24px; height: 24px; border: 2px solid transparent; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1); }
        .evento-color-selector .evento-color-activo { outline: 2px solid var(--ink); outline-offset: 2px; }
        .evento-color-default.evento-color-activo { background: var(--paper-2); color: var(--ink); font-weight: 700; }

        .resumenes-layout { display: grid; grid-template-columns: 150px 1fr; gap: 16px; }
        .resumenes-lista { display: flex; flex-direction: column; gap: 4px; }
        .resumen-item { display: flex; align-items: center; gap: 2px; border-radius: 7px; }
        .resumen-item-btn { flex: 1; text-align: left; background: none; border: none; font-family: inherit; font-size: 12.5px; padding: 7px 8px; border-radius: 7px; cursor: pointer; color: var(--ink-soft); }
        .resumen-item-activo .resumen-item-btn { background: var(--forest); color: #F6F3E7; font-weight: 600; }
        .resumen-titulo-input { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; border: none; background: none; padding: 0 0 10px; width: 100%; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
        .resumen-titulo-input:focus { outline: none; border-color: var(--forest); }
        .bloque { border: 1px solid var(--line); background: var(--card); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
        .bloque-head { display: flex; gap: 8px; margin-bottom: 6px; }
        .bloque-titulo { font-weight: 600; border: none; background: none; padding: 4px 0; }
        .bloque-titulo:focus { outline: none; }
        .bloque-texto { border: none; background: none; padding: 0; font-size: 13.5px; line-height: 1.5; }
        .bloque-texto:focus { outline: none; }
        .bloque-imagen img { max-width: 100%; border-radius: 8px; display: block; }
        .bloque-agregar { display: flex; flex-direction: column; gap: 8px; }

        /* Mapa de materias */
        .mapa-wrap { display: flex; flex-direction: column; gap: 14px; }
        .mapa-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
        .mapa-lienzo { position: relative; }
        .mapa-svg { position: absolute; top: 0; left: 0; pointer-events: none; }
        .mapa-col-titulo { position: absolute; top: 24px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ochre); font-weight: 700; text-align: center; }
        .mapa-nodo { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 3px; text-align: left; background: var(--input-bg); border: 1.5px solid var(--sc); border-left: 5px solid var(--mc); border-radius: 8px; padding: 7px 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(35,39,31,0.08); transition: transform 0.15s, box-shadow 0.15s; font-family: inherit; }
        .mapa-nodo-bloqueada { background: color-mix(in srgb, var(--ink-soft) 11%, var(--card)); border-color: var(--brick); border-left-color: var(--brick); }
        .mapa-nodo-bloqueada .mapa-nodo-nombre { color: color-mix(in srgb, var(--ink) 78%, var(--ink-soft)); }
        .mapa-nodo-bloqueada .mapa-nodo-estado, .mapa-nodo-bloqueada .mapa-nodo-lock { color: var(--brick); }
        .mapa-nodo:hover { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(35,39,31,0.14); z-index: 5; }
        .mapa-nodo-nombre { font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mapa-nodo-estado { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sc); font-weight: 700; }
        .mapa-nodo-dot { display: none; }
        .mapa-nodo-lock { position: absolute; top: 7px; right: 8px; color: var(--sc); }
        .mapa-nodo { opacity: 1; }
        .mapa-nodo-atenuado { opacity: 0.28; }
        .mapa-nodo-atenuado:hover { opacity: 0.55; }
        .mapa-nodo-activo { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(35,39,31,0.14); z-index: 6; }
        .mapa-linea { transition: opacity 0.15s; }
        .mapa-lienzo-con-foco .mapa-linea-atenuada { opacity: 0.12; }
        .mapa-lienzo-con-foco .mapa-linea-foco { opacity: 1; }

        /* Incluye tablets en horizontal y dispositivos táctiles con trackpad.
           En estos últimos, el cursor puede ser "fino" pero el scroll de un
           panel interno no siempre recibe los gestos del trackpad. */
        /* El layout de teléfono depende únicamente del ancho reducido. Una
           tablet táctil no debe caer acá solo por usar una pantalla coarse. */
        @media (max-width: 699px) {
          /* En pantallas táctiles el scroll pertenece al documento, no a un contenedor
             interno. Así un gesto que empieza sobre una tarjeta, lista o
             campo continúa desplazando toda la pantalla de forma fiable con
             dedo o trackpad en Safari/Chrome. */
          html, body, #root { min-height: 100%; }
          body { margin: 0; overflow-x: hidden; overflow-y: auto; }
          .app-shell { flex-direction: column; height: auto; min-height: 100dvh; overflow: visible; }
          .main-area { display: block; flex: 0 0 auto; min-height: auto; }
          .view, .calendario-persistente, .focus-persistente { flex: 0 0 auto; min-height: auto; overflow: visible; }
          .sidebar { width: 100%; flex-direction: row; align-items: center; padding: 10px 14px; gap: 14px; }
          .sidebar-brand { display: none; }
          .sidebar-nav { flex-direction: row; flex: 1; justify-content: space-around; }
          .sidebar-item span { display: none; }
          .sidebar-carne { display: none; }
          .sidebar-reset { display: none; }
          .view { padding: 20px; max-height: none; }
          .dos-columnas, .form-grid, .resumenes-layout { grid-template-columns: 1fr; }
          .configuracion-seccion { align-items: flex-start; flex-direction: column; }
          .configuracion-selects { grid-template-columns: 1fr; gap: 0; }
          .progreso-general { grid-template-columns: 1fr 1fr; gap: 14px; }
          .progreso-general > div:last-child { grid-column: 1 / -1; }
          .pendiente-fila-grande { grid-template-columns: max-content minmax(0, 1fr); row-gap: 5px; }
          .pendiente-fila-grande .tarea-fecha { grid-column: 2; text-align: left; }
          /* Los overlays mantienen su propio scroll: evita que un modal o el
             detalle de una materia queden cortados por el alto del viewport. */
          .modal-overlay, .detalle-overlay { align-items: flex-start; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 12px; }
          .modal-card { width: 100%; max-height: none; overflow: visible; }
          .detalle-overlay { justify-content: stretch; padding: 0; }
          .detalle-panel { width: 100%; height: auto; min-height: 100%; overflow: visible; }
          /* Estas superficies sí requieren scroll interno horizontal; el eje
             vertical permanece disponible para desplazar la página. */
          .semana-grid-wrap, .mapa-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
          .tabs-anio { flex-wrap: wrap; }
          .tab-anio { flex: 1 1 45%; border-bottom: 1px solid rgba(0,0,0,0.08); }
          .fila-pill { display: none; }
          .fila-historial { padding-left: 18px; }
          .fila-historial-grupos { grid-template-columns: 1fr; gap: 12px; }
          .materias-toolbar { flex-direction: column; align-items: stretch; }
          .buscador { max-width: none; }
          .modo-toggle button span, .modo-toggle button { font-size: 11.5px; }
        }

        /* Tablet: la barra queda anclada al viewport y el desplazamiento se
           concentra en el contenido, incluso dentro del detalle de materia. */
        .app-shell-tablet { flex-direction: row; height: 100dvh; min-height: 0; overflow: hidden; }
        html:has(.app-shell-tablet), body:has(.app-shell-tablet) { height: 100%; min-height: 0; overflow: hidden; }
        #root:has(.app-shell-tablet) { min-height: 100dvh; }
        .app-shell-tablet .sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; width: 68px; height: 100dvh; flex-direction: column; align-items: center; padding: 16px 12px; gap: 16px; box-shadow: 2px 0 10px rgba(35,39,31,0.12); }
        .app-shell-tablet .main-area { display: flex; flex: 0 0 calc(100% - 68px); width: calc(100% - 68px); min-height: 0; margin-left: 68px; overflow: hidden; }
        .app-shell-tablet .view, .app-shell-tablet .calendario-persistente, .app-shell-tablet .focus-persistente { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        .app-shell-tablet .view { padding: 32px 36px; }
        .app-shell-tablet .sidebar-brand, .app-shell-tablet .sidebar-carne, .app-shell-tablet .sidebar-reset { display: none; }
        .app-shell-tablet .sidebar-nav { flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; }
        .app-shell-tablet .sidebar-item { width: 44px; justify-content: center; padding: 11px; }
        .app-shell-tablet .sidebar-item span { display: none; }
        .app-shell-tablet .sidebar-tema { width: 44px; height: 40px; margin: auto 0 0; padding: 0; justify-content: center; font-size: 0; }
        .app-shell-tablet .sidebar-tema svg { width: 16px; height: 16px; }
        .app-shell-tablet .dos-columnas { grid-template-columns: 1.2fr 1fr; }
        .app-shell-tablet .form-grid { grid-template-columns: 1fr 1fr; }
        .app-shell-tablet .resumenes-layout { grid-template-columns: 150px 1fr; }
        .app-shell-tablet .tabs-anio { flex-wrap: nowrap; }
        .app-shell-tablet .tab-anio { flex: 1; border-bottom: none; }
        .app-shell-tablet .fila-historial { padding-left: 0; }
        .app-shell-tablet .fila-historial-grupos { grid-template-columns: 1fr 1fr; gap: 20px; }
        .app-shell-tablet .materias-toolbar { flex-direction: row; align-items: center; }
        .app-shell-tablet .buscador { max-width: 320px; }
        .app-shell-tablet .modal-overlay { align-items: center; overflow: hidden; padding: 20px; }
        .app-shell-tablet .modal-card { width: 460px; max-width: 100%; max-height: 88dvh; overflow-y: auto; }
        .app-shell-tablet .modal-wide { width: 620px; }
        .app-shell-tablet .detalle-overlay { justify-content: flex-end; align-items: flex-start; overflow-y: auto; overflow-x: hidden; padding: 0; -webkit-overflow-scrolling: touch; }
        .app-shell-tablet .detalle-panel { width: max(560px, 50vw); max-width: 100%; min-height: 100dvh; height: auto; overflow: visible; }
        /* Las siete secciones caben sin desplazamiento horizontal: cuatro
           pestañas por fila en lugar de una única fila demasiado larga. */
        .app-shell-tablet .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; padding: 12px 18px 0; }
        .app-shell-tablet .tab { min-width: 0; padding: 9px 5px; font-size: 10.5px; letter-spacing: 0.02em; white-space: nowrap; }

        /* Respaldo para tablets que el navegador identifica solo por su
           puntero táctil. No cambia el contenido a versión móvil: mantiene
           el layout de PC y comprime exclusivamente la barra izquierda. */
        @media (min-width: 700px) and (pointer: coarse) {
          html, body { height: 100%; min-height: 0; overflow: hidden; }
          #root { min-height: 100dvh; }
          .app-shell { flex-direction: row; height: 100dvh; min-height: 0; overflow: hidden; }
          .sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; width: 68px; height: 100dvh; flex-direction: column; align-items: center; padding: 16px 12px; gap: 16px; box-shadow: 2px 0 10px rgba(35,39,31,0.12); }
          .main-area { display: flex; flex: 0 0 calc(100% - 68px); width: calc(100% - 68px); min-height: 0; margin-left: 68px; overflow: hidden; }
          .view, .calendario-persistente, .focus-persistente { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
          .sidebar-brand, .sidebar-carne, .sidebar-reset { display: none; }
          .sidebar-nav { flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; }
          .sidebar-item { width: 44px; justify-content: center; padding: 11px; }
          .sidebar-item span { display: none; }
          .sidebar-tema { width: 44px; height: 40px; margin: auto 0 0; padding: 0; justify-content: center; font-size: 0; }
          .sidebar-tema svg { width: 16px; height: 16px; }
          .detalle-overlay { align-items: flex-start; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
          .detalle-panel { min-height: 100dvh; height: auto; overflow: visible; }
          .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; padding: 12px 18px 0; }
          .tab { min-width: 0; padding: 9px 5px; font-size: 10.5px; letter-spacing: 0.02em; white-space: nowrap; }
        }
      `}</style>

      <Sidebar view={view} setView={setView} materias={materias} onBuscar={() => setBusquedaAbierta(true)} />

      <div className="main-area">
        {errorGuardado && (
          <div className="aviso-guardado">
            <span>
              No se pudo guardar el último cambio, probablemente por falta de espacio. Si acabás de subir un archivo pesado, probá con uno más chico o con un link de Drive.
            </span>
          </div>
        )}

        {!cargado || !calCargado || !sesionesCargado ? (
          <div className="view" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p className="muted">Cargando…</p>
          </div>
        ) : (
          <>
            {view === "inicio" && (
              <Inicio materias={materias} setView={setView} abrirMateria={abrirMateria} onCompletarTarea={completarTarea} asistenciaMinima={configuracion.asistenciaMinima} />
            )}
            {view === "materias" && (
              <MateriasView
                materias={materias}
                setMaterias={setMaterias}
                materiaAbiertaId={materiaAbiertaId}
                setMateriaAbiertaId={setMateriaAbiertaId}
                tabMateriaInicial={tabMateriaInicial}
                onAprobada={dispararConfetti}
                googleCal={googleCal}
                asistenciaMinima={configuracion.asistenciaMinima}
              />
            )}
            {/* Focus queda siempre montado (aunque no se vea) para que el timer
                siga corriendo si cambiás de sección mientras estudiás. */}
            <div className="focus-persistente" style={{ display: view === "focus" ? "flex" : "none" }}>
              <FocusView materias={materias} sesiones={sesiones} agregarSesion={agregarSesion} abrirMateria={abrirMateria} />
            </div>
            {/* El calendario queda siempre montado (aunque no se vea) para que el
                embed de Google no se recargue cada vez que cambiás de sección. */}
            <div className="calendario-persistente" style={{ display: view === "calendario" ? "flex" : "none" }}>
              <CalendarioView
                calendarId={calendarId}
                setCalendarId={setCalendarId}
                materias={materias}
                googleCal={googleCal}
                onVincularExamenDesdeEvento={vincularExamenDesdeEvento}
              />
            </div>
            {view === "configuracion" && <ConfiguracionView tema={tema} onToggleTema={toggleTema} asistenciaMinima={configuracion.asistenciaMinima} setAsistenciaMinima={(asistenciaMinima) => setConfiguracion((c) => ({ ...c, asistenciaMinima }))} configNotificaciones={configNotificaciones} setConfigNotificaciones={setConfigNotificaciones} user={user} onSignOut={onSignOut} />}
          </>
        )}
      </div>

      {confirmarReset && (
        <Modal title="Restablecer datos de ejemplo" onClose={() => setConfirmarReset(false)}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            Esto borra todas tus materias actuales y las reemplaza por datos ficticios de demostración,
            pensados para probar las funciones de la app. No se puede deshacer.
          </p>
          <div className="modal-acciones">
            <button className="btn-secundario" onClick={() => setConfirmarReset(false)}>Cancelar</button>
            <button className="btn-peligro" onClick={confirmarResetDatosEjemplo}>Sí, restablecer</button>
          </div>
        </Modal>
      )}

      {busquedaAbierta && <BusquedaGlobal materias={materias} onClose={() => setBusquedaAbierta(false)} onAbrir={(id, tab) => { setBusquedaAbierta(false); abrirMateria(id, tab); }} />}
      {confettiActivo && <Confetti key={confettiKey} onDone={() => setConfettiActivo(false)} />}
    </div>
  );
}

function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!supabase) { setUser(null); return undefined; }
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, cargando: user === undefined };
}

function Acceso() {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(""); setMensaje("");
    if (modo === "registro" && password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setEnviando(true);
    try {
      if (modo === "registro") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!data.session) setMensaje("Revisá tu correo y confirmá tu cuenta para iniciar sesión.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err.message || "No se pudo completar la operación.");
    } finally { setEnviando(false); }
  };

  const entrarConGoogle = async () => {
    setError(""); setMensaje(""); setEnviando(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión con Google.");
      setEnviando(false);
    }
  };

  return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20, background: "#F6F3E7", color: "#23271F", fontFamily: "IBM Plex Sans, sans-serif" }}>
    <section style={{ width: "min(100%, 410px)", background: "#FFFEF7", border: "1px solid #DAD4BC", borderRadius: 14, padding: 28, boxShadow: "0 8px 30px rgba(35,39,31,.10)" }}>
      <p style={{ margin: 0, color: "#8A6F34", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Planificador de carrera</p>
      <h1 style={{ margin: "8px 0", fontFamily: "Fraunces, Georgia, serif", fontSize: 29 }}>{modo === "entrar" ? "Bienvenido/a" : "Crear cuenta"}</h1>
      <p style={{ margin: "0 0 20px", color: "#6C6A60", fontSize: 14, lineHeight: 1.5 }}>Guardá y consultá tus materias desde cualquier dispositivo.</p>
      <form onSubmit={enviar} style={{ display: "grid", gap: 13 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 10, border: "1px solid #CFC8AC", borderRadius: 7, font: "inherit" }} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>Contraseña<input required type="password" minLength="6" autoComplete={modo === "entrar" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 10, border: "1px solid #CFC8AC", borderRadius: 7, font: "inherit" }} /></label>
        {error && <p role="alert" style={{ margin: 0, color: "#B5432E", fontSize: 13 }}>{error}</p>}
        {mensaje && <p style={{ margin: 0, color: "#356446", fontSize: 13 }}>{mensaje}</p>}
        <button className="btn-primario" disabled={enviando} style={{ justifyContent: "center", marginTop: 4 }}>{enviando ? "Procesando…" : modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", color: "#8B887D", fontSize: 12 }}><span style={{ height: 1, flex: 1, background: "#DED8C2" }} />o<span style={{ height: 1, flex: 1, background: "#DED8C2" }} /></div>
      <button type="button" onClick={entrarConGoogle} disabled={enviando} style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 9, padding: 10, border: "1px solid #CFC8AC", borderRadius: 7, background: "#fff", color: "#23271F", cursor: "pointer", font: "600 13px IBM Plex Sans, sans-serif" }}><b style={{ color: "#4285F4", fontSize: 17 }}>G</b> Continuar con Google</button>
      <button type="button" onClick={() => { setModo((m) => m === "entrar" ? "registro" : "entrar"); setMensaje(""); setError(""); }} style={{ width: "100%", marginTop: 14, border: 0, background: "transparent", color: "#2C5C8A", cursor: "pointer", font: "inherit", fontSize: 13 }}>
        {modo === "entrar" ? "¿No tenés cuenta? Crear una" : "¿Ya tenés cuenta? Iniciar sesión"}
      </button>
    </section>
  </main>;
}

export default function App() {
  useTrackpadScrollFallback();
  const { user, cargando } = useAuth();
  if (cargando) return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>Cargando…</main>;
  if (supabase && !user) return <Acceso />;
  return <PlanificadorApp user={user} onSignOut={() => supabase?.auth.signOut()} />;
}
