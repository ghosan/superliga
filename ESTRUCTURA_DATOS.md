# Estructura de Datos - SuperLiga

## Configuración del Sistema

### Torneo Actual
- **La Liga Española**: Por defecto, todos los partidos pertenecen a La Liga
- **Futuro**: Se podrán añadir otros torneos (Eurocopas, Mundiales, etc.)

---

## Principios Fundamentales

### 1. Partidos Globales (Matches)
- ✅ Los **partidos son GLOBALES** para toda la aplicación
- ✅ Todos los partidos se comparten entre **TODAS las ligas**
- ✅ Los **resultados son los mismos** para todas las ligas
- ✅ Los partidos NO tienen `liga_id` (no pertenecen a una liga específica)

**Estructura de `matches`:**
```sql
- id
- jornada
- match_date
- home_team
- away_team
- home_score  (resultado final - compartido)
- away_score  (resultado final - compartido)
```

### 2. Pronósticos por Liga (Predictions)
- ✅ Cada liga tiene sus **propios pronósticos**
- ✅ Los pronósticos SÍ tienen `liga_id`
- ✅ Un usuario puede tener **diferentes pronósticos** para el mismo partido en diferentes ligas

**Estructura de `predictions`:**
```sql
- id
- user_id
- match_id
- liga_id       (IMPORTANTE: Distingue entre ligas)
- home_prediction
- away_prediction
- points        (calculado basado en resultado real)
```

**Clave única:** `(user_id, match_id, liga_id)`

### 3. Puntuaciones por Liga
- ✅ Cada liga tiene su **propia clasificación**
- ✅ Los puntos se calculan **solo con las predicciones de esa liga**
- ✅ Un usuario puede tener **diferentes puntuaciones** en diferentes ligas

---

## Flujo de Datos

### Carga de Partidos
1. **Admin carga partidos** → Se guardan en `matches` (sin `liga_id`)
2. **Todos los usuarios** → Ven los mismos partidos
3. **Todas las ligas** → Usan los mismos partidos

### Hacer Pronósticos
1. Usuario selecciona una **liga**
2. Usuario hace pronósticos → Se guardan en `predictions` con `liga_id`
3. Los pronósticos son **específicos de esa liga**

### Ver Resultados
1. Admin introduce resultados → Se actualizan en `matches`
2. Los resultados se muestran **iguales para todas las ligas**
3. Los puntos se calculan **automáticamente** para cada predicción

### Clasificación por Liga
1. Se filtran predicciones por `liga_id`
2. Se calculan puntos **solo de esa liga**
3. Se ordenan usuarios por puntos **de esa liga específica**

---

## Funciones Clave

### `loadMatches(ligaId)`
- Carga partidos GLOBALES (sin filtrar por liga)
- Parámetro `ligaId` solo se usa para cargar **pronósticos del usuario** en esa liga
- Los partidos mostrados son los mismos para todas las ligas

### `savePredictions()`
- Guarda pronósticos con `liga_id`
- Un usuario puede guardar diferentes pronósticos para el mismo partido en diferentes ligas

### `loadLigaClassification(ligaId)`
- Filtra predicciones por `liga_id`
- Calcula puntos **solo de esa liga**
- Muestra clasificación **específica de la liga**

### `calculatePointsForMatch(matchId)`
- Calcula puntos para **todas las predicciones** de ese partido
- Afecta a **todas las ligas** que tengan predicciones para ese partido

---

## Ejemplo Práctico

### Escenario:
- **Jornada 1**: Real Madrid vs FC Barcelona (Resultado: 2-1)
- **Liga A**: Usuario1 pronostica 1-0, Usuario2 pronostica 2-1
- **Liga B**: Usuario1 pronostica 3-1, Usuario3 pronostica 2-0

### Datos:
```sql
-- Matches (GLOBAL)
match_id=1, jornada=1, home_team="Real Madrid", away_team="FC Barcelona", home_score=2, away_score=1

-- Predictions (POR LIGA)
prediction_id=1, user_id=Usuario1, match_id=1, liga_id=LigaA, home_pred=1, away_pred=0, points=0
prediction_id=2, user_id=Usuario2, match_id=1, liga_id=LigaA, home_pred=2, away_pred=1, points=10
prediction_id=3, user_id=Usuario1, match_id=1, liga_id=LigaB, home_pred=3, away_pred=1, points=5
prediction_id=4, user_id=Usuario3, match_id=1, liga_id=LigaB, home_pred=2, away_pred=0, points=0
```

### Clasificaciones:
- **Liga A**: Usuario2 (10pts), Usuario1 (0pts)
- **Liga B**: Usuario1 (5pts), Usuario3 (0pts)

---

## Notas Importantes

1. **Nunca filtrar matches por liga_id** - Los partidos son globales
2. **Siempre filtrar predictions por liga_id** - Los pronósticos son por liga
3. **Los resultados se muestran iguales** para todas las ligas
4. **Los puntos se calculan por liga** - Cada liga tiene su propia clasificación

---

## Futuras Mejoras

### Múltiples Torneos
En el futuro, cuando se añadan otros torneos:
- Añadir campo `torneo_id` o `torneo_type` a `matches`
- Filtrar matches por torneo
- Mantener la misma estructura (partidos globales, pronósticos por liga)

---

**Última actualización**: 2025-01-26


