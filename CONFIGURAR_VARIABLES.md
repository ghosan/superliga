# Configurar Variables de Entorno

## Para Desarrollo Local

1. Crea un archivo `.env.local` en la raíz del proyecto
2. Copia el contenido de `.env.local.example`
3. Completa los valores (especialmente `API_FOOTBALL_KEY`)

## Para Vercel (Producción)

### Pasos:

1. Ve a tu proyecto en Vercel: https://vercel.com
2. Selecciona tu proyecto "superliga"
3. Ve a **Settings** → **Environment Variables**
4. Añade estas variables:

#### Variable 1:
- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://ujcesimljlifirauhlzn.supabase.co`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

#### Variable 2:
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2VzaW1samxpZmlyYXVobHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwOTYsImV4cCI6MjA3MzU0NjA5Nn0.h4iaFXK3ZtXzUIwMIY7GtUswAQR51zyD_sKCR9sRjaQ`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

#### Variable 3:
- **Key:** `API_FOOTBALL_KEY`
- **Value:** (Tu API key de API-Football)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

5. Haz clic en **Save**
6. Vuelve a desplegar el proyecto (Vercel lo hará automáticamente o puedes hacerlo manualmente desde el dashboard)

### Verificar que funcionó:

Después del despliegue, en la consola del navegador deberías ver:
- ✅ `📦 Variables de entorno inyectadas: {hasUrl: true, hasKey: true, fromEnv: true}`
- ✅ `✅ Supabase inicializado correctamente`
- ✅ `✅ App inicializada, Supabase listo`

Si ves `fromEnv: false`, significa que las variables no se están leyendo desde Vercel y se están usando los valores por defecto.


