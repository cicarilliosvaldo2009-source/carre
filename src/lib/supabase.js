import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The app remains usable before the project is configured. In that state the
// persistence adapter in App.jsx falls back to the browser's local storage.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

export async function getSupabaseUser() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

/* Invoca la Edge Function "google-calendar", que guarda de forma segura (del
   lado del servidor) el Client Secret y el refresh token de Google, y los
   usa para conseguir access tokens nuevos sin depender del navegador.
   Devuelve el JSON de respuesta de la función; lanza un error si falla la
   llamada en sí (problema de red, función no desplegada, etc.). */
export async function invocarGoogleCalendarAuth(action, payload = {}) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}
