# SuperLiga - Next.js 14

Aplicación web para pronosticar resultados de LaLiga 2025-2026, migrada a Next.js 14 con App Router.

## 🚀 Características

- ✅ Migración completa a Next.js 14 con App Router
- ✅ API interna `/api/live` para datos de partidos en vivo (API-Football)
- ✅ Cache de 120 segundos para optimizar llamadas API
- ✅ Actualizaciones automáticas cada 30 segundos para partidos en curso
- ✅ Mismo diseño y funcionalidad que la versión original

## 📋 Requisitos Previos

- Node.js 18+ (Next.js 14 requiere Node.js 18.17 o superior)
- Cuenta de API-Football (para datos en vivo)
- Proyecto de Supabase configurado

## 🛠️ Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   
   Crea un archivo `.env.local` en la raíz del proyecto con:
   ```env
   # API-Football (solo backend - no se expone al navegador)
   API_FOOTBALL_KEY=tu_api_key_de_api_football
   
   # Supabase (públicas - se exponen al navegador)
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```

3. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`

## 📦 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta el linter

## 🌐 Despliegue en Vercel

### Paso 1: Preparar el proyecto

1. Asegúrate de que el código esté en un repositorio de GitHub
2. Verifica que todas las dependencias estén en `package.json`

### Paso 2: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Inicia sesión con tu cuenta de GitHub
3. Haz clic en "Add New Project"
4. Selecciona el repositorio de SuperLiga
5. Vercel detectará automáticamente que es un proyecto Next.js

### Paso 3: Configurar Variables de Entorno

En la configuración del proyecto en Vercel, agrega las siguientes variables de entorno:

**En la sección "Environment Variables":**

- `API_FOOTBALL_KEY` = Tu API key de API-Football
- `NEXT_PUBLIC_SUPABASE_URL` = Tu URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Tu Anon Key de Supabase

### Paso 4: Desplegar

1. Haz clic en "Deploy"
2. Vercel construirá y desplegará automáticamente tu aplicación
3. Una vez completado, recibirás una URL como `tu-proyecto.vercel.app`

## 📁 Estructura del Proyecto

```
.
├── app/
│   ├── api/
│   │   └── live/
│   │       └── route.ts          # API interna para datos en vivo
│   ├── globals.css                # Estilos globales
│   ├── layout.tsx                 # Layout raíz
│   └── page.tsx                   # Página principal
├── public/
│   ├── app.js                     # Lógica principal de la aplicación
│   ├── config.js                  # Configuración de Supabase
│   └── live-updates.js            # Script de actualizaciones en vivo
├── package.json
├── next.config.js
└── README.md
```

## 🔌 API Interna `/api/live`

### Endpoint

```
GET /api/live?fixture={fixture_id}
```

### Parámetros

- `fixture` (requerido): ID del fixture de API-Football

### Respuesta

```json
{
  "teams": {
    "home": "Real Madrid",
    "away": "FC Barcelona"
  },
  "score": {
    "home": 2,
    "away": 1
  },
  "minute": 67,
  "status": "LIVE"
}
```

### Características

- ✅ Cache de 120 segundos
- ✅ Manejo de errores
- ✅ API key protegida (no se expone al navegador)

## 🔄 Actualizaciones en Vivo

El sistema actualiza automáticamente los partidos en curso cada 30 segundos:

1. Detecta partidos con `status: LIVE`, `HT`, o `2H`
2. Llama a `/api/live` para cada partido
3. Actualiza los marcadores sin recargar la página
4. Muestra el minuto de juego actual

## 🔐 Seguridad

- ✅ API keys almacenadas solo en variables de entorno del servidor
- ✅ Variables `NEXT_PUBLIC_*` solo para datos públicos (Supabase)
- ✅ API-Football key nunca se expone al navegador

## 📝 Notas Importantes

1. **API-Football**: Necesitas tener una cuenta activa en [API-Football](https://www.api-football.com/)
2. **Fixture IDs**: Los partidos deben tener un campo `fixture_id` o `api_football_id` en la base de datos para que las actualizaciones en vivo funcionen
3. **Supabase**: La configuración de Supabase se lee desde variables de entorno `NEXT_PUBLIC_*`

## 🐛 Solución de Problemas

### Error: "API_FOOTBALL_KEY no configurada"
- Verifica que hayas creado `.env.local` con la variable `API_FOOTBALL_KEY`
- En Vercel, verifica que la variable esté configurada en el panel

### Error: "Supabase no está inicializado"
- Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas
- Verifica que el script de Supabase se esté cargando correctamente

### Las actualizaciones en vivo no funcionan
- Verifica que los partidos tengan `fixture_id` o `api_football_id` en la base de datos
- Verifica la consola del navegador para errores
- Asegúrate de que `/api/live` esté funcionando correctamente

## 📄 Licencia

Este proyecto es privado y de uso personal.





