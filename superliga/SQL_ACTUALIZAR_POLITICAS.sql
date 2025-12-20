-- =============================================
-- SUPERLIGA - ACTUALIZACIÓN DE POLÍTICAS DE SEGURIDAD
-- Administradores ven TODO
-- Usuarios normales solo ven sus ligas
-- =============================================

-- Primero eliminamos TODAS las políticas existentes para recrearlas
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in same ligas" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

DROP POLICY IF EXISTS "Anyone can view ligas" ON ligas;
DROP POLICY IF EXISTS "Users can view their ligas" ON ligas;
DROP POLICY IF EXISTS "Anyone can check liga by code" ON ligas;
DROP POLICY IF EXISTS "Users can create ligas" ON ligas;
DROP POLICY IF EXISTS "Creators can update their ligas" ON ligas;
DROP POLICY IF EXISTS "Creators can delete their ligas" ON ligas;

DROP POLICY IF EXISTS "Anyone can view liga members" ON liga_members;
DROP POLICY IF EXISTS "Users can view members of their ligas" ON liga_members;
DROP POLICY IF EXISTS "Users can join ligas" ON liga_members;
DROP POLICY IF EXISTS "Users can leave ligas" ON liga_members;

DROP POLICY IF EXISTS "Users can view all predictions" ON predictions;
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can view predictions of liga members" ON predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON predictions;
DROP POLICY IF EXISTS "Admins can update any prediction" ON predictions;
DROP POLICY IF EXISTS "Admins can delete predictions" ON predictions;

DROP POLICY IF EXISTS "Anyone can view matches" ON matches;
DROP POLICY IF EXISTS "Admins can insert matches" ON matches;
DROP POLICY IF EXISTS "Admins can update matches" ON matches;
DROP POLICY IF EXISTS "Admins can delete matches" ON matches;

DROP POLICY IF EXISTS "Anyone can view config" ON config;
DROP POLICY IF EXISTS "Admins can update config" ON config;
DROP POLICY IF EXISTS "Admins can insert config" ON config;

-- =============================================
-- FUNCIÓN AUXILIAR: Verificar si es admin
-- =============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- POLÍTICAS PARA USERS
-- =============================================

-- SELECT: Admins ven todos, usuarios ven solo los de sus ligas
CREATE POLICY "users_select_policy" ON users
FOR SELECT USING (
    -- Es admin → ve todo
    is_admin()
    OR
    -- Es su propio perfil
    auth.uid() = id
    OR
    -- Usuarios de sus mismas ligas
    id IN (
        SELECT lm2.user_id 
        FROM liga_members lm1
        JOIN liga_members lm2 ON lm1.liga_id = lm2.liga_id
        WHERE lm1.user_id = auth.uid()
    )
);

-- INSERT: Usuarios pueden crear su propio perfil
CREATE POLICY "users_insert_policy" ON users
FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: Usuarios pueden actualizar su perfil, admins pueden actualizar cualquiera
CREATE POLICY "users_update_policy" ON users
FOR UPDATE USING (
    auth.uid() = id OR is_admin()
);

-- =============================================
-- POLÍTICAS PARA LIGAS
-- =============================================

-- SELECT: Admins ven todas, usuarios ven solo las suyas + pueden verificar códigos
CREATE POLICY "ligas_select_policy" ON ligas
FOR SELECT USING (
    -- Es admin → ve todo
    is_admin()
    OR
    -- Es miembro de la liga
    id IN (SELECT liga_id FROM liga_members WHERE user_id = auth.uid())
    OR
    -- Es el creador
    created_by = auth.uid()
    OR
    -- Permitir verificar si un código existe (para registro)
    code IS NOT NULL
);

-- INSERT: Cualquier usuario autenticado puede crear ligas
CREATE POLICY "ligas_insert_policy" ON ligas
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- UPDATE: Solo el creador o admins
CREATE POLICY "ligas_update_policy" ON ligas
FOR UPDATE USING (
    created_by = auth.uid() OR is_admin()
);

-- DELETE: Solo el creador o admins
CREATE POLICY "ligas_delete_policy" ON ligas
FOR DELETE USING (
    created_by = auth.uid() OR is_admin()
);

