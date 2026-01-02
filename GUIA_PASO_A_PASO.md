# 📖 GUÍA PASO A PASO - Despliegue de SuperLiga

Esta guía te llevará paso a paso desde el código local hasta tener tu aplicación funcionando en internet.

## ✅ ANTES DE EMPEZAR - Verificación

Antes de comenzar, verifica que tienes:

- [ ] Una cuenta de GitHub (gratuita) - https://github.com
- [ ] Una cuenta de Vercel (gratuita) - https://vercel.com
- [ ] Una cuenta de Supabase (gratuita) - https://supabase.com
- [ ] Una cuenta de API-Football (para datos en vivo) - https://www.api-football.com/

Si no tienes alguna de estas cuentas, créalas primero antes de continuar.

---

## 📝 PASO 1: PREPARAR EL CÓDIGO LOCAL

### 1.1. Verificar que tienes Node.js instalado

1. Abre la aplicación "Terminal" o "PowerShell" en tu ordenador
2. Escribe este comando y presiona Enter:
   ```
   node --version
   ```
3. Si aparece un número (por ejemplo: v18.17.0 o v20.x.x), ¡perfecto! Continúa al paso 1.2
4. Si aparece un error, necesitas instalar Node.js. Ve a: https://nodejs.org y descarga la versión LTS (Long Term Support). Instálala y luego vuelve aquí.

### 1.2. Instalar las dependencias del proyecto

1. En la Terminal/PowerShell, navega hasta la carpeta del proyecto. Escribe:
   ```
   cd "C:\Users\luisi\OneDrive\0.TODO_IA\GESTOR FINANZAS PERSONALES"
   ```
   (Ajusta la ruta si tu carpeta está en otro lugar)

2. Presiona Enter

3. Ahora instala las dependencias escribiendo:
   ```
   npm install
   ```

4. Presiona Enter y espera a que termine (puede tardar 1-2 minutos)

5. Si ves mensajes en verde o "added X packages", ¡perfecto! Continúa al Paso 2.

---

## 📝 PASO 2: CREAR EL ARCHIVO .env.local

Este archivo contiene tus claves secretas. **NUNCA** lo subas a GitHub.

### 2.1. Crear el archivo

1. En la carpeta del proyecto (`GESTOR FINANZAS PERSONALES`), crea un nuevo archivo llamado exactamente: `.env.local`
   - **IMPORTANTE**: El archivo debe empezar con un punto: `.env.local`
   - Si usas Windows, puede que tengas que crear un archivo de texto y renombrarlo

2. Abre el archivo `.env.local` con el Bloc de notas o cualquier editor de texto

### 2.2. Añadir las variables de entorno

Copia y pega este contenido en el archivo `.env.local`:

```env
# API-Football (necesitas obtener tu API key desde api-football.com)
API_FOOTBALL_KEY=tu_api_key_aqui

# Supabase (usa los valores que ya tienes en superliga/config.js)
NEXT_PUBLIC_SUPABASE_URL=https://ujcesimljlifirauhlzn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2VzaW1samxpZmlyYXVobHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwOTYsImV4cCI6MjA3MzU0NjA5Nn0.h4iaFXK3ZtXzUIwMIY7GtUswAQR51zyD_sKCR9sRjaQ
```

### 2.3. Obtener tu API key de API-Football

1. Ve a: https://www.api-football.com/
2. Inicia sesión o crea una cuenta
3. Ve a tu dashboard/panel de control
4. Busca tu "API Key" o "RapidAPI Key"
5. Cópiala
6. Reemplaza `tu_api_key_aqui` en el archivo `.env.local` con tu clave real

### 2.4. Guardar el archivo

1. Guarda el archivo `.env.local`
2. **NO** cierres el archivo todavía, lo necesitarás en el Paso 5

---

## 📝 PASO 3: VERIFICAR QUE TODO FUNCIONA LOCALMENTE

Antes de subir a internet, vamos a probar que funciona en tu ordenador.

### 3.1. Iniciar el servidor de desarrollo

1. En la Terminal/PowerShell (asegúrate de estar en la carpeta del proyecto)

2. Escribe:
   ```
   npm run dev
   ```

3. Presiona Enter

4. Deberías ver un mensaje que dice algo como:
   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   ```

### 3.2. Abrir en el navegador

1. Abre tu navegador (Chrome, Firefox, Edge, etc.)
2. Ve a: `http://localhost:3000`
3. Deberías ver tu aplicación SuperLiga funcionando

### 3.3. Si funciona correctamente

- ✅ Verás la página de inicio de SuperLiga
- ✅ Puedes hacer login/registro
- ✅ La aplicación funciona igual que antes

**Si todo funciona, continúa al Paso 4. Si hay algún error, avísame antes de continuar.**

---

## 📝 PASO 4: SUBIR EL CÓDIGO A GITHUB

GitHub es donde guardaremos tu código en internet.

### 4.1. Crear un repositorio en GitHub

1. Ve a: https://github.com
2. Inicia sesión con tu cuenta
3. En la esquina superior derecha, haz clic en el icono "+" y selecciona "New repository"
4. En "Repository name" escribe: `superliga` (o el nombre que prefieras)
5. **NO marques** "Initialize this repository with a README"
6. Haz clic en "Create repository"

### 4.2. Preparar Git en tu ordenador (primera vez solamente)

Si nunca has usado Git antes, haz esto una sola vez:

