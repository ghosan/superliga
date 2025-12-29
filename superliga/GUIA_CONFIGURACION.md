# 🏆 SuperLiga - Guía de Configuración Paso a Paso

Esta guía te explica cómo configurar y subir tu web de SuperLiga a internet usando Supabase, GitHub y Vercel.

---

## 📋 ÍNDICE

1. [Crear cuenta en Supabase](#1-crear-cuenta-en-supabase)
2. [Crear el proyecto en Supabase](#2-crear-el-proyecto-en-supabase)
3. [Crear las tablas de la base de datos](#3-crear-las-tablas-de-la-base-de-datos)
4. [Configurar tu usuario como Administrador](#4-configurar-tu-usuario-como-administrador)
5. [Obtener las claves de Supabase](#5-obtener-las-claves-de-supabase)
6. [Configurar el archivo config.js](#6-configurar-el-archivo-configjs)
7. [Subir el proyecto a GitHub](#7-subir-el-proyecto-a-github)
8. [Desplegar en Vercel](#8-desplegar-en-vercel)

---

## 1. CREAR CUENTA EN SUPABASE

### Paso 1.1: Ir a la web de Supabase
1. Abre tu navegador (Chrome, Firefox, Edge...)
2. Ve a: **https://supabase.com**
3. Haz clic en el botón verde **"Start your project"** (Iniciar tu proyecto)

### Paso 1.2: Registrarte
1. Puedes registrarte con:
   - **GitHub** (recomendado si ya tienes cuenta)
   - **Email y contraseña**
2. Si usas email, recibirás un correo de confirmación. Haz clic en el enlace para verificar.

---

## 2. CREAR EL PROYECTO EN SUPABASE

### Paso 2.1: Crear nuevo proyecto
1. Una vez dentro de Supabase, verás el Dashboard
2. Haz clic en **"New Project"** (Nuevo Proyecto)
3. Rellena los datos:
   - **Name**: `superliga` (o el nombre que quieras)
   - **Database Password**: Escribe una contraseña segura y **GUÁRDALA** (la necesitarás)
   - **Region**: Selecciona `West EU (Ireland)` o la más cercana a España
4. Haz clic en **"Create new project"**
5. Espera 1-2 minutos mientras se crea el proyecto

---

## 3. CREAR LAS TABLAS DE LA BASE DE DATOS

### Paso 3.1: Ir al Editor SQL
1. En el menú lateral izquierdo, haz clic en **"SQL Editor"** (icono de base de datos con código)
2. Verás un editor de texto donde puedes escribir código SQL

### Paso 3.2: Crear las tablas
1. Copia TODO el siguiente código:

```sql
-- =============================================
-- SUPERLIGA - CREACIÓN DE TABLAS
-- =============================================

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar jornada activa inicial
INSERT INTO config (key, value) VALUES ('active_jornada', '1') ON CONFLICT (key) DO NOTHING;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de partidos
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    jornada INTEGER NOT NULL CHECK (jornada >= 1 AND jornada <= 38),
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de predicciones
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    home_prediction INTEGER NOT NULL CHECK (home_prediction >= 0),
    away_prediction INTEGER NOT NULL CHECK (away_prediction >= 0),
    points INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

-- Tabla de ligas/porras
CREATE TABLE IF NOT EXISTS ligas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de miembros de ligas
CREATE TABLE IF NOT EXISTS liga_members (
    id SERIAL PRIMARY KEY,
    liga_id INTEGER NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(liga_id, user_id)
);

-- =============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =============================================
CREATE INDEX IF NOT EXISTS idx_matches_jornada ON matches(jornada);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_liga_members_liga ON liga_members(liga_id);
CREATE INDEX IF NOT EXISTS idx_liga_members_user ON liga_members(user_id);

-- =============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligas ENABLE ROW LEVEL SECURITY;
ALTER TABLE liga_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Políticas para USERS
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any user" ON users FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas para MATCHES
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Admins can insert matches" ON matches FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can update matches" ON matches FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete matches" ON matches FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas para PREDICTIONS
CREATE POLICY "Users can view all predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own predictions" ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON predictions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any prediction" ON predictions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can delete predictions" ON predictions FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- Políticas para LIGAS
CREATE POLICY "Anyone can view ligas" ON ligas FOR SELECT USING (true);
CREATE POLICY "Users can create ligas" ON ligas FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their ligas" ON ligas FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their ligas" ON ligas FOR DELETE USING (auth.uid() = created_by);

-- Políticas para LIGA_MEMBERS
CREATE POLICY "Anyone can view liga members" ON liga_members FOR SELECT USING (true);
CREATE POLICY "Users can join ligas" ON liga_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave ligas" ON liga_members FOR DELETE USING (auth.uid() = user_id);

-- Políticas para CONFIG
CREATE POLICY "Anyone can view config" ON config FOR SELECT USING (true);
CREATE POLICY "Admins can update config" ON config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can insert config" ON config FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
```

2. Pega el código en el editor SQL
3. Haz clic en el botón **"Run"** (Ejecutar) - es el botón verde con un triángulo
4. Deberías ver un mensaje de éxito: "Success. No rows returned"

---

## 4. CONFIGURAR TU USUARIO COMO ADMINISTRADOR

### Paso 4.1: Registrarte en la web
1. Primero, abre tu web en local (doble clic en index.html) o espera a subirla a Vercel
2. Regístrate con tu email y contraseña
3. Confirma tu email si te llega un correo

### Paso 4.2: Hacerte administrador
1. Vuelve a Supabase
2. En el menú izquierdo, haz clic en **"Table Editor"**
3. Haz clic en la tabla **"users"**
4. Busca tu usuario en la lista
5. Haz clic en la fila de tu usuario
6. Cambia el campo **"is_admin"** de `false` a `true`
7. Presiona **Enter** o haz clic fuera para guardar

¡Ya eres administrador! Podrás ver el panel de Admin en la navegación.

---

## 5. OBTENER LAS CLAVES DE SUPABASE

### Paso 5.1: Ir a configuración
1. En el menú izquierdo, haz clic en el icono de **engranaje** (Settings/Configuración)
2. Luego haz clic en **"API"** en el submenú

### Paso 5.2: Copiar las claves
Verás dos datos importantes que necesitas copiar:

1. **Project URL**: Es algo como `https://xxxxxxxxxxxxx.supabase.co`
   - Haz clic en el botón de copiar (📋) junto a la URL
   - **GUARDA ESTA URL**

2. **anon public key**: Es una cadena larga de letras y números
   - Está en la sección "Project API keys"
   - Busca la que dice **"anon"** y **"public"**
   - Haz clic en el botón de copiar
   - **GUARDA ESTA CLAVE**

---

## 6. CONFIGURAR EL ARCHIVO CONFIG.JS

### Paso 6.1: Abrir el archivo
1. Abre **VSCode**
2. Abre la carpeta `superliga` (Archivo > Abrir Carpeta)
3. Haz clic en el archivo **`config.js`**

### Paso 6.2: Pegar las claves
Verás estas líneas al principio del archivo:

```javascript
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
```

Reemplázalas con tus datos:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';  // Tu URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';  // Tu clave anon
```

⚠️ **IMPORTANTE**: Mantén las comillas simples alrededor de los valores

### Paso 6.3: Guardar
1. Presiona **Ctrl + S** para guardar el archivo

---

## 7. SUBIR EL PROYECTO A GITHUB

### Paso 7.1: Crear cuenta en GitHub (si no tienes)
1. Ve a **https://github.com**
2. Haz clic en **"Sign up"**
3. Sigue los pasos para crear tu cuenta

### Paso 7.2: Crear un nuevo repositorio
1. Una vez dentro de GitHub, haz clic en el **"+"** en la esquina superior derecha
2. Selecciona **"New repository"**
3. Rellena:
   - **Repository name**: `superliga`
   - **Description** (opcional): `Porra LaLiga 2025-2026`
   - Selecciona **"Public"** (gratis)
4. **NO** marques ninguna otra opción
5. Haz clic en **"Create repository"**

### Paso 7.3: Subir archivos desde VSCode
1. En VSCode, con la carpeta superliga abierta:
2. Haz clic en el icono de **"Source Control"** (rama con un punto) en el menú izquierdo
3. Haz clic en **"Initialize Repository"**
4. Escribe un mensaje en el campo de texto: `Primera versión`
5. Haz clic en el botón **"✓ Commit"** (o presiona Ctrl+Enter)
6. Si te pregunta si quieres hacer "stage" de todos los cambios, di que **Sí**

### Paso 7.4: Conectar con GitHub
1. Haz clic en **"Publish Branch"**
2. VSCode te pedirá iniciar sesión en GitHub - acepta
3. Selecciona **"Publish to GitHub public repository"**
4. Espera a que se suba

---

## 8. DESPLEGAR EN VERCEL

### Paso 8.1: Crear cuenta en Vercel
1. Ve a **https://vercel.com**
2. Haz clic en **"Start Deploying"** o **"Sign Up"**
3. Selecciona **"Continue with GitHub"** (recomendado)
4. Autoriza a Vercel para acceder a tu GitHub

### Paso 8.2: Importar el proyecto
1. En el Dashboard de Vercel, haz clic en **"Add New..."** > **"Project"**
2. Verás una lista de tus repositorios de GitHub
3. Busca **"superliga"** y haz clic en **"Import"**

### Paso 8.3: Configurar y desplegar
1. En la página de configuración:
   - **Project Name**: déjalo como está o cámbialo
   - **Framework Preset**: selecciona **"Other"**
   - **Root Directory**: déjalo vacío
2. Haz clic en **"Deploy"**
3. Espera 1-2 minutos

### Paso 8.4: ¡Tu web está lista!
1. Vercel te mostrará un mensaje de éxito con confeti 🎉
2. Haz clic en el enlace que aparece (algo como `superliga.vercel.app`)
3. ¡Tu web ya está en internet!

---

## ✅ RESUMEN DE TAREAS COMPLETADAS

Una vez hagas todo esto, tendrás:

- [x] Base de datos en Supabase funcionando
- [x] Tu usuario configurado como Administrador
- [x] Web conectada a Supabase
- [x] Código en GitHub
- [x] Web desplegada en Vercel y accesible desde internet

---

## 🔧 CÓMO USAR LA WEB (PARA ADMINISTRADORES)

### Añadir partidos
1. Inicia sesión con tu cuenta de admin
2. Ve a la pestaña **"Admin"** en la navegación
3. En "Gestionar Partidos", rellena:
   - Jornada (1-38)
   - Fecha y hora del partido
   - Equipo local y visitante
4. Haz clic en "Añadir Partido"

### Introducir resultados
1. Ve a "Admin" > "Introducir Resultados"
2. Selecciona la jornada
3. Introduce el resultado de cada partido
4. Haz clic en "Guardar" - los puntos se calcularán automáticamente

### Cambiar jornada activa
1. Ve a "Admin" > "Jornadas"
2. Introduce el número de jornada
3. Haz clic en "Establecer como Activa"

---

## 🆘 PROBLEMAS COMUNES

### "Error al iniciar sesión"
- Verifica que las claves en `config.js` sean correctas
- Asegúrate de haber confirmado tu email

### "No puedo ver el panel de Admin"
- Ve a Supabase > Table Editor > users
- Asegúrate de que tu usuario tenga `is_admin = true`

### "Los partidos no se guardan"
- Verifica que estés logueado como admin
- Revisa la consola del navegador (F12) para ver errores

### "Los pronósticos no se guardan"
- Asegúrate de estar logueado
- El partido no debe haber comenzado todavía

---

## 📞 ¿NECESITAS AYUDA?

Si tienes algún problema, revisa:
1. Que las claves de Supabase estén bien copiadas
2. Que hayas ejecutado TODO el SQL sin errores
3. Que tu usuario sea administrador

¡Buena suerte con tu SuperLiga! ⚽🏆




