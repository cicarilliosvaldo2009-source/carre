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
} from "lucide-react";

/* =========================================================================
   TOKENS — "ficha de cátedra": estética de fichero de biblioteca / libreta
   universitaria. Serif de diploma + sans de planilla + mono de horario.
   ========================================================================= */

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

const COLORES = [
  { nombre: "Rojo", hex: "#B5432E" },
  { nombre: "Azul", hex: "#2C5C8A" },
  { nombre: "Mostaza", hex: "#C4842E" },
  { nombre: "Verde", hex: "#3D6B4F" },
  { nombre: "Violeta", hex: "#6E4C8A" },
  { nombre: "Terracota", hex: "#A65A3C" },
];

const ESTADOS = ["Pendiente", "Cursando", "Regular", "Promocionada", "Aprobada"];
const ESTADO_COLOR = {
  Pendiente: "#7A7768",
  Cursando: "#2C5C8A",
  Regular: "#C4842E",
  Promocionada: "#3D6B4F",
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
const HORA_INICIO = 8;
const HORA_FIN = 22;

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
const parseHora = (h) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh + mm / 60;
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

/* Acepta un ID de calendario suelto (ej: abc123@group.calendar.google.com
   o tu.mail@gmail.com), una URL de embed ya armada, o cualquier otro link
   de Google Calendar (como el que copia el botón "Compartir"), y devuelve
   siempre la URL de embed lista para usar. */
function armarUrlEmbedCalendario(entrada) {
  let valor = (entrada || "").trim();
  if (!valor) return "";
  if (valor.includes("calendar.google.com/calendar/embed")) return valor;
  if (valor.startsWith("http")) {
    const extraido = extraerIdDeUrl(valor);
    if (extraido) valor = extraido;
  }
  const src = encodeURIComponent(valor);
  return `https://calendar.google.com/calendar/embed?src=${src}&ctz=America%2FArgentina%2FMendoza&mode=MONTH&showTitle=0&showPrint=0&showCalendars=0&showTz=0`;
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
      horarios: [{ dia: "Lunes", inicio: "18:00", fin: "20:00" }], asistencia: { presentes: 14, faltas: 0 },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6 }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 7 }],
      tareas: [{ titulo: "Inscribirse a mesa de final", fecha: plus(10) }] },
    { nombre: "Derecho Comercial", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 2, color: "#6E4C8A", estado: "Aprobada", fechaAprobada: plus(-280), correlativas: "Elementos de Derecho Civil",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 7 }] },
    { nombre: "Microeconomía", profesor: "Lic. Paz", aula: "Aula 105", anio: 2, color: "#C4842E", estado: "Aprobada", fechaAprobada: plus(-270), correlativas: "Introducción a la Economía",
      examenes: [{ tipo: "Final", titulo: "Final", nota: 8 }] },

    // ---- 3er año (año actual: cursando / regular) ----
    { nombre: "Contabilidad de Costos", profesor: "Cra. Molina", aula: "Aula 201", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Lunes", inicio: "08:00", fin: "10:00" }, { dia: "Miércoles", inicio: "08:00", fin: "10:00" }],
      asistencia: { presentes: 10, faltas: 1 },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — Costeo ABC", nota: 8 }],
      tareas: [{ titulo: "Resolver guía de costos ABC", fecha: plus(2) }],
      resumenes: [{ titulo: "Costeo ABC", bloques: [{ tipo: "texto", titulo: "Idea central", texto: "El costeo basado en actividades asigna los costos indirectos según las actividades que efectivamente consumen los productos, en vez de prorratearlos con una única base." }] }] },
    { nombre: "Contabilidad Superior", profesor: "Cra. Herrera", aula: "Aula 101", anio: 3, color: "#B5432E", estado: "Cursando", correlativas: "Contabilidad II",
      horarios: [{ dia: "Martes", inicio: "14:00", fin: "17:00" }],
      asistencia: { presentes: 8, faltas: 3 },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 6 }],
      tareas: [{ titulo: "Preparar exposición de EECC consolidados", fecha: plus(5) }] },
    { nombre: "Derecho Tributario I", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 3, color: "#6E4C8A", estado: "Regular", correlativas: "Derecho Comercial",
      horarios: [{ dia: "Jueves", inicio: "18:00", fin: "21:00" }], asistencia: { presentes: 14, faltas: 0 },
      examenes: [{ tipo: "Parcial", titulo: "Primer parcial", nota: 7 }, { tipo: "Parcial", titulo: "Segundo parcial", nota: 6 }] },
    { nombre: "Finanzas de las Organizaciones", profesor: "Lic. Roldán", aula: "Aula 203", anio: 3, color: "#2C5C8A", estado: "Cursando", correlativas: "Matemática Financiera, Estadística I",
      horarios: [{ dia: "Viernes", inicio: "10:00", fin: "13:00" }],
      asistencia: { presentes: 9, faltas: 7 },
      examenes: [{ tipo: "Trabajo práctico", titulo: "TP1 — VAN y TIR", nota: null }],
      tareas: [{ titulo: "Entregar TP de VAN y TIR", fecha: plus(-1) }] },
    { nombre: "Derecho Laboral y de la Seguridad Social", profesor: "Dr. Ibáñez", aula: "Aula 110", anio: 3, color: "#6E4C8A", estado: "Cursando", correlativas: "Derecho Comercial",
      horarios: [{ dia: "Miércoles", inicio: "18:00", fin: "20:00" }],
      asistencia: { presentes: 6, faltas: 0 },
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
    correlativas: d.correlativas || "",
    horarios: d.horarios || [],
    notas: d.notas || "",
    recursos: (d.recursos || []).map((r) => ({ id: uid(), url: "", archivo: "", archivoNombre: "", archivoTipo: "", ...r })),
    resumenes: (d.resumenes || []).map((r) => ({
      id: uid(),
      titulo: r.titulo,
      bloques: (r.bloques || []).map((b) => ({ id: uid(), imagen: "", ...b })),
    })),
    fechaAprobada: d.fechaAprobada || null,
    asistencia: d.asistencia || { presentes: 0, faltas: 0 },
    examenes: (d.examenes || []).map((e) => ({ id: uid(), fecha: "", ...e })),
    tareas: (d.tareas || []).map((t) => ({ id: uid(), completada: false, ...t })),
  }));

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