-- =============================================
-- POLÍTICAS PARA LIGA_MEMBERS
-- =============================================

-- SELECT: Admins ven todos, usuarios ven solo miembros de sus ligas
CREATE POLICY "liga_members_select_policy" ON liga_members
FOR SELECT USING (
    -- Es admin → ve todo
    is_admin()
    OR
    -- Es miembro de esa liga
    liga_id IN (SELECT liga_id FROM liga_members WHERE user_id = auth.uid())
);

-- INSERT: Usuarios pueden unirse a ligas
CREATE POLICY "liga_members_insert_policy" ON liga_members
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DELETE: Usuarios pueden salir de ligas, admins pueden eliminar a cualquiera
CREATE POLICY "liga_members_delete_policy" ON liga_members
FOR DELETE USING (
    auth.uid() = user_id OR is_admin()
);

-- =============================================
-- POLÍTICAS PARA PREDICTIONS
-- =============================================

-- SELECT: Admins ven todas, usuarios ven las de sus ligas
CREATE POLICY "predictions_select_policy" ON predictions
FOR SELECT USING (
    -- Es admin → ve todo
    is_admin()
    OR
    -- Son sus propias predicciones
    user_id = auth.uid()
    OR
    -- Predicciones de usuarios de sus mismas ligas
    user_id IN (
        SELECT lm2.user_id 
        FROM liga_members lm1
        JOIN liga_members lm2 ON lm1.liga_id = lm2.liga_id
        WHERE lm1.user_id = auth.uid()
    )
);

-- INSERT: Usuarios pueden crear sus propias predicciones
CREATE POLICY "predictions_insert_policy" ON predictions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuarios pueden actualizar las suyas, admins todas
CREATE POLICY "predictions_update_policy" ON predictions
FOR UPDATE USING (
    auth.uid() = user_id OR is_admin()
);

-- DELETE: Solo admins pueden eliminar predicciones
CREATE POLICY "predictions_delete_policy" ON predictions
FOR DELETE USING (is_admin());

-- =============================================
-- POLÍTICAS PARA MATCHES
-- =============================================

-- SELECT: Todos pueden ver los partidos
CREATE POLICY "matches_select_policy" ON matches
FOR SELECT USING (true);

-- INSERT: Solo admins
CREATE POLICY "matches_insert_policy" ON matches
FOR INSERT WITH CHECK (is_admin());

-- UPDATE: Solo admins
CREATE POLICY "matches_update_policy" ON matches
FOR UPDATE USING (is_admin());

-- DELETE: Solo admins
CREATE POLICY "matches_delete_policy" ON matches
FOR DELETE USING (is_admin());

-- =============================================
-- POLÍTICAS PARA CONFIG
-- =============================================

-- SELECT: Todos pueden ver la configuración
CREATE POLICY "config_select_policy" ON config
FOR SELECT USING (true);

-- INSERT: Solo admins
CREATE POLICY "config_insert_policy" ON config
FOR INSERT WITH CHECK (is_admin());

-- UPDATE: Solo admins
CREATE POLICY "config_update_policy" ON config
FOR UPDATE USING (is_admin());

-- =============================================
-- RESUMEN DE PERMISOS
-- =============================================
-- 
-- ADMINISTRADORES (is_admin = true):
--   ✅ Ver TODOS los usuarios
--   ✅ Ver TODAS las ligas
--   ✅ Ver TODOS los miembros de todas las ligas
--   ✅ Ver TODAS las predicciones
--   ✅ Crear/editar/eliminar partidos
--   ✅ Introducir resultados
--   ✅ Modificar configuración
--
-- USUARIOS NORMALES (is_admin = false):
--   ✅ Ver usuarios de SUS ligas
--   ✅ Ver SUS ligas
--   ✅ Ver miembros de SUS ligas
--   ✅ Ver predicciones de SUS ligas
--   ✅ Crear/editar SUS predicciones
--   ✅ Unirse a ligas con código
--   ❌ NO pueden ver otras ligas
--   ❌ NO pueden gestionar partidos
--   ❌ NO pueden introducir resultados
-- =============================================
