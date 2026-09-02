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
} from "lucide-react";

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
  { id: "Final", color: "#9C3B2E" },
  { id: "Otro", color: "#6E4C8A" },
];
const TIPO_EXAMEN_COLOR = Object.fromEntries(TIPOS_EXAMEN.map((t) => [t.id, t.color]));

const ASISTENCIA_MINIMA = 75; // % habitual para no quedar libre por faltas

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
const fmtFechaHoraNota = (iso) => {
  const d = new Date(iso);
  const fecha = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} · ${hora}`;
};
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

  // Plan de estudios de referencia: Contador Público, 4 años.
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
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6 }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 7 }],
      tareas: [{ titulo: "Inscribirse a mesa de final", fecha: plus(10) }] },
    { nombre: "Derecho Comercial", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 2, color: "#6E4C8A", estado: "Aprobada", fechaAprobada: plus(-280), correlativas: "Elementos de Derecho Civil",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 7 }] },
    { nombre: "Microeconomía", profesor: "Lic. Paz", aula: "Aula 105", anio: 2, color: "#C4842E", estado: "Aprobada", fechaAprobada: plus(-270), correlativas: "Introducción a la Economía",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 8 }] },

    // ---- 3er año (año actual: cursando / regular) ----
    { nombre: "Contabilidad de Costos", profesor: "Cra. Molina", aula: "Aula 201", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Lunes", inicio: "08:00", fin: "10:00" }, { dia: "Miércoles", inicio: "08:00", fin: "10:00" }],
      asistencia: { faltas: 1, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — Costeo ABC", nota: 8 }],
      tareas: [{ titulo: "Resolver guía de costos ABC", fecha: plus(2) }],
      resumenes: [{ titulo: "Costeo ABC", bloques: [{ tipo: "texto", titulo: "Idea central", texto: "El costeo basado en actividades asigna los costos indirectos según las actividades que efectivamente consumen los productos, en vez de prorratearlos con una única base." }] }] },
    { nombre: "Contabilidad Superior", profesor: "Cra. Herrera", aula: "Aula 101", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Martes", inicio: "14:00", fin: "17:00" }],
      asistencia: { faltas: 5, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6 }],
      tareas: [{ titulo: "Preparar exposición de EECC consolidados", fecha: plus(5) }] },
    { nombre: "Derecho Tributario I", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 3, color: "#6E4C8A", estado: "Regular", correlativas: "Derecho Comercial",
      horarios: [{ dia: "Jueves", inicio: "18:00", fin: "21:00" }], asistencia: { faltas: 0, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 7 }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 6 }] },
    { nombre: "Finanzas de las Organizaciones", profesor: "Lic. Roldán", aula: "Aula 203", anio: 3, color: "#2C5C8A", estado: "Cursando", correlativas: "Matemática Financiera, Estadística I",
      horarios: [{ dia: "Viernes", inicio: "10:00", fin: "13:00" }],
      asistencia: { faltas: 7, inicioCursada: plus(-45), finCursada: plus(75) },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — VAN y TIR", nota: null }],
      tareas: [{ titulo: "Entregar TP de VAN y TIR", fecha: plus(-1) }] },
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
    asistencia: d.asistencia || { faltas: 0, inicioCursada: "", finCursada: "" },
    examenes: (d.examenes || []).map((e) => ({ id: uid(), fecha: "", ...e })),
    tareas: (d.tareas || []).map((t) => ({ id: uid(), completada: false, subtareas: [], recurrencia: null, vecesCompletada: 0, ...t })),
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
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/* Adaptador de guardado: usa window.storage cuando corre como artifact
   dentro de Claude, y localStorage del navegador cuando corre como
   página independiente (por ejemplo, ya deployada en Vercel). Así el
   mismo archivo funciona en los dos lugares sin tocar nada. */
const tieneStorageClaude = () =>
  typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

async function guardarValor(key, valor) {
  const json = JSON.stringify(valor);
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
        const base = (datos.materias || []).map((m) => ({ ...m, notas: normalizarNotasEntradas(m.notas) }));
        setMaterias(base.map((m) => ({ ...m, correlativas: normalizarCorrelativas(m.correlativas, base) })));
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

/* Adaptador de autenticación con Google Identity Services (OAuth por popup,
   sin backend). Solo puede completarse en una página publicada de verdad
   (con su origen registrado en Google Cloud) — no dentro del sandbox de
   artifacts de Claude. El token vive solo en memoria, nunca se guarda. */
function useGoogleAuth(clientId) {
  const [accessToken, setAccessToken] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [errorAuth, setErrorAuth] = useState("");
  const [scriptListo, setScriptListo] = useState(
    typeof window !== "undefined" && !!window.google?.accounts?.oauth2
  );
  const tokenClientRef = useRef(null);

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

  useEffect(() => {
    if (!scriptListo || !clientId || !window.google?.accounts?.oauth2) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (resp) => {
        setConectando(false);
        if (resp.error) {
          setErrorAuth("No se pudo conectar con Google (" + resp.error + ").");
          return;
        }
        setAccessToken(resp.access_token);
        setErrorAuth("");
      },
    });
  }, [scriptListo, clientId]);

  const conectar = () => {
    if (!tokenClientRef.current) {
      setErrorAuth("Todavía se está preparando la conexión con Google. Esperá un segundo y probá de nuevo.");
      return;
    }
    setConectando(true);
    setErrorAuth("");
    tokenClientRef.current.requestAccessToken({ prompt: "" });
  };

  const desconectar = () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    setAccessToken(null);
  };

  return { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo };
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

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      {COLORES.map((c) => (
        <button
          key={c.hex}
          type="button"
          className={`color-swatch ${value === c.hex ? "color-swatch-active" : ""}`}
          style={{ background: c.hex }}
          title={c.nombre}
          onClick={() => onChange(c.hex)}
        />
      ))}
    </div>
  );
}

/* =========================================================================
   SIDEBAR
   ========================================================================= */

function Sidebar({ view, setView, materias, onResetear }) {
  const total = materias.length;
  const aprobadas = materias.filter((m) => m.estado === "Aprobada").length;
  const pct = total ? Math.round((aprobadas / total) * 100) : 0;

  const items = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "materias", label: "Materias", icon: BookOpen },
    { id: "calendario", label: "Calendario", icon: CalendarIcon },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <GraduationCap size={22} strokeWidth={2} />
        <span>Cursada</span>
      </div>
      <div className="sidebar-nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={`sidebar-item ${view === it.id ? "sidebar-item-active" : ""}`}
            onClick={() => setView(it.id)}
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
      <button className="sidebar-reset" onClick={onResetear}>
        <Trash2 size={12} /> Restablecer datos de ejemplo
      </button>
    </nav>
  );
}

/* =========================================================================
   INICIO
   ========================================================================= */

function Inicio({ materias, setView, abrirMateria, onCompletarTarea }) {
  const pendientesOrdenadas = useMemo(() => {
    const todas = materias.flatMap((m) => (m.tareas || []).filter((t) => !t.completada).map((t) => ({ ...t, materia: m })));
    return todas.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha < b.fecha ? -1 : 1;
    });
  }, [materias]);

  const examenesProximos = useMemo(() => {
    const hoy = toDateStr(new Date());
    const todos = materias.flatMap((m) => (m.examenes || []).filter((e) => e.fecha).map((e) => ({ ...e, materia: m })));
    return todos.filter((e) => e.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }, [materias]);

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
                {pendientesOrdenadas.map((t) => (
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
          {examenesParciales.length === 0 && examenesFinal.length === 0 ? (
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
                {examenesFinal.length === 0 ? (
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

function MateriaFormModal({ materia, materias, onSave, onClose }) {
  const [form, setForm] = useState(
    materia || {
      nombre: "", profesor: "", aula: "", color: COLORES[0].hex, estado: "Pendiente",
      anio: 1, correlativas: [], horarios: [], notas: [], recursos: [], resumenes: [],
      fechaAprobada: null, asistencia: { faltas: 0, inicioCursada: "", finCursada: "" }, examenes: [], tareas: [],
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCorrelativa = (id) => {
    const actuales = form.correlativas || [];
    set("correlativas", actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]);
  };
  // No podés elegirte a vos misma como tu propia correlativa.
  const opcionesCorrelativas = (materias || []).filter((m) => m.id !== form.id);

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
          <select value={form.estado} onChange={(e) => set("estado", e.target.value)}>
            {ESTADOS.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </label>
        <div className="campo campo-full">
          <span>Correlativas</span>
          {opcionesCorrelativas.length === 0 ? (
            <p className="muted" style={{ margin: "6px 0 0" }}>Todavía no hay otras materias cargadas para elegir.</p>
          ) : (
            <div className="selector-correlativas">
              {[...opcionesCorrelativas]
                .sort((a, b) => (a.anio - b.anio) || a.nombre.localeCompare(b.nombre))
                .map((m) => {
                  const marcada = (form.correlativas || []).includes(m.id);
                  return (
                    <label key={m.id} className={`selector-correlativas-item ${marcada ? "selector-correlativas-item-on" : ""}`}>
                      <input type="checkbox" checked={marcada} onChange={() => toggleCorrelativa(m.id)} />
                      <span className="selector-correlativas-dot" style={{ background: m.color }} />
                      <span className="selector-correlativas-nombre">{m.nombre}</span>
                      <span className="selector-correlativas-anio">{anioLabel(m.anio)}</span>
                    </label>
                  );
                })}
            </div>
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
      </div>

      <div className="modal-acciones">
        <button className="btn-secundario" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" onClick={guardar}>Guardar materia</button>
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

function MateriaDetalle({ materia, materias, onUpdate, onDelete, onClose, onEdit }) {
  const [tab, setTab] = useState("info");
  const [resumenActivo, setResumenActivo] = useState(materia.resumenes[0]?.id || null);
  const [nuevoRecurso, setNuevoRecurso] = useState({ tipo: "Apunte", nombre: "", url: "", archivo: "", archivoNombre: "", archivoTipo: "" });
  const [errorArchivo, setErrorArchivo] = useState("");
  const [nuevoExamen, setNuevoExamen] = useState({ tipo: "Trabajo práctico", titulo: "", nota: "", fecha: "" });
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: "", descripcion: "", fecha: "", recurrencia: "" });
  const [tareasExpandidas, setTareasExpandidas] = useState(new Set());
  const [subtareaTexto, setSubtareaTexto] = useState({});
  const [tareaAEliminar, setTareaAEliminar] = useState(null);
  const [notaNuevaTexto, setNotaNuevaTexto] = useState("");
  const [notaEnEdicionId, setNotaEnEdicionId] = useState(null);
  const [notaEnEdicionTexto, setNotaEnEdicionTexto] = useState("");
  const [tareaModalAbierto, setTareaModalAbierto] = useState(false);
  const [examenModalAbierto, setExamenModalAbierto] = useState(false);
  const [recursoModalAbierto, setRecursoModalAbierto] = useState(false);
  const [previewArchivo, setPreviewArchivo] = useState(null);

  const asistencia = materia.asistencia || { faltas: 0, inicioCursada: "", finCursada: "" };
  const examenes = materia.examenes || [];
  const tareas = materia.tareas || [];
  const notas = materia.notas || [];
  const promedio = calcularPromedio(examenes);
  const totalClases = contarClasesEnRango(materia.horarios, asistencia.inicioCursada, asistencia.finCursada);
  const asistenciaPct = calcularAsistenciaPct(asistencia, materia.horarios);
  const maxFaltasPermitidas = totalClases !== null ? Math.floor(totalClases * (1 - ASISTENCIA_MINIMA / 100)) : null;
  const faltasDisponibles = maxFaltasPermitidas !== null ? maxFaltasPermitidas - asistencia.faltas : null;

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

  const addExamen = () => {
    if (!nuevoExamen.titulo.trim()) return;
    patch({
      examenes: [
        ...examenes,
        { id: uid(), tipo: nuevoExamen.tipo, titulo: nuevoExamen.titulo, nota: nuevoExamen.nota === "" ? null : Number(nuevoExamen.nota), fecha: nuevoExamen.fecha },
      ],
    });
    setNuevoExamen({ tipo: "Trabajo práctico", titulo: "", nota: "", fecha: "" });
    setExamenModalAbierto(false);
  };
  const delExamen = (id) => patch({ examenes: examenes.filter((e) => e.id !== id) });
  const updNotaExamen = (id, valor) => {
    patch({ examenes: examenes.map((e) => (e.id === id ? { ...e, nota: valor === "" ? null : Number(valor) } : e)) });
  };
  const updFechaExamen = (id, valor) => {
    patch({ examenes: examenes.map((e) => (e.id === id ? { ...e, fecha: valor } : e)) });
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
          fecha: fechaFinal,
          completada: false,
          subtareas: [],
          recurrencia: diaRec !== null ? { diaSemana: diaRec } : null,
          vecesCompletada: 0,
        },
      ],
    });
    setNuevaTarea({ titulo: "", descripcion: "", fecha: "", recurrencia: "" });
    setTareaModalAbierto(false);
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
            <IconBtn icon={Trash2} title="Eliminar materia" danger onClick={onDelete} />
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
          {["info", "tareas", "asistencia", "examenes", "recursos", "resumenes"].map((t) => {
            const hayPendientes = t === "tareas" && tareas.some((x) => !x.completada);
            return (
              <button key={t} className={`tab ${tab === t ? "tab-activo" : ""} ${hayPendientes ? "tab-con-alerta" : ""}`} onClick={() => setTab(t)}>
                {t === "info" ? "Notas" : t === "tareas" ? "Tareas" : t === "asistencia" ? "Asistencia" : t === "examenes" ? "Exámenes" : t === "recursos" ? "Recursos" : "Resúmenes"}
                {hayPendientes && <span className="tab-dot" />}
              </button>
            );
          })}
        </div>

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
            <ul className="lista-tareas">
              {tareas
                .slice()
                .sort((a, b) => {
                  if (a.completada !== b.completada) return a.completada ? 1 : -1;
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
                            {subt.length > 0 && <span className="tarea-progreso">{hechas}/{subt.length}</span>}
                            {t.recurrencia && (
                              <span className="tarea-recurrente" title={`Se repite todos los ${pluralDia(t.recurrencia.diaSemana).toLowerCase()}`}>
                                <Repeat size={11} /> {pluralDia(t.recurrencia.diaSemana)}
                              </span>
                            )}
                          </div>
                          {t.descripcion && <span className="tarea-descripcion">{t.descripcion}</span>}
                          {t.fecha && (
                            <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(t.fecha)}`}>{textoUrgencia(t.fecha)}</span>
                          )}
                        </div>
                        <IconBtn
                          icon={expandida ? ChevronDown : ChevronRight}
                          title={expandida ? "Ocultar subtareas" : "Subtareas"}
                          onClick={() => toggleExpandirTarea(t.id)}
                        />
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
            </ul>
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
                      stroke={asistenciaPct >= ASISTENCIA_MINIMA ? "#6FB37E" : asistenciaPct >= ASISTENCIA_MINIMA - 15 ? "var(--ochre)" : "var(--brick)"}
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
                <p className={`asistencia-estado ${asistenciaPct !== null && asistenciaPct < ASISTENCIA_MINIMA ? "asistencia-estado-riesgo" : ""}`}>
                  {asistenciaPct === null
                    ? "Cargá el período de cursada para calcular tu asistencia."
                    : asistenciaPct >= ASISTENCIA_MINIMA
                    ? "Vas bien de asistencia."
                    : "Estás por debajo del mínimo habitual (75%)."}
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
              </div>
            </div>

            <div className="asistencia-periodo">
              <label className="campo">
                <span>Inicio de cursada</span>
                <input type="date" value={asistencia.inicioCursada} onChange={(e) => updAsistencia({ inicioCursada: e.target.value })} />
              </label>
              <label className="campo">
                <span>Fin de cursada</span>
                <input type="date" value={asistencia.finCursada} onChange={(e) => updAsistencia({ finCursada: e.target.value })} />
              </label>
            </div>
            {(!asistencia.inicioCursada || !asistencia.finCursada) && (
              <p className="asistencia-periodo-ayuda muted">
                Con estas dos fechas, la app calcula sola cuántas clases hay en total (según tus horarios cargados) y va restando las faltas que registres.
              </p>
            )}

            <div className="asistencia-faltas-ancho">
              <button className="asistencia-btn-ancho" onClick={restarFalta}>
                <Minus size={16} /> Quitar falta
              </button>
              <div className="asistencia-faltas-numero">
                <strong>{asistencia.faltas}</strong>
                <span>{asistencia.faltas === 1 ? "falta" : "faltas"}</span>
              </div>
              <button className="asistencia-btn-ancho" onClick={sumarFalta}>
                <Plus size={16} /> Sumar falta
              </button>
            </div>
            <button className="btn-secundario btn-chico" onClick={resetFaltas}>Reiniciar faltas</button>
          </div>
        )}

        {tab === "examenes" && (
          <div className="tab-panel">
            <div className="promedio-card">
              <span className="muted">Promedio de la materia</span>
              <strong>{promedio !== null ? promedio.toFixed(2) : "—"}</strong>
            </div>
            <ul className="lista-examenes">
              {examenes.map((e) => (
                <li key={e.id}>
                  <span className="chip-tipo" style={{ "--tc": TIPO_EXAMEN_COLOR[e.tipo] }}>{e.tipo}</span>
                  <span className="lista-examenes-titulo">{e.titulo}</span>
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
                </li>
              ))}
              {examenes.length === 0 && <p className="muted">Todavía no cargaste trabajos ni exámenes.</p>}
            </ul>
            <button className="btn-agregar-ancho" onClick={() => setExamenModalAbierto(true)}>
              <Plus size={16} /> Agregar examen
            </button>
          </div>
        )}

        {examenModalAbierto && (
          <Modal title="Nuevo trabajo o examen" onClose={() => setExamenModalAbierto(false)}>
            <div className="form-grid">
              <label className="campo campo-full">
                <span>Tipo</span>
                <select value={nuevoExamen.tipo} onChange={(e) => setNuevoExamen((n) => ({ ...n, tipo: e.target.value }))}>
                  {TIPOS_EXAMEN.map((t) => (<option key={t.id} value={t.id}>{t.id}</option>))}
                </select>
              </label>
              <label className="campo campo-full">
                <span>Título</span>
                <input
                  value={nuevoExamen.titulo}
                  onChange={(e) => setNuevoExamen((n) => ({ ...n, titulo: e.target.value }))}
                  placeholder="Ej: Parcial 1"
                  autoFocus
                />
              </label>
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
            </div>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setExamenModalAbierto(false)}>Cancelar</button>
              <button className="btn-primario" onClick={addExamen}>Agregar</button>
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

function MapaMaterias({ materias, abrirMateria }) {
  const columnas = useMemo(() => {
    const map = new Map();
    materias.forEach((m) => {
      const key = m.anio || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
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

  const maxFilas = Math.max(1, ...columnas.map(([, items]) => items.length));
  const anchoTotal = MAPA_PAD * 2 + columnas.length * MAPA_NODO_W + Math.max(0, columnas.length - 1) * MAPA_COL_GAP;
  const altoTotal = MAPA_PAD * 2 + MAPA_HEADER_H + maxFilas * (MAPA_NODO_H + MAPA_ROW_GAP);

  if (materias.length === 0) {
    return <p className="muted" style={{ padding: 20 }}>Todavía no cargaste materias.</p>;
  }

  return (
    <div className="mapa-wrap">
      <div className="mapa-scroll">
        <div className="mapa-lienzo" style={{ width: anchoTotal, height: altoTotal }}>
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
              />
            ))}
          </svg>

          {materias.map((m) => {
            const pos = posiciones[m.id];
            if (!pos) return null;
            const estadoNodo = estadoMapaNodo(m, materias);
            return (
              <button
                key={m.id}
                className="mapa-nodo"
                style={{
                  left: pos.x, top: pos.y, width: MAPA_NODO_W, height: MAPA_NODO_H,
                  "--sc": MAPA_NODO_COLOR[estadoNodo], "--mc": m.color,
                }}
                onClick={() => abrirMateria(m.id)}
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

function MateriasView({ materias, setMaterias, materiaAbiertaId, setMateriaAbiertaId }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState("Cursando");
  const [vistaAnio, setVistaAnio] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState("lista"); // "lista" | "mapa"
  const [materiaAEliminar, setMateriaAEliminar] = useState(null);

  const materiaAbierta = materias.find((m) => m.id === materiaAbiertaId);

  const guardarMateria = (m) => {
    setMaterias((prev) => {
      const existente = prev.find((x) => x.id === m.id);
      const pasaAAprobada = m.estado === "Aprobada" && (!existente || existente.estado !== "Aprobada");
      const actualizada = pasaAAprobada ? { ...m, fechaAprobada: toDateStr(new Date()) } : m;
      return existente ? prev.map((x) => (x.id === m.id ? actualizada : x)) : [...prev, actualizada];
    });
    setFormAbierto(false);
    setEditando(null);
  };

  const pedirEliminar = (id) => {
    const m = materias.find((x) => x.id === id);
    setMateriaAEliminar({ id, nombre: m ? m.nombre : "" });
  };

  const confirmarEliminar = () => {
    if (!materiaAEliminar) return;
    setMaterias((prev) => prev.filter((m) => m.id !== materiaAEliminar.id));
    setMateriaAbiertaId(null);
    setMateriaAEliminar(null);
  };

  const abrirEdicion = (m) => { setEditando(m); setFormAbierto(true); };

  const cambiarEstado = (id, nuevoEstado) => {
    setMaterias((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const pasaAAprobada = nuevoEstado === "Aprobada" && m.estado !== "Aprobada";
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
            {["Todas", ...ESTADOS].map((f) => (
              <button key={f} className={`filtro-chip ${filtro === f ? "filtro-chip-activo" : ""}`} onClick={() => setFiltro(f)}>
                {f}
              </button>
            ))}
          </div>

          {aniosPresentes.length > 1 && (
            <div className="tabs-anio">
              <button
                className={`tab-anio ${vistaAnio === "Todos" ? "tab-anio-activo" : ""}`}
                style={{ "--tc": "var(--paper-2)", "--tct": "var(--ink)" }}
                onClick={() => setVistaAnio("Todos")}
              >
                Todos
              </button>
              {aniosPresentes.map((a) => (
                <button
                  key={a}
                  className={`tab-anio ${vistaAnio === a ? "tab-anio-activo" : ""}`}
                  style={{ "--tc": colorParaAnio(a), "--tct": a ? "#F6F3E7" : "var(--ink)" }}
                  onClick={() => setVistaAnio(a)}
                >
                  {a === 0 ? "Sin año" : anioLabel(a)}
                </button>
              ))}
            </div>
          )}

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
        />
      )}

      {materiaAbierta && !formAbierto && (
        <MateriaDetalle
          materia={materiaAbierta}
          materias={materias}
          onUpdate={(m) => setMaterias((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
          onDelete={() => pedirEliminar(materiaAbierta.id)}
          onClose={() => setMateriaAbiertaId(null)}
          onEdit={() => { setEditando(materiaAbierta); setFormAbierto(true); }}
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

function ConfigGoogleClientModal({ valorInicial, onSave, onClose }) {
  const [valor, setValor] = useState(valorInicial);

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
      </div>

      <div className="ayuda-calendario ayuda-calendario-aviso">
        <p className="ayuda-calendario-titulo">⚠️ Esto solo funciona en tu página publicada</p>
        <p>
          El login de Google necesita que el origen exacto de tu sitio (por ejemplo
          https://tu-proyecto.vercel.app) esté autorizado en Google Cloud. No va a funcionar acá
          en la vista previa de Claude, ni si copiás la app a otro dominio sin agregarlo también.
        </p>
      </div>

      <div className="ayuda-calendario">
        <p className="ayuda-calendario-titulo">¿Cómo consigo el ID de cliente?</p>
        <ol>
          <li>Entrá a <strong>console.cloud.google.com</strong> y creá un proyecto (o usá uno existente).</li>
          <li>En el buscador de arriba, buscá <strong>"Google Calendar API"</strong> y tocá <strong>Habilitar</strong>.</li>
          <li>Andá a <strong>APIs y servicios → Pantalla de consentimiento de OAuth</strong>, elegí "Externo", completá el nombre de la app y tu email, y agregate a vos mismo como <strong>usuario de prueba</strong>.</li>
          <li>Andá a <strong>APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth</strong>, tipo <strong>"Aplicación web"</strong>.</li>
          <li>
            En <strong>"Orígenes de JavaScript autorizados"</strong> agregá la URL exacta de tu sitio
            (ej: https://tu-proyecto.vercel.app). Si querés probarlo en tu compu, agregá también
            http://localhost:5173.
          </li>
          <li>Copiá el <strong>ID de cliente</strong> (termina en .apps.googleusercontent.com) y pegalo acá.</li>
        </ol>
      </div>

      <div className="modal-acciones">
        <button className="btn-secundario" onClick={onClose}>Cancelar</button>
        <button className="btn-primario" disabled={!idNormalizado} onClick={() => onSave(idNormalizado)}>Guardar</button>
      </div>
    </Modal>
  );
}

function EventoGoogleFormModal({ eventoInicial, fechaSugerida, horaSugerida, onGuardar, onClose, guardando, error }) {
  const esNuevo = !eventoInicial;
  const [form, setForm] = useState(
    eventoInicial || {
      titulo: "",
      descripcion: "",
      fecha: fechaSugerida || toDateStr(new Date()),
      horaInicio: horaSugerida || "09:00",
      horaFin: sumarHora(horaSugerida || "09:00", 1),
    }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={esNuevo ? "Nuevo evento" : "Editar evento"} onClose={onClose}>
      <div className="form-grid">
        <label className="campo campo-full">
          <span>Título</span>
          <input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Segundo parcial" autoFocus />
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

function CalendarioView({ calendarId, setCalendarId, materias }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [menuConfigAbierto, setMenuConfigAbierto] = useState(false);
  const { clientId, setClientId } = useGoogleClientId();
  const [clientModalAbierto, setClientModalAbierto] = useState(false);
  const { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo } = useGoogleAuth(clientId);

  const [cursor, setCursor] = useState(new Date());
  const [vista, setVista] = useState("mes"); // "mes" | "semana"
  const [diaSel, setDiaSel] = useState(null);
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

  const eventoAApi = (form) => ({
    summary: form.titulo,
    description: form.descripcion || undefined,
    start: { dateTime: `${form.fecha}T${form.horaInicio}:00`, timeZone: "America/Argentina/Mendoza" },
    end: { dateTime: `${form.fecha}T${form.horaFin}:00`, timeZone: "America/Argentina/Mendoza" },
  });

  const abrirNuevoEvento = () => { setHoraSugerida("09:00"); setEventoModal("nuevo"); };
  // En la vista semanal, tanto tocar un evento como tocar una celda vacía
  // primero abren la tarjeta resumen del día (igual que en la vista
  // mensual); recién desde ahí, con "Editar" o con "Nuevo evento" del menú
  // de configuración, se llega al formulario editable.
  const seleccionarDia = (fechaStr) => {
    setHoraSugerida("09:00");
    setDiaSel(fechaStr);
  };
  const seleccionarDiaConHora = (fechaStr, hora) => {
    setHoraSugerida(`${String(hora).padStart(2, "0")}:00`);
    setDiaSel(fechaStr);
  };
  const esNuevoEvento = eventoModal === "nuevo";

  const guardarEvento = async (form) => {
    if (!form.titulo.trim() || !eventoModal) return;
    setGuardandoEvento(true);
    setErrorGuardarEvento("");
    try {
      if (esNuevoEvento) {
        await apiCrearEvento(accessToken, calendarIdNormalizado, eventoAApi(form));
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
    };
  };

  // ---- Armado de la grilla mensual nativa ----
  const primerDiaMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const diasEnMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const offset = (primerDiaMes.getDay() + 6) % 7; // lunes = 0
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const eventosPorDia = useMemo(() => {
    const map = new Map();
    eventosPeriodo.forEach((ev) => {
      const fechaStr = ev.start?.dateTime ? toDateStr(new Date(ev.start.dateTime)) : ev.start?.date;
      if (!fechaStr) return;
      if (!map.has(fechaStr)) map.set(fechaStr, []);
      map.get(fechaStr).push(ev);
    });
    map.forEach((lista) => lista.sort((a, b) => (a.start?.dateTime || a.start?.date || "").localeCompare(b.start?.dateTime || b.start?.date || "")));
    return map;
  }, [eventosPeriodo]);

  const eventosDelDiaSel = diaSel ? (eventosPorDia.get(diaSel) || []) : [];
  const cambiarPeriodo = (delta) => {
    if (vista === "semana") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    }
    setDiaSel(null);
  };
  const irAHoy = () => { setCursor(new Date()); setDiaSel(null); };
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

      {calendarId && (!clientId || enClaude || !accessToken || errorAuth) && (
        <div className="calendario-edicion-barra">
          {!clientId ? (
            <button className="btn-secundario btn-chico" onClick={() => setClientModalAbierto(true)}>
              <Pencil size={13} /> Usar el calendario nativo, conectado a Google
            </button>
          ) : enClaude ? (
            <span className="calendario-edicion-nota muted">
              El calendario conectado solo funciona en tu página publicada, no en esta vista previa.
            </span>
          ) : !accessToken ? (
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

      {!calendarId ? (
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
      ) : conectadoDeVerdad ? (
        <div className="calendario-nativo">
          <div className="panel calendario-nativo-panel">
            <div className="calendario-nav">
              <div className="calendario-nav-izq">
                <button className="btn-secundario btn-chico" onClick={irAHoy}>Hoy</button>
                <div className="modo-toggle">
                  <button className={vista === "mes" ? "modo-toggle-activo" : ""} onClick={() => cambiarVista("mes")}>Mes</button>
                  <button className={vista === "semana" ? "modo-toggle-activo" : ""} onClick={() => cambiarVista("semana")}>Semana</button>
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
                            .map((ev) => ({ ev, materia: materiaDeEvento(ev, materias) }))
                            .filter((x) => x.materia);
                          const importantes = evs.filter((ev) => !materiaDeEvento(ev, materias));
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
            <Modal title={fmtFechaLarga(diaSel)} onClose={() => setDiaSel(null)}>
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
                      <IconBtn icon={Pencil} title="Editar" onClick={() => setEventoModal(ev)} />
                      <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => setEventoAEliminar(ev)} />
                    </li>
                  ))}
                </ul>
              )}
            </Modal>
          )}
        </div>
      ) : (
        <div className="calendario-embed-col">
          {enClaude && (
            <div className="aviso-preview">
              <strong>Nota:</strong> la vista previa de Claude no puede mostrar calendarios externos embebidos
              por una restricción de seguridad del entorno, aunque el calendario esté bien conectado. Vas a
              verlo funcionando normalmente una vez publicada la página en Vercel. Mientras tanto podés usar
              "Abrir en Google Calendar" arriba.
            </div>
          )}
          <div className="calendario-embed-wrap">
            <iframe
              src={urlEmbed}
              className="calendario-embed"
              frameBorder="0"
              scrolling="no"
              title="Google Calendar"
            />
          </div>
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
   APP
   ========================================================================= */

export default function App() {
  const { materias, setMaterias, cargado, errorGuardado } = useStore();
  const { calendarId, setCalendarId, cargado: calCargado } = useCalendarioConfig();
  const [view, setView] = useState("inicio");
  const [materiaAbiertaId, setMateriaAbiertaId] = useState(null);
  const [confirmarReset, setConfirmarReset] = useState(false);

  const abrirMateria = (id) => {
    setMateriaAbiertaId(id);
    if (view !== "materias") setView("materias");
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
    <div className="app-shell">
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
        @media (prefers-reduced-motion: reduce) {
          .modal-overlay, .modal-card, .detalle-overlay, .detalle-panel, .visor-overlay, .fila-menu-pop,
          .fila-historial, .subtareas-panel {
            animation: none !important;
          }
        }

        .app-shell, .app-shell * { box-sizing: border-box; }
        .app-shell {
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
          font-family: 'IBM Plex Sans', sans-serif;
          color: var(--ink);
          background: var(--paper);
          height: 100vh;
          height: 100dvh;
          display: flex;
          overflow: hidden;
        }
        h1, h2, h3 { font-family: 'Fraunces', serif; font-weight: 600; margin: 0; color: var(--ink); }
        h1 { font-size: 26px; letter-spacing: -0.01em; }
        h2 { font-size: 16px; margin-bottom: 12px; }
        h3 { font-size: 17px; margin: 10px 0 4px; }
        p { margin: 0; }
        .muted { color: var(--ink-soft); font-size: 13px; }
        .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ochre); margin: 0 0 4px; }

        /* Sidebar */
        .sidebar { width: 208px; flex-shrink: 0; background: var(--forest); color: #EDE9D8; display: flex; flex-direction: column; padding: 20px 14px; gap: 22px; }
        .sidebar-brand { display: flex; align-items: center; gap: 8px; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; padding: 0 6px; }
        .sidebar-nav { display: flex; flex-direction: column; gap: 3px; }
        .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; background: none; border: none; color: #D8D3BE; font-size: 14px; font-family: inherit; cursor: pointer; text-align: left; transition: background 0.15s; }
        .sidebar-item:hover { background: rgba(237,233,216,0.08); color: #F6F3E7; }
        .sidebar-item-active { background: rgba(237,233,216,0.14); color: #FDFBF2; font-weight: 600; }
        .sidebar-carne { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--forest-dark); border-radius: 10px; }
        .ring { width: 40px; height: 40px; flex-shrink: 0; }
        .sidebar-carne-text { display: flex; flex-direction: column; line-height: 1.25; }
        .sidebar-carne-text strong { font-family: 'IBM Plex Mono', monospace; font-size: 15px; }
        .sidebar-carne-text span { font-size: 11px; color: #B9B49C; }
        .sidebar-reset { display: flex; align-items: center; gap: 6px; justify-content: center; background: none; border: none; font-family: inherit; font-size: 10.5px; color: #A39C7F; cursor: pointer; padding: 8px 4px 2px; text-align: center; }
        .sidebar-reset:hover { color: #F6F3E7; text-decoration: underline; }

        /* Layout general */
        .main-area { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .calendario-persistente { flex: 1; min-height: 0; flex-direction: column; }
        .aviso-guardado { flex-shrink: 0; background: #F1DAD3; border-bottom: 1px solid #E0B8AC; color: var(--brick); font-size: 12.5px; font-weight: 600; padding: 10px 24px; }
        .view { flex: 1; min-width: 0; padding: 32px 36px; overflow-y: auto; }
        .view-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }

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
        .panel-pendientes-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .panel-pendientes-head h2 { margin: 0; font-size: 18px; }
        .panel-pendientes-contador { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: #F6F3E7; background: var(--ochre); border-radius: 20px; padding: 2px 10px; }
        .lista-pendientes-grande { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .pendiente-fila-grande { display: flex; align-items: center; gap: 14px; padding: 13px 10px; border-radius: 10px; border-bottom: 1px solid var(--line-soft); }
        .pendiente-fila-grande:last-child { border-bottom: none; }
        .pendiente-fila-grande:hover { background: var(--paper-2); }
        .pendiente-texto-grande { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; cursor: pointer; }
        .pendiente-texto-grande strong { font-size: 14.5px; }
        .pendiente-texto-grande .muted { font-size: 12.5px; }

        /* Materias */
        .materias-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .buscador { display: flex; align-items: center; gap: 8px; background: #FFFEF9; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; flex: 1; min-width: 200px; max-width: 320px; color: var(--ink-soft); }
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
        .grupo-anio-titulo { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ochre); font-weight: 700; padding: 12px 18px 6px; }

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
        .fila-historial-grupos { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding-top: 12px; }
        .fila-historial-titulo { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ochre); font-weight: 700; margin: 0 0 6px; }
        .fila-historial-grupo ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .fila-historial-grupo li { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 3px 0; }
        .fila-historial-nota { font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: var(--forest); flex-shrink: 0; }
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
        .selector-correlativas { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--line); border-radius: 8px; padding: 4px; }
        .selector-correlativas-item { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 6px; cursor: pointer; font-weight: 500; color: var(--ink); }
        .selector-correlativas-item:hover { background: var(--paper-2); }
        .selector-correlativas-item-on { background: color-mix(in srgb, var(--forest) 10%, transparent); }
        .selector-correlativas-item input { margin: 0; flex-shrink: 0; width: 15px; height: 15px; padding: 0; border-radius: 4px; }
        .selector-correlativas-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .selector-correlativas-nombre { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .selector-correlativas-anio { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-soft); flex-shrink: 0; }
        input, select, textarea { font-family: inherit; font-size: 13.5px; color: var(--ink); background: #FFFEF9; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; width: 100%; }
        input:focus, select:focus, textarea:focus { outline: 2px solid var(--forest); outline-offset: 1px; border-color: var(--forest); }
        textarea { resize: vertical; font-weight: 400; }

        .color-picker { display: flex; gap: 8px; flex-wrap: wrap; }
        .color-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
        .color-swatch-active { border-color: var(--ink); }

        .horario-fila { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .horario-fila select, .horario-fila input { width: auto; flex: 1; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(35,39,31,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: overlayFadeIn 0.15s ease-out; }
        .modal-card { background: var(--paper); border-radius: 14px; width: 460px; max-width: 100%; max-height: 88vh; overflow-y: auto; border: 1px solid var(--line); animation: modalPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-wide { width: 620px; }
        .visor-overlay { position: fixed; inset: 0; z-index: 130; background: var(--paper); display: flex; flex-direction: column; animation: overlayFadeIn 0.15s ease-out; }
        .visor-barra { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: var(--card); }
        .visor-nombre { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .visor-contenido { flex: 1; min-height: 0; overflow: auto; display: flex; background: #5B5B52; }
        .visor-pdf-full { flex: 1; border: none; width: 100%; height: 100%; }
        .visor-imagen-full { max-width: 100%; max-height: 100%; margin: auto; display: block; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 6px; }
        .modal-body { padding: 6px 20px 20px; }
        .modal-acciones { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; grid-column: 1 / -1; }

        /* Calendario — Google Calendar embebido */
        .view-sin-padding-abajo { display: flex; flex-direction: column; padding-bottom: 0; }
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
        .calendario-nativo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
        .calendario-nativo-panel { flex-shrink: 0; }
        .calendario-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
        .calendario-nav-izq { display: flex; align-items: center; gap: 10px; }
        .calendario-nav-centro { display: flex; align-items: center; gap: 8px; font-family: 'Fraunces', serif; font-size: 15px; }
        .calendario-dias-header { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); margin-bottom: 4px; }
        .calendario-grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: minmax(84px, auto); gap: 4px; }
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
        .detalle-panel { width: 560px; max-width: 100%; height: 100%; background: var(--paper); overflow-y: auto; padding-bottom: 30px; animation: panelSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
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

        .asistencia-periodo { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; margin-bottom: 6px; }
        .asistencia-periodo-ayuda { margin-bottom: 16px; font-size: 12px; line-height: 1.5; }

        .asistencia-faltas-ancho { display: flex; align-items: stretch; gap: 10px; width: 100%; margin-bottom: 10px; }
        .asistencia-btn-ancho { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); font-family: inherit; font-weight: 600; font-size: 13.5px; cursor: pointer; transition: all 0.15s; }
        .asistencia-btn-ancho:hover { border-color: var(--forest); color: var(--forest); background: var(--paper-2); }
        .asistencia-faltas-numero { flex-shrink: 0; min-width: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
        .asistencia-faltas-numero strong { font-family: 'Fraunces', serif; font-size: 26px; line-height: 1; color: var(--brick); }
        .asistencia-faltas-numero span { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; }

        /* Exámenes */
        .promedio-card { display: flex; align-items: baseline; justify-content: space-between; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
        .promedio-card strong { font-family: 'Fraunces', serif; font-size: 22px; color: var(--forest); }
        .lista-examenes { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-examenes li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; }
        .lista-examenes li:hover { background: var(--paper-2); }
        .lista-examenes-titulo { flex: 1; font-size: 13px; }
        .lista-examenes-fecha { width: 132px; flex-shrink: 0; font-size: 12px; padding: 6px 8px; }
        .lista-examenes-nota { width: 56px; flex-shrink: 0; text-align: center; }
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
        .tarea-fecha { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 600; color: var(--ink-soft); }
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
        .mapa-nodo { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 3px; text-align: left; background: #FFFEF9; border: 1.5px solid var(--sc); border-left: 5px solid var(--mc); border-radius: 8px; padding: 7px 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(35,39,31,0.08); transition: transform 0.15s, box-shadow 0.15s; font-family: inherit; }
        .mapa-nodo:hover { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(35,39,31,0.14); z-index: 5; }
        .mapa-nodo-nombre { font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mapa-nodo-estado { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sc); font-weight: 700; }
        .mapa-nodo-dot { display: none; }
        .mapa-nodo-lock { position: absolute; top: 7px; right: 8px; color: var(--sc); }

        @media (max-width: 860px) {
          .app-shell { flex-direction: column; }
          .sidebar { width: 100%; flex-direction: row; align-items: center; padding: 10px 14px; gap: 14px; }
          .sidebar-brand { display: none; }
          .sidebar-nav { flex-direction: row; flex: 1; justify-content: space-around; }
          .sidebar-item span { display: none; }
          .sidebar-carne { display: none; }
          .sidebar-reset { display: none; }
          .view { padding: 20px; max-height: none; }
          .dos-columnas, .form-grid, .resumenes-layout { grid-template-columns: 1fr; }
          .detalle-panel { width: 100%; }
          .tabs-anio { flex-wrap: wrap; }
          .tab-anio { flex: 1 1 45%; border-bottom: 1px solid rgba(0,0,0,0.08); }
          .fila-pill { display: none; }
          .fila-historial { padding-left: 18px; }
          .fila-historial-grupos { grid-template-columns: 1fr; gap: 12px; }
          .materias-toolbar { flex-direction: column; align-items: stretch; }
          .buscador { max-width: none; }
          .modo-toggle button span, .modo-toggle button { font-size: 11.5px; }
        }
      `}</style>

      <Sidebar view={view} setView={setView} materias={materias} onResetear={() => setConfirmarReset(true)} />

      <div className="main-area">
        {errorGuardado && (
          <div className="aviso-guardado">
            <span>
              No se pudo guardar el último cambio, probablemente por falta de espacio. Si acabás de subir un archivo pesado, probá con uno más chico o con un link de Drive.
            </span>
          </div>
        )}

        {!cargado || !calCargado ? (
          <div className="view" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p className="muted">Cargando…</p>
          </div>
        ) : (
          <>
            {view === "inicio" && (
              <Inicio materias={materias} setView={setView} abrirMateria={abrirMateria} onCompletarTarea={completarTarea} />
            )}
            {view === "materias" && (
              <MateriasView
                materias={materias}
                setMaterias={setMaterias}
                materiaAbiertaId={materiaAbiertaId}
                setMateriaAbiertaId={setMateriaAbiertaId}
              />
            )}
            {/* El calendario queda siempre montado (aunque no se vea) para que el
                embed de Google no se recargue cada vez que cambiás de sección. */}
            <div className="calendario-persistente" style={{ display: view === "calendario" ? "flex" : "none" }}>
              <CalendarioView calendarId={calendarId} setCalendarId={setCalendarId} materias={materias} />
            </div>
          </>
        )}
      </div>

      {confirmarReset && (
        <Modal title="Restablecer datos de ejemplo" onClose={() => setConfirmarReset(false)}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            Esto borra todas tus materias actuales y las reemplaza por el set de datos de ejemplo
            (Contador Público, 4 años). No se puede deshacer.
          </p>
          <div className="modal-acciones">
            <button className="btn-secundario" onClick={() => setConfirmarReset(false)}>Cancelar</button>
            <button className="btn-peligro" onClick={confirmarResetDatosEjemplo}>Sí, restablecer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