function useStore() {
  const [materias, setMaterias] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      const datos = await cargarValor(STORAGE_KEY);
      if (datos) {
        setMaterias(datos.materias || []);
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

function Sello({ estado }) {
  return (
    <span className="sello" style={{ "--sc": ESTADO_COLOR[estado] }}>
      {estado}
    </span>
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
    { id: "horario", label: "Horario", icon: Clock },
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
  const porEstado = useMemo(() => {
    const map = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    materias.forEach((m) => (map[m.estado] = (map[m.estado] || 0) + 1));
    return map;
  }, [materias]);

  const promedioGeneral = useMemo(() => {
    const notas = materias.flatMap((m) => (m.examenes || []).map((e) => e.nota)).filter((n) => n !== null && n !== undefined && n !== "");
    if (notas.length === 0) return null;
    return notas.reduce((acc, n) => acc + Number(n), 0) / notas.length;
  }, [materias]);

  const pendientesOrdenadas = useMemo(() => {
    const todas = materias.flatMap((m) => (m.tareas || []).filter((t) => !t.completada).map((t) => ({ ...t, materia: m })));
    return todas.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha < b.fecha ? -1 : 1;
    });
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

      <div className="grid-cards">
        {ESTADOS.map((e) => (
          <div key={e} className="stat-card" style={{ "--sc": ESTADO_COLOR[e] }}>
            <span className="stat-number">{porEstado[e] || 0}</span>
            <span className="stat-label">{e}</span>
          </div>
        ))}
        <div className="stat-card" style={{ "--sc": "var(--ochre)" }}>
          <span className="stat-number">{promedioGeneral !== null ? promedioGeneral.toFixed(2) : "—"}</span>
          <span className="stat-label">Promedio general</span>
        </div>
      </div>

      <div className="dos-columnas">
        <div className="columna-izquierda">
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
        </div>

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
  );
}

/* =========================================================================
   MATERIAS
   ========================================================================= */

function calcularCorrelativasPendientes(m, materias) {
  return (m.correlativas || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((nombre) => {
      const req = materias.find((x) => x.nombre === nombre);
      return req && req.estado !== "Aprobada";
    });
}

function calcularPromedio(examenes) {
  const notas = (examenes || []).map((e) => e.nota).filter((n) => n !== null && n !== undefined && n !== "");
  if (notas.length === 0) return null;
  const suma = notas.reduce((acc, n) => acc + Number(n), 0);
  return suma / notas.length;
}

function calcularAsistenciaPct(asistencia) {
  const a = asistencia || { presentes: 0, faltas: 0 };
  const total = a.presentes + a.faltas;
  if (total === 0) return null;
  return (a.presentes / total) * 100;
}

function FilaMateria({ m, materias, onOpen, onEditar, onEliminar, onCambiarEstado }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pendientes = calcularCorrelativasPendientes(m, materias);
  const inactiva = m.estado === "Pendiente";
  const promedio = calcularPromedio(m.examenes);

  return (
    <div className={`fila-materia ${inactiva ? "fila-materia-inactiva" : ""}`} onClick={() => onOpen(m.id)}>
      <span className="fila-dot" style={{ background: m.color }} />
      <div className="fila-texto">
        <div className="fila-nombre">
          <strong>{m.nombre}</strong>
          {pendientes.length > 0 && (
            <span className="fila-lock" title={`Requiere: ${pendientes.join(", ")}`}>
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
      <div className="fila-menu" onClick={(e) => e.stopPropagation()}>
        <IconBtn icon={MoreVertical} title="Más opciones" onClick={() => setMenuAbierto((v) => !v)} />
        {menuAbierto && (
          <>
            <div className="fila-menu-backdrop" onClick={() => setMenuAbierto(false)} />
            <div className="fila-menu-pop">
              <button onClick={() => { setMenuAbierto(false); onEditar(m); }}>
                <Pencil size={13} /> Editar
              </button>
              <p className="fila-menu-label">Cambiar estado</p>
              {ESTADOS.filter((e) => e !== m.estado).map((e) => (
                <button key={e} onClick={() => { setMenuAbierto(false); onCambiarEstado(m.id, e); }}>
                  <span className="fila-menu-dot" style={{ background: ESTADO_COLOR[e] }} /> {e}
                </button>
              ))}
              <div className="fila-menu-separador" />
              <button className="fila-menu-danger" onClick={() => { setMenuAbierto(false); onEliminar(m.id); }}>
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MateriaFormModal({ materia, onSave, onClose }) {
  const [form, setForm] = useState(
    materia || {
      nombre: "", profesor: "", aula: "", color: COLORES[0].hex, estado: "Pendiente",
      anio: 1, correlativas: "", horarios: [], notas: "", recursos: [], resumenes: [],
      fechaAprobada: null, asistencia: { presentes: 0, faltas: 0 }, examenes: [], tareas: [],
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        <label className="campo campo-full">
          <span>Correlativas (separadas por coma)</span>
          <input value={form.correlativas} onChange={(e) => set("correlativas", e.target.value)} placeholder="Ej: Programación I, Álgebra" />
        </label>
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

        <label className="campo campo-full">
          <span>Notas</span>
          <textarea rows={3} value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Notas generales sobre la cursada" />
        </label>
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
  const [nuevoExamen, setNuevoExamen] = useState({ tipo: "Trabajo práctico", titulo: "", nota: "" });
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: "", descripcion: "", fecha: "" });
  const [tareaModalAbierto, setTareaModalAbierto] = useState(false);
  const [examenModalAbierto, setExamenModalAbierto] = useState(false);
  const [recursoModalAbierto, setRecursoModalAbierto] = useState(false);
  const [previewArchivo, setPreviewArchivo] = useState(null);

  const asistencia = materia.asistencia || { presentes: 0, faltas: 0 };
  const examenes = materia.examenes || [];
  const tareas = materia.tareas || [];
  const promedio = calcularPromedio(examenes);
  const asistenciaPct = calcularAsistenciaPct(asistencia);

  const patch = (fields) => onUpdate({ ...materia, ...fields });

  const updAsistencia = (fields) => patch({ asistencia: { ...asistencia, ...fields } });
  const sumarPresente = () => updAsistencia({ presentes: asistencia.presentes + 1 });
  const sumarFalta = () => updAsistencia({ faltas: asistencia.faltas + 1 });
  const restarPresente = () => updAsistencia({ presentes: Math.max(0, asistencia.presentes - 1) });
  const restarFalta = () => updAsistencia({ faltas: Math.max(0, asistencia.faltas - 1) });
  const resetAsistencia = () => updAsistencia({ presentes: 0, faltas: 0 });

  const addExamen = () => {
    if (!nuevoExamen.titulo.trim()) return;
    patch({
      examenes: [
        ...examenes,
        { id: uid(), tipo: nuevoExamen.tipo, titulo: nuevoExamen.titulo, nota: nuevoExamen.nota === "" ? null : Number(nuevoExamen.nota) },
      ],
    });
    setNuevoExamen({ tipo: "Trabajo práctico", titulo: "", nota: "" });
    setExamenModalAbierto(false);
  };
  const delExamen = (id) => patch({ examenes: examenes.filter((e) => e.id !== id) });
  const updNotaExamen = (id, valor) => {
    patch({ examenes: examenes.map((e) => (e.id === id ? { ...e, nota: valor === "" ? null : Number(valor) } : e)) });
  };

  const addTarea = () => {
    if (!nuevaTarea.titulo.trim()) return;
    patch({ tareas: [...tareas, { id: uid(), titulo: nuevaTarea.titulo, descripcion: nuevaTarea.descripcion, fecha: nuevaTarea.fecha, completada: false }] });
    setNuevaTarea({ titulo: "", descripcion: "", fecha: "" });
    setTareaModalAbierto(false);
  };
  const toggleTarea = (id) => {
    patch({ tareas: tareas.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t)) });
  };
  const delTarea = (id) => patch({ tareas: tareas.filter((t) => t.id !== id) });

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
          <div className="detalle-titulo-fila">
            <Sello estado={materia.estado} />
            {promedio !== null && <span className="detalle-promedio">Promedio {promedio.toFixed(2)}</span>}
          </div>
          <h2>{materia.nombre}</h2>
          <p className="muted">
            {materia.profesor || "Sin docente"} {materia.aula ? `· ${materia.aula}` : ""} · {anioLabel(materia.anio)}
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
            <textarea
              rows={8}
              value={materia.notas}
              onChange={(e) => patch({ notas: e.target.value })}
              placeholder="Notas sobre la cursada, avisos, recordatorios…"
            />
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
                .map((t) => (
                  <li key={t.id} className={t.completada ? "tarea-completada" : ""}>
                    <button className="tarea-check" onClick={() => toggleTarea(t.id)} title={t.completada ? "Marcar como pendiente" : "Marcar como hecha"}>
                      {t.completada ? <CheckSquare size={17} /> : <Square size={17} />}
                    </button>
                    <div className="tarea-texto">
                      <strong>{t.titulo}</strong>
                      {t.descripcion && <span className="tarea-descripcion">{t.descripcion}</span>}
                      {t.fecha && (
                        <span className={`tarea-fecha tarea-fecha-${nivelUrgencia(t.fecha)}`}>{textoUrgencia(t.fecha)}</span>
                      )}
                    </div>
                    <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => delTarea(t.id)} />
                  </li>
                ))}
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
                />
              </label>
            </div>
            <div className="modal-acciones">
              <button className="btn-secundario" onClick={() => setTareaModalAbierto(false)}>Cancelar</button>
              <button className="btn-primario" onClick={addTarea}>Agregar</button>
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
                    ? "Todavía no cargaste asistencia."
                    : asistenciaPct >= ASISTENCIA_MINIMA
                    ? "Vas bien de asistencia."
                    : "Estás por debajo del mínimo habitual (75%)."}
                </p>
                <span className="muted">{asistencia.presentes} presentes · {asistencia.faltas} faltas</span>
              </div>
            </div>

            <div className="asistencia-controles">
              <div className="asistencia-control">
                <span>Presentes</span>
                <div className="asistencia-stepper">
                  <IconBtn icon={Minus} title="Restar presente" onClick={restarPresente} />
                  <strong>{asistencia.presentes}</strong>
                  <IconBtn icon={Plus} title="Sumar presente" onClick={sumarPresente} />
                </div>
              </div>
              <div className="asistencia-control">
                <span>Faltas</span>
                <div className="asistencia-stepper">
                  <IconBtn icon={Minus} title="Restar falta" onClick={restarFalta} />
                  <strong>{asistencia.faltas}</strong>
                  <IconBtn icon={Plus} title="Sumar falta" onClick={sumarFalta} />
                </div>
              </div>
            </div>
            <button className="btn-secundario btn-chico" onClick={resetAsistencia}>Reiniciar contador</button>
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

function MapaCorrelativas({ materias, abrirMateria }) {
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

  const lineas = useMemo(() => {
    const out = [];
    materias.forEach((m) => {
      const destino = posiciones[m.id];
      if (!destino) return;
      (m.correlativas || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((nombre) => {
          const req = materias.find((x) => x.nombre === nombre);
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
            desbloqueada: req.estado === "Aprobada",
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
      <div className="mapa-leyenda">
        <span><i className="mapa-leyenda-linea mapa-leyenda-linea-ok" /> Correlativa aprobada — vía libre</span>
        <span><i className="mapa-leyenda-linea mapa-leyenda-linea-no" /> Correlativa pendiente — bloquea</span>
      </div>
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
                stroke={l.desbloqueada ? "#6FB37E" : "var(--line)"}
                strokeWidth={l.desbloqueada ? 2 : 1.5}
                strokeDasharray={l.desbloqueada ? "0" : "4 3"}
              />
            ))}
          </svg>

          {materias.map((m) => {
            const pos = posiciones[m.id];
            if (!pos) return null;
            return (
              <button
                key={m.id}
                className="mapa-nodo"
                style={{
                  left: pos.x, top: pos.y, width: MAPA_NODO_W, height: MAPA_NODO_H,
                  "--sc": ESTADO_COLOR[m.estado], "--mc": m.color,
                }}
                onClick={() => abrirMateria(m.id)}
                title={m.nombre}
              >
                <span className="mapa-nodo-dot" />
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

  const filaProps = { materias, onOpen: setMateriaAbiertaId, onEditar: abrirEdicion, onEliminar: pedirEliminar, onCambiarEstado: cambiarEstado };

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
            <Network size={14} /> Mapa de correlativas
          </button>
        </div>
      </div>

      {modo === "mapa" ? (
        <MapaCorrelativas materias={materias} abrirMateria={setMateriaAbiertaId} />
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

function HorarioView({ materias, abrirMateria }) {
  const horas = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) horas.push(h);
  const rowH = 56;

  const bloques = [];
  materias.forEach((m) => {
    m.horarios.forEach((h, i) => {
      bloques.push({ key: `${m.id}-${i}`, materia: m, ...h });
    });
  });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Semana tipo</p>
          <h1>Horario</h1>
        </div>
      </header>

      <div className="horario-grid-wrap">
        <div className="horario-grid" style={{ gridTemplateRows: `40px repeat(${horas.length}, ${rowH}px)` }}>
          <div className="horario-esquina" />
          {DIAS.map((d) => (
            <div key={d} className="horario-dia-header">{d}</div>
          ))}

          {horas.map((h) => (
            <React.Fragment key={h}>
              <div className="horario-hora-label" style={{ gridRow: h - HORA_INICIO + 2 }}>
                {String(h).padStart(2, "0")}:00
              </div>
            </React.Fragment>
          ))}

          {DIAS.map((d, di) => (
            <div key={d} className="horario-columna" style={{ gridColumn: di + 2, gridRow: `2 / span ${horas.length}` }}>
              {horas.map((h, hi) => (
                <div key={h} className="horario-celda" style={{ top: hi * rowH }} />
              ))}
              {bloques
                .filter((b) => b.dia === d)
                .map((b) => {
                  const top = (parseHora(b.inicio) - HORA_INICIO) * rowH;
                  const height = Math.max((parseHora(b.fin) - parseHora(b.inicio)) * rowH - 4, 22);
                  return (
                    <button
                      key={b.key}
                      className="horario-bloque"
                      style={{ top, height, background: b.materia.color }}
                      onClick={() => abrirMateria(b.materia.id)}
                      title={b.materia.nombre}
                    >
                      <strong>{b.materia.nombre}</strong>
                      <span>{b.inicio}–{b.fin}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   CALENDARIO — Google Calendar embebido
   ========================================================================= */

function ConfigCalendarioModal({ valorInicial, onSave, onClose }) {
  const [valor, setValor] = useState(valorInicial);

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
        <button className="btn-primario" onClick={() => onSave(valor)}>Guardar</button>
      </div>
    </Modal>
  );
}

function EventoGoogleFormModal({ eventoInicial, onGuardar, onClose, guardando, error }) {
  const [form, setForm] = useState(
    eventoInicial || { titulo: "", descripcion: "", fecha: toDateStr(new Date()), horaInicio: "09:00", horaFin: "10:00" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={eventoInicial ? "Editar evento" : "Nuevo evento"} onClose={onClose}>
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

function CalendarioView({ calendarId, setCalendarId }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const { clientId, setClientId } = useGoogleClientId();
  const [clientModalAbierto, setClientModalAbierto] = useState(false);
  const { accessToken, conectar, desconectar, conectando, errorAuth, scriptListo } = useGoogleAuth(clientId);

  const [eventos, setEventos] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [errorEventos, setErrorEventos] = useState("");
  const [eventoModal, setEventoModal] = useState(null); // null | "nuevo" | evento a editar
  const [guardandoEvento, setGuardandoEvento] = useState(false);
  const [errorGuardarEvento, setErrorGuardarEvento] = useState("");
  const [eventoAEliminar, setEventoAEliminar] = useState(null);
  const [refrescoEmbed, setRefrescoEmbed] = useState(0);

  const urlEmbed = armarUrlEmbedCalendario(calendarId);
  const urlEmbedConRefresco = urlEmbed && refrescoEmbed ? `${urlEmbed}&_r=${refrescoEmbed}` : urlEmbed;
  const enClaude = tieneStorageClaude();

  const refrescarEventos = async () => {
    if (!accessToken || !calendarId) return;
    setCargandoEventos(true);
    setErrorEventos("");
    try {
      const items = await apiListarEventos(accessToken, calendarId);
      setEventos(items);
    } catch (e) {
      setErrorEventos(e.message || "No se pudieron cargar los eventos.");
    } finally {
      setCargandoEventos(false);
    }
  };

  useEffect(() => {
    if (accessToken && calendarId) refrescarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, calendarId]);

  const eventoAApi = (form) => ({
    summary: form.titulo,
    description: form.descripcion || undefined,
    start: { dateTime: `${form.fecha}T${form.horaInicio}:00`, timeZone: "America/Argentina/Mendoza" },
    end: { dateTime: `${form.fecha}T${form.horaFin}:00`, timeZone: "America/Argentina/Mendoza" },
  });

  const guardarEvento = async (form) => {
    if (!form.titulo.trim()) return;
    setGuardandoEvento(true);
    setErrorGuardarEvento("");
    try {
      if (eventoModal && eventoModal !== "nuevo") {
        await apiActualizarEvento(accessToken, calendarId, eventoModal.id, eventoAApi(form));
      } else {
        await apiCrearEvento(accessToken, calendarId, eventoAApi(form));
      }
      setEventoModal(null);
      setRefrescoEmbed((v) => v + 1);
      refrescarEventos();
    } catch (e) {
      setErrorGuardarEvento(e.message || "No se pudo guardar el evento.");
    } finally {
      setGuardandoEvento(false);
    }
  };

  const confirmarEliminarEvento = async () => {
    if (!eventoAEliminar) return;
    try {
      await apiEliminarEvento(accessToken, calendarId, eventoAEliminar.id);
      setEventoAEliminar(null);
      setRefrescoEmbed((v) => v + 1);
      refrescarEventos();
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

  return (
    <div className="view view-sin-padding-abajo">
      <header className="view-head view-head-calendario">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1>Calendario</h1>
        </div>
        <div className="calendario-acciones-head">
          {calendarId && (
            <a
              className="btn-secundario"
              href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en Google Calendar
            </a>
          )}
          <button className="btn-secundario" onClick={() => setFormAbierto(true)}>
            <Pencil size={14} /> {calendarId ? "Cambiar calendario" : "Conectar calendario"}
          </button>
        </div>
      </header>

      {calendarId && (
        <div className="calendario-edicion-barra">
          {!clientId ? (
            <button className="btn-secundario btn-chico" onClick={() => setClientModalAbierto(true)}>
              <Pencil size={13} /> Editar eventos desde la app
            </button>
          ) : enClaude ? (
            <span className="calendario-edicion-nota muted">
              La edición de eventos solo funciona en tu página publicada, no en esta vista previa.
            </span>
          ) : !accessToken ? (
            <>
              <button className="btn-secundario btn-chico" onClick={conectar} disabled={conectando || !scriptListo}>
                {conectando ? "Conectando…" : "Conectar con Google para editar"}
              </button>
              <button className="link-btn-chico" onClick={() => setClientModalAbierto(true)}>Cambiar credenciales</button>
            </>
          ) : (
            <>
              <button className="btn-primario btn-chico" onClick={() => setEventoModal("nuevo")}>
                <Plus size={14} /> Nuevo evento
              </button>
              <button className="link-btn-chico" onClick={desconectar}>Desconectar de Google</button>
            </>
          )}
          {errorAuth && <span className="adjuntar-archivo-error">{errorAuth}</span>}
        </div>
      )}

      {urlEmbed ? (
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
              src={urlEmbedConRefresco}
              className="calendario-embed"
              frameBorder="0"
              scrolling="no"
              title="Google Calendar"
            />
          </div>

          {accessToken && (
            <div className="panel proximos-eventos-panel">
              <h2>Próximos eventos</h2>
              {cargandoEventos && <p className="muted">Cargando…</p>}
              {errorEventos && <p className="adjuntar-archivo-error">{errorEventos}</p>}
              {!cargandoEventos && eventos.length === 0 && !errorEventos && (
                <p className="muted">No hay eventos próximos en este calendario.</p>
              )}
              <ul className="lista-eventos-google">
                {eventos.map((ev) => (
                  <li key={ev.id}>
                    <div className="lista-eventos-google-texto">
                      <strong>{ev.summary || "(sin título)"}</strong>
                      <span className="muted">
                        {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }) : ev.start?.date}
                      </span>
                    </div>
                    <IconBtn icon={Pencil} title="Editar" onClick={() => setEventoModal(ev)} />
                    <IconBtn icon={Trash2} title="Eliminar" danger onClick={() => setEventoAEliminar(ev)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
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
          eventoInicial={eventoModal === "nuevo" ? null : formInicialDesdeEvento(eventoModal)}
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
      return { ...m, tareas: (m.tareas || []).map((t) => (t.id === tareaId ? { ...t, completada: !t.completada } : t)) };
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

        /* Sello estado */
        .sello { position: absolute; top: 12px; right: -6px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: var(--sc); border: 1.5px dashed var(--sc); border-radius: 4px; padding: 3px 8px; transform: rotate(4deg); background: rgba(255,255,255,0.5); }

        /* Dashboard */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 10px; margin-bottom: 26px; }
        .stat-card { background: var(--card); border: 1px solid var(--line); border-top: 3px solid var(--sc); border-radius: 10px; padding: 14px 12px; display: flex; flex-direction: column; gap: 2px; }
        .stat-number { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; color: var(--sc); }
        .stat-label { font-size: 12px; color: var(--ink-soft); }
        .dos-columnas { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start; }
        .columna-izquierda { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
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

        .lista-materias-panel { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
        .lista-materias-vacia { padding: 22px; }
        .grupo-anio-titulo { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ochre); font-weight: 700; padding: 12px 18px 6px; }

        .fila-materia { position: relative; display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--line-soft); cursor: pointer; transition: background 0.15s; }
        .grupo-anio:first-child .fila-materia:first-child, .lista-materias-panel > .fila-materia:first-child { border-top: none; }
        .fila-materia:hover { background: var(--paper-2); }
        .fila-materia-inactiva { opacity: 0.55; filter: grayscale(0.7); }
        .fila-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .fila-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .fila-nombre { display: flex; align-items: center; gap: 6px; }
        .fila-nombre strong { font-size: 14px; }
        .fila-lock { display: inline-flex; color: var(--ochre); }
        .fila-promedio { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 700; color: var(--forest); }
        .fila-pill { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; color: var(--sc); border: 1.5px solid var(--sc); border-radius: 20px; padding: 4px 11px; background: color-mix(in srgb, var(--sc) 10%, transparent); }
        .fila-menu { position: relative; flex-shrink: 0; }
        .fila-menu-backdrop { position: fixed; inset: 0; z-index: 10; }
        .fila-menu-pop { position: absolute; right: 0; top: 34px; z-index: 11; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 6px 18px rgba(35,39,31,0.18); overflow: hidden; min-width: 168px; }
        .fila-menu-pop button { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 12px; background: none; border: none; font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; text-align: left; }
        .fila-menu-pop button:hover { background: var(--paper-2); }
        .fila-menu-danger { color: var(--brick) !important; }
        .fila-menu-label { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); padding: 8px 12px 2px; margin: 0; }
        .fila-menu-separador { height: 1px; background: var(--line-soft); margin: 4px 0; }
        .fila-menu-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* Formularios */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .campo { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
        .campo-full { grid-column: 1 / -1; }
        input, select, textarea { font-family: inherit; font-size: 13.5px; color: var(--ink); background: #FFFEF9; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; width: 100%; }
        input:focus, select:focus, textarea:focus { outline: 2px solid var(--forest); outline-offset: 1px; border-color: var(--forest); }
        textarea { resize: vertical; font-weight: 400; }

        .color-picker { display: flex; gap: 8px; }
        .color-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
        .color-swatch-active { border-color: var(--ink); }

        .horario-fila { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .horario-fila select, .horario-fila input { width: auto; flex: 1; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(35,39,31,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal-card { background: var(--paper); border-radius: 14px; width: 460px; max-width: 100%; max-height: 88vh; overflow-y: auto; border: 1px solid var(--line); }
        .modal-wide { width: 620px; }
        .visor-overlay { position: fixed; inset: 0; z-index: 130; background: var(--paper); display: flex; flex-direction: column; }
        .visor-barra { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: var(--card); }
        .visor-nombre { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .visor-contenido { flex: 1; min-height: 0; overflow: auto; display: flex; background: #5B5B52; }
        .visor-pdf-full { flex: 1; border: none; width: 100%; height: 100%; }
        .visor-imagen-full { max-width: 100%; max-height: 100%; margin: auto; display: block; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 6px; }
        .modal-body { padding: 6px 20px 20px; }
        .modal-acciones { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; grid-column: 1 / -1; }

        /* Horario semanal */
        .horario-grid-wrap { overflow-x: auto; }
        .horario-grid { display: grid; grid-template-columns: 56px repeat(5, minmax(120px, 1fr)); min-width: 680px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
        .horario-esquina { grid-column: 1; grid-row: 1; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); }
        .horario-dia-header { grid-row: 1; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); border-bottom: 1px solid var(--line); border-right: 1px solid var(--line-soft); display: flex; align-items: center; justify-content: center; }
        .horario-hora-label { grid-column: 1; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); text-align: right; padding-right: 8px; border-right: 1px solid var(--line); border-top: 1px solid var(--line-soft); display: flex; align-items: flex-start; justify-content: flex-end; padding-top: 2px; }
        .horario-columna { position: relative; border-right: 1px solid var(--line-soft); }
        .horario-celda { position: absolute; left: 0; right: 0; height: 56px; border-top: 1px solid var(--line-soft); }
        .horario-bloque { position: absolute; left: 3px; right: 3px; border-radius: 6px; border: none; color: #fff; text-align: left; padding: 5px 7px; cursor: pointer; display: flex; flex-direction: column; gap: 1px; overflow: hidden; font-family: inherit; }
        .horario-bloque strong { font-size: 11px; line-height: 1.15; }
        .horario-bloque span { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; opacity: 0.9; }

        /* Calendario — Google Calendar embebido */
        .view-sin-padding-abajo { display: flex; flex-direction: column; }
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
        .proximos-eventos-panel { flex-shrink: 0; max-height: 260px; overflow-y: auto; }
        .lista-eventos-google { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-eventos-google li { display: flex; align-items: center; gap: 8px; padding: 8px 6px; border-radius: 8px; }
        .lista-eventos-google li:hover { background: var(--paper-2); }
        .lista-eventos-google-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .lista-eventos-google-texto strong { font-size: 13px; }
        .ayuda-calendario { background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: 10px; padding: 14px 16px; margin-top: 4px; }
        .ayuda-calendario-aviso { background: #F1DAD3; border-color: #E0B8AC; margin-bottom: 10px; }
        .ayuda-calendario-aviso p:last-child { font-size: 12.5px; color: var(--ink); margin: 0; line-height: 1.5; }
        .ayuda-calendario-titulo { font-weight: 700; font-size: 12.5px; margin-bottom: 6px; }
        .ayuda-calendario ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--ink-soft); }
        .ayuda-calendario li strong { color: var(--ink); }

        .chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: var(--paper-2); border: 1px solid var(--line-soft); border-radius: 20px; padding: 3px 9px; margin: 2px 4px 2px 0; }

        /* Detalle materia */
        .detalle-overlay { position: fixed; inset: 0; background: rgba(35,39,31,0.45); z-index: 90; display: flex; justify-content: flex-end; }
        .detalle-panel { width: 560px; max-width: 100%; height: 100%; background: var(--paper); overflow-y: auto; padding-bottom: 30px; }
        .detalle-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 3px solid var(--mc); background: var(--card); }
        .volver { display: flex; align-items: center; gap: 6px; background: none; border: none; font-family: inherit; font-weight: 600; font-size: 13.5px; color: var(--ink); cursor: pointer; }
        .detalle-head-acciones { display: flex; gap: 4px; }
        .detalle-titulo { padding: 20px 24px 6px; }
        .detalle-titulo-fila { display: flex; align-items: center; gap: 10px; min-height: 20px; }
        .detalle-titulo-fila .sello { position: static; transform: none; }
        .detalle-promedio { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: var(--forest); background: var(--paper-2); border-radius: 20px; padding: 4px 10px; }
        .detalle-fecha-aprobada { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #3D6B4F; font-weight: 600; margin-top: 6px; }
        .detalle-titulo h2 { margin-top: 8px; font-size: 22px; }
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
        .asistencia-resumen { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
        .asistencia-aro { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
        .asistencia-aro svg { width: 100%; height: 100%; }
        .asistencia-aro-texto { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; }
        .asistencia-datos { display: flex; flex-direction: column; gap: 4px; }
        .asistencia-estado { font-weight: 600; font-size: 13.5px; color: #3D6B4F; }
        .asistencia-estado-riesgo { color: var(--brick); }
        .asistencia-controles { display: flex; gap: 24px; margin-bottom: 14px; }
        .asistencia-control { display: flex; flex-direction: column; gap: 6px; }
        .asistencia-control span { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .asistencia-stepper { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 4px 6px; }
        .asistencia-stepper strong { min-width: 22px; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 15px; }

        /* Exámenes */
        .promedio-card { display: flex; align-items: baseline; justify-content: space-between; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
        .promedio-card strong { font-family: 'Fraunces', serif; font-size: 22px; color: var(--forest); }
        .lista-examenes { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-examenes li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; }
        .lista-examenes li:hover { background: var(--paper-2); }
        .lista-examenes-titulo { flex: 1; font-size: 13px; }
        .lista-examenes-nota { width: 56px; flex-shrink: 0; text-align: center; }
        .chip-tipo { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #fff; background: var(--tc); border-radius: 20px; padding: 3px 9px; }

        /* Tareas */
        .lista-tareas { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .lista-tareas li { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; }
        .lista-tareas li:hover { background: var(--paper-2); }
        .tarea-check { background: none; border: none; display: flex; color: var(--forest); cursor: pointer; padding: 0; flex-shrink: 0; }
        .tarea-completada { opacity: 0.55; }
        .tarea-completada .tarea-texto strong { text-decoration: line-through; }
        .tarea-texto { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .tarea-texto strong { font-size: 13px; }
        .tarea-fecha { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 600; color: var(--ink-soft); }
        .tarea-fecha-vencida { color: var(--brick); }
        .tarea-fecha-urgente { color: var(--brick); }
        .tarea-fecha-proxima { color: var(--ochre); }
        .tarea-fecha-lejana { color: #3D6B4F; }
        .tarea-descripcion { font-size: 12px; color: var(--ink-soft); }
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

        /* Mapa de correlativas */
        .mapa-wrap { display: flex; flex-direction: column; gap: 14px; }
        .mapa-leyenda { display: flex; gap: 22px; flex-wrap: wrap; font-size: 12px; color: var(--ink-soft); }
        .mapa-leyenda span { display: inline-flex; align-items: center; gap: 7px; }
        .mapa-leyenda-linea { display: inline-block; width: 22px; height: 0; border-top: 2px solid #6FB37E; }
        .mapa-leyenda-linea-no { border-top: 2px dashed var(--ink-soft); }
        .mapa-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
        .mapa-lienzo { position: relative; }
        .mapa-svg { position: absolute; top: 0; left: 0; pointer-events: none; }
        .mapa-col-titulo { position: absolute; top: 24px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ochre); font-weight: 700; text-align: center; }
        .mapa-nodo { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 3px; text-align: left; background: #FFFEF9; border: 1.5px solid var(--sc); border-left: 5px solid var(--mc); border-radius: 8px; padding: 7px 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(35,39,31,0.08); transition: transform 0.15s, box-shadow 0.15s; font-family: inherit; }
        .mapa-nodo:hover { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(35,39,31,0.14); z-index: 5; }
        .mapa-nodo-nombre { font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mapa-nodo-estado { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sc); font-weight: 700; }
        .mapa-nodo-dot { display: none; }

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
          .grid-cards { grid-template-columns: repeat(2, 1fr); }
          .detalle-panel { width: 100%; }
          .tabs-anio { flex-wrap: wrap; }
          .tab-anio { flex: 1 1 45%; border-bottom: 1px solid rgba(0,0,0,0.08); }
          .fila-pill { display: none; }
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
            {view === "horario" && (
              <HorarioView materias={materias} abrirMateria={abrirMateria} />
            )}
            {/* El calendario queda siempre montado (aunque no se vea) para que el
                embed de Google no se recargue cada vez que cambiás de sección. */}
            <div className="calendario-persistente" style={{ display: view === "calendario" ? "flex" : "none" }}>
              <CalendarioView calendarId={calendarId} setCalendarId={setCalendarId} />
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
