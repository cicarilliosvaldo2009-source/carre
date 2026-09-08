# Configuración de Supabase

1. Creá un proyecto en Supabase. En **Authentication > Providers**, asegurate de tener activo **Email**. No actives Anonymous sign-ins: la app usa cuentas permanentes con email y contraseña.
2. Abrí el SQL Editor y ejecutá [`supabase/migrations/202609080001_initial_schema.sql`](supabase/migrations/202609080001_initial_schema.sql).
3. Copiá `.env.example` a `.env.local` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde **Project Settings > API**.
4. Ejecutá `npm run dev`.

En **Authentication > URL Configuration**, configurá la URL de producción de Vercel como **Site URL** y agregá `http://localhost:5173/**` como Redirect URL para desarrollo. Así funcionan correctamente los correos de confirmación.

La app guarda los datos por cuenta. Si Supabase no está configurado o no se puede alcanzar, conserva el guardado local para no perder datos.

No uses la `service_role` key en el frontend. Las políticas RLS de la migración hacen que cada sesión sólo pueda leer y modificar sus propios datos.

Podés crear una cuenta o iniciar sesión desde la pantalla inicial. Con la misma cuenta podrás acceder a tus datos desde cualquier dispositivo.