1. Descarga Git desde: https://git-scm.com/download/win
2. Instálalo (sigue el asistente de instalación, presiona "Next" en todo)
3. Reinicia tu Terminal/PowerShell

### 4.3. Inicializar Git en tu proyecto

1. En la Terminal/PowerShell, asegúrate de estar en la carpeta del proyecto:
   ```
   cd "C:\Users\luisi\OneDrive\0.TODO_IA\GESTOR FINANZAS PERSONALES"
   ```

2. Escribe estos comandos uno por uno (presiona Enter después de cada uno):

   ```bash
   git init
   ```

   ```bash
   git add .
   ```

   ```bash
   git commit -m "Primera versión de SuperLiga con Next.js"
   ```

### 4.4. Conectar con GitHub y subir el código

1. En GitHub, después de crear el repositorio, verás una página con instrucciones
2. Busca la sección que dice "...or push an existing repository from the command line"
3. Copia la primera línea que dice: `git remote add origin https://github.com/TU_USUARIO/superliga.git`
   - (Reemplaza TU_USUARIO con tu nombre de usuario de GitHub)
4. Pégala en tu Terminal y presiona Enter

5. Copia la segunda línea que dice: `git branch -M main`
6. Pégala en tu Terminal y presiona Enter

7. Copia la tercera línea que dice: `git push -u origin main`
8. Pégala en tu Terminal y presiona Enter
9. Puede que te pida tu usuario y contraseña de GitHub (o un token de acceso)

### 4.5. Verificar que se subió correctamente

1. Ve a tu repositorio en GitHub: `https://github.com/TU_USUARIO/superliga`
2. Deberías ver todos tus archivos allí
3. **IMPORTANTE**: Verifica que NO esté el archivo `.env.local` en la lista (ese archivo NO debe subirse)

**Si ves tus archivos en GitHub, continúa al Paso 5. Si hay algún problema, avísame.**

---

## 📝 PASO 5: CONFIGURAR VERCEL

Vercel es donde se ejecutará tu aplicación en internet.

### 5.1. Conectar Vercel con GitHub

1. Ve a: https://vercel.com
2. Inicia sesión (puedes usar tu cuenta de GitHub para hacerlo más fácil)
3. Haz clic en "Add New Project"
4. Selecciona tu repositorio `superliga` de la lista
5. Haz clic en "Import"

### 5.2. Configurar el proyecto

1. En "Project Name" puedes dejarlo como está o cambiarlo
2. En "Framework Preset" debería aparecer "Next.js" automáticamente
3. **NO cambies nada más**, deja todo por defecto
4. Haz clic en "Environment Variables" para agregar las variables

### 5.3. Agregar Variables de Entorno en Vercel

Aquí es donde agregarás las mismas claves que pusiste en `.env.local`:

1. En "Environment Variables", haz clic en "Add New"
2. Agrega estas tres variables una por una:

   **Variable 1:**
   - Key: `API_FOOTBALL_KEY`
   - Value: (pega tu API key de API-Football)
   - Environment: Marca las tres casillas (Production, Preview, Development)
   - Haz clic en "Save"

   **Variable 2:**
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://ujcesimljlifirauhlzn.supabase.co`
   - Environment: Marca las tres casillas
   - Haz clic en "Save"

   **Variable 3:**
   - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2VzaW1samxpZmlyYXVobHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwOTYsImV4cCI6MjA3MzU0NjA5Nn0.h4iaFXK3ZtXzUIwMIY7GtUswAQR51zyD_sKCR9sRjaQ`
   - Environment: Marca las tres casillas
   - Haz clic en "Save"

### 5.4. Desplegar

1. Haz clic en "Deploy" (botón azul grande)
2. Espera a que Vercel construya tu aplicación (puede tardar 2-3 minutos)
3. Cuando termine, verás un mensaje de éxito y una URL como: `tu-proyecto.vercel.app`

### 5.5. Verificar que funciona

1. Haz clic en la URL que te dio Vercel
2. Deberías ver tu aplicación SuperLiga funcionando en internet
3. Prueba hacer login/registro para verificar que todo funciona

**Si tu aplicación funciona en la URL de Vercel, ¡FELICIDADES! Ya está en internet. Si hay algún error, avísame.**

---

## 📝 PASO 6: CONFIGURAR SUPABASE (si es necesario)

Si tu base de datos de Supabase ya está configurada y funcionando, puedes saltar este paso.

Si necesitas verificar o actualizar algo:

1. Ve a: https://supabase.com
2. Inicia sesión
3. Selecciona tu proyecto (el que tiene la URL: ujcesimljlifirauhlzn)
4. Verifica que todas las tablas estén creadas según tu estructura original

---

## ✅ RESUMEN - Lo que has logrado

- ✅ Código migrado a Next.js 14
- ✅ Aplicación funcionando localmente
- ✅ Código subido a GitHub
- ✅ Aplicación desplegada en Vercel
- ✅ Variables de entorno configuradas
- ✅ Aplicación accesible desde internet

---

## 🆘 SI ALGO FALLA

Si en cualquier paso encuentras un error:

1. **Copia el mensaje de error completo**
2. **Dime en qué paso estabas**
3. **Dime qué estabas haciendo exactamente**

Y te ayudaré a solucionarlo antes de continuar con el siguiente paso.

---

## 📞 SIGUIENTE PASO

Cuando hayas completado el Paso 1 (instalar dependencias), avísame y te guiaré para el Paso 2.

**No tengas prisa, ve paso a paso y verifica cada cosa antes de continuar.**





