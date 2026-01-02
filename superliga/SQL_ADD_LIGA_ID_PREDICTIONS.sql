-- =============================================
-- AÑADIR LIGA_ID A PREDICTIONS
-- =============================================
-- Este script añade la columna liga_id a la tabla predictions
-- para que cada pronóstico esté asociado a una liga específica

-- 1. Añadir columna liga_id (puede ser NULL inicialmente para compatibilidad)
ALTER TABLE predictions 
ADD COLUMN IF NOT EXISTS liga_id INTEGER REFERENCES ligas(id) ON DELETE CASCADE;

-- 2. Si ya hay predicciones, asignarlas a la primera liga de cada usuario
-- (solo si el usuario tiene al menos una liga)
UPDATE predictions p
SET liga_id = (
    SELECT lm.liga_id 
    FROM liga_members lm 
    WHERE lm.user_id = p.user_id 
    LIMIT 1
)
WHERE p.liga_id IS NULL;

-- 3. Hacer liga_id NOT NULL después de asignar valores
-- (Comentar esta línea si quieres permitir NULL temporalmente)
-- ALTER TABLE predictions ALTER COLUMN liga_id SET NOT NULL;

-- 4. Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_predictions_liga ON predictions(liga_id);

-- 5. Actualizar la restricción UNIQUE para incluir liga_id
-- Primero eliminar la restricción antigua si existe
ALTER TABLE predictions 
DROP CONSTRAINT IF EXISTS predictions_user_id_match_id_key;

-- Crear nueva restricción única con liga_id
ALTER TABLE predictions 
ADD CONSTRAINT predictions_user_match_liga_unique 
UNIQUE(user_id, match_id, liga_id);

-- =============================================
-- NOTAS:
-- =============================================
-- - Si un usuario tiene múltiples ligas, sus predicciones antiguas
--   se asignarán a su primera liga
-- - Los nuevos pronósticos requerirán seleccionar una liga
-- - Si quieres permitir pronósticos sin liga temporalmente,
--   no ejecutes el paso 3 (ALTER COLUMN SET NOT NULL)






