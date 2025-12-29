# Estructura de Competiciones - SuperLiga

## Objetivo
Permitir múltiples competiciones (La Liga, Mundial, Eurocopa, etc.) manteniendo los datos completamente aislados entre ellas.

---

## Cambios en Base de Datos

### 1. Nueva Tabla: `competitions`
```sql
CREATE TABLE competitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,  -- "La Liga", "Mundial 2026", "Eurocopa 2028"
  slug VARCHAR(50) NOT NULL UNIQUE,   -- "la-liga", "mundial-2026", "eurocopa-2028"
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear competición por defecto (La Liga)
INSERT INTO competitions (name, slug, description) VALUES 
('La Liga', 'la-liga', 'Liga Española de Fútbol');
```

### 2. Modificar Tabla `matches`
```sql
ALTER TABLE matches 
ADD COLUMN competition_id INTEGER REFERENCES competitions(id) DEFAULT 1;

-- Crear índice para mejor rendimiento
CREATE INDEX idx_matches_competition_id ON matches(competition_id);

-- Actualizar partidos existentes a la competición por defecto
UPDATE matches SET competition_id = 1 WHERE competition_id IS NULL;
```

### 3. Modificar Tabla `ligas`
```sql
ALTER TABLE ligas 
ADD COLUMN competition_id INTEGER REFERENCES competitions(id) DEFAULT 1;

-- Crear índice
CREATE INDEX idx_ligas_competition_id ON ligas(competition_id);

-- Actualizar ligas existentes
UPDATE ligas SET competition_id = 1 WHERE competition_id IS NULL;
```

### 4. Modificar Tabla `predictions`
```sql
-- Las predictions ya tienen liga_id, y las ligas ahora tienen competition_id
-- Por lo tanto, las predictions quedan indirectamente asociadas a la competición
-- No es necesario añadir competition_id directamente a predictions
```

### 5. Nueva Tabla: `config` (si no existe)
```sql
CREATE TABLE IF NOT EXISTS config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Añadir configuración de competición activa
INSERT INTO config (key, value) VALUES ('active_competition_id', '1')
ON CONFLICT (key) DO NOTHING;
```

---

## Estructura de Aislamiento

### Principio Fundamental
**TODOS los datos deben estar asociados a una competición:**
- Partidos → `competition_id`
- Ligas → `competition_id`
- Pronósticos → A través de `liga_id` → `competition_id`
- Clasificaciones → Filtradas por competición

### Flujo de Datos

1. **Usuario selecciona competición activa** → Se guarda en localStorage y config
2. **Carga de partidos** → Solo muestra partidos de la competición activa
3. **Carga de ligas** → Solo muestra ligas de la competición activa
4. **Pronósticos** → Solo se pueden hacer en ligas de la competición activa
5. **Clasificaciones** → Solo muestra clasificaciones de la competición activa

---

## Modificaciones en el Código

### Variables Globales
```javascript
let currentCompetitionId = 1; // Por defecto La Liga
let currentCompetition = null;
```

### Funciones Principales a Modificar

1. **loadMatches()** → Filtrar por `competition_id`
2. **loadUserLigas()** → Filtrar ligas por `competition_id`
3. **loadLigaClassification()** → Solo ligas de competición activa
4. **savePredictions()** → Validar que liga pertenece a competición activa
5. **loadAdminMatches()** → Filtrar por competición activa
6. **Todas las queries** → Incluir filtro de `competition_id`

---

## Interfaz de Usuario

### Selector de Competición
- Ubicación: Header/Navegación (prominente)
- Al cambiar: Recargar todos los datos
- Guardar selección: localStorage + config en base de datos

### Panel Admin
- Nueva pestaña: "Competiciones"
- Crear/Editar/Activar competiciones
- Gestionar competiciones

---

## Ejemplo de Uso

### Escenario: Usuario tiene ligas en dos competiciones

1. **Competición: La Liga**
   - Liga A (3 usuarios)
   - Liga B (5 usuarios)
   - Partidos: 38 jornadas

2. **Competición: Mundial 2026**
   - Liga Mundial (10 usuarios)
   - Partidos: Fase de grupos, octavos, cuartos, etc.

### Comportamiento:
- Al seleccionar "La Liga" → Solo ve ligas y partidos de La Liga
- Al seleccionar "Mundial 2026" → Solo ve ligas y partidos del Mundial
- Los datos están completamente aislados

---

## Migración de Datos Existentes

```sql
-- Todos los datos existentes se asignan a la competición por defecto (id=1)
UPDATE matches SET competition_id = 1 WHERE competition_id IS NULL;
UPDATE ligas SET competition_id = 1 WHERE competition_id IS NULL;
```

---

**Fecha de creación**: 2025-01-29

