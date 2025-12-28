// ========================================
// SuperLiga - Aplicación Principal
// ========================================

// Variables globales
let currentUser = null;
let isAdmin = false;
let currentJornada = 1;
let userPredictions = {};
let activeJornada = 1;
let selectedPronosticosLiga = null; // Liga seleccionada para hacer pronósticos

// ========================================
// INICIALIZACIÓN
// ========================================
// Función que se ejecuta cuando el DOM está listo
async function initializeApp() {
    // Esperar a que Supabase esté inicializado
    let supabase = window.supabase || window.supabaseClient;
    let retries = 0;
    const maxRetries = 100; // 10 segundos máximo
    
    while ((!supabase || !window.supabaseReady || !supabase.auth) && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        supabase = window.supabase || window.supabaseClient;
        retries++;
    }
    
    // Verificar que Supabase esté completamente inicializado
    if (!supabase || !supabase.auth) {
        console.error('❌ Error: Supabase no se pudo inicializar correctamente. Verifica que las variables de entorno estén configuradas.');
        // No mostrar alert, solo log en consola para no interrumpir
        return;
    }
    
    // Hacer disponible globalmente para otras funciones
    window.supabase = supabase;
    console.log('✅ App inicializada, Supabase listo');
    
    // Verificar si hay sesión activa
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        await showDashboard();
    }

    // Listener para cambios de autenticación (usar la variable local supabase)
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await loadUserProfile();
            await showDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            isAdmin = false;
            showLandingPage();
        }
    });

    // Configurar navegación
    setupNavigation();
    
    // Tabs de clasificación eliminados - solo se muestra por liga
    
    // Configurar tabs de admin
    setupAdminTabs();
    
    // Cargar equipos en selectores
    loadTeamsInSelectors();
    
    // Cargar jornadas en selectores admin
    loadJornadasSelectors();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM ya está listo
    initializeApp();
}

// ========================================
// UTILIDADES
// ========================================
/**
 * Obtener cliente de Supabase de forma segura
 * @returns {Object|null} Cliente de Supabase o null si no está disponible
 */
function getSupabase() {
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        console.warn('⚠️ Supabase no está disponible');
        return null;
    }
    if (!window.supabaseReady) {
        console.warn('⚠️ Supabase aún no está listo');
        return null;
    }
    return supabase;
}

/**
 * Ejecutar una consulta a Supabase con timeout
 * @param {Function} queryFn Función que retorna la promesa de la consulta
 * @param {number} timeoutMs Timeout en milisegundos (default: 10000)
 * @returns {Promise} Resultado de la consulta o error de timeout
 */
async function executeQueryWithTimeout(queryFn, timeoutMs = 10000) {
    const queryPromise = queryFn();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout: La consulta tardó más de ${timeoutMs/1000} segundos`)), timeoutMs)
    );
    
    try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        return result;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Timeout')) {
            throw error;
        }
        throw error;
    }
}

// ========================================
// AUTENTICACIÓN
// ========================================
function showLoginModal() {
    closeModals();
    document.getElementById('login-modal').classList.add('active');
}

function showRegisterModal() {
    closeModals();
    document.getElementById('register-modal').classList.add('active');
}

function showForgotPasswordModal() {
    closeModals();
    document.getElementById('forgot-password-modal').classList.add('active');
}

function showRulesModal() {
    closeModals();
    document.getElementById('rules-modal').classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Cerrar modal al hacer clic fuera
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModals();
        }
    });
});

// Validar email
function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim()) && email.length <= 255;
}

// Validar contraseña (flexible para permitir cualquier longitud razonable)
function validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    // Permitir cualquier contraseña no vacía (Supabase tiene sus propias validaciones)
    return password.length > 0 && password.length <= 256;
}

// Sanitizar string
function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().slice(0, 500); // Limitar longitud
}

async function handleLogin(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    // Validar inputs básicos (solo verificar que no estén vacíos)
    if (!email || email.trim().length === 0) {
        showNotification('Por favor, ingresa tu email', 'error');
        return;
    }

    if (!password || password.length === 0) {
        showNotification('Por favor, ingresa tu contraseña', 'error');
        return;
    }

    // Validación opcional de formato de email (no bloqueante)
    if (!validateEmail(email)) {
        // Avisar pero permitir intentar (puede ser un formato válido que no cumple el regex)
        console.warn('Formato de email puede ser inválido:', email);
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Mostrar mensajes más descriptivos para ayudar al usuario
            console.error('Error de login:', error);
            
            if (error.message && error.message.includes('Invalid login')) {
                showNotification('Email o contraseña incorrectos', 'error');
            } else if (error.message && error.message.includes('Email not confirmed')) {
                showNotification('Por favor, verifica tu email antes de iniciar sesión', 'error');
            } else {
                showNotification(`Error: ${error.message || 'No se pudo iniciar sesión'}`, 'error');
            }
            return;
        }

        showNotification('¡Bienvenido de nuevo!', 'success');
        closeModals();
    } catch (error) {
        console.error('Error en login:', error);
        showNotification('Error al iniciar sesión. Intenta de nuevo.', 'error');
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('forgot-password-email');
    const email = emailInput?.value?.trim() || '';

    if (!email || email.trim().length === 0) {
        showNotification('Por favor, ingresa tu email', 'error');
        return;
    }

    // Validación básica de email
    if (!validateEmail(email)) {
        showNotification('Por favor, ingresa un email válido', 'error');
        return;
    }

    try {
        // Esperar a que Supabase esté inicializado
        let supabase = window.supabase || window.supabaseClient;
        let retries = 0;
        const maxRetries = 50; // 5 segundos máximo
        
        while ((!supabase || !window.supabaseReady) && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            supabase = window.supabase || window.supabaseClient;
            retries++;
        }
        
        if (!supabase || !supabase.auth) {
            console.error('Supabase no disponible después de esperar');
            showNotification('Error: No se pudo conectar con el servidor. Por favor, recarga la página.', 'error');
            return;
        }

        // Obtener la URL correcta para redirección
        // IMPORTANTE: Supabase solo permite redirecciones a URLs que estén en su whitelist
        // Por eso SIEMPRE debemos usar la URL de producción, incluso si estamos en localhost
        // La URL debe estar configurada en Supabase Dashboard → Authentication → URL Configuration
        
        // SIEMPRE usar la URL de producción
        const productionUrl = 'https://superliga-two.vercel.app';
        const redirectUrl = `${productionUrl}/reset-password`;
        
        console.log('📧 Enviando email de recuperación:');
        console.log('   - Email:', email);
        console.log('   - Redirect URL:', redirectUrl);
        console.log('   - IMPORTANTE: Esta URL debe estar en Supabase Dashboard → Authentication → URL Configuration');
        
        // Enviar email de recuperación
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });

        if (error) {
            console.error('Error al enviar email de recuperación:', error);
            
            // Mensajes más específicos según el tipo de error
            if (error.message && error.message.includes('rate limit')) {
                showNotification('Demasiados intentos. Por favor, espera unos minutos e intenta de nuevo.', 'error');
            } else if (error.message && error.message.includes('not found')) {
                showNotification('No encontramos una cuenta con ese email.', 'error');
            } else {
                showNotification('Error al enviar el email. Verifica que el email sea correcto e intenta de nuevo.', 'error');
            }
            return;
        }

        showNotification('¡Email enviado! Revisa tu bandeja de entrada (y carpeta de spam) para restablecer tu contraseña.', 'success');
        
        // Limpiar el campo de email
        if (emailInput) {
            emailInput.value = '';
        }
        
        // Cerrar modal después de 3 segundos
        setTimeout(() => {
            closeModals();
            showLoginModal();
        }, 3000);

    } catch (error) {
        console.error('Error en recuperación de contraseña:', error);
        showNotification('Error inesperado. Por favor, recarga la página e intenta de nuevo.', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const ligaCodeInput = document.getElementById('register-liga-code');
    const nameInput = document.getElementById('register-name');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    
    const ligaCode = ligaCodeInput ? sanitizeString(ligaCodeInput.value).toUpperCase().slice(0, 10) : '';
    const name = nameInput ? sanitizeString(nameInput.value).slice(0, 100) : '';
    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    // Validar inputs
    if (!name || name.length < 2) {
        showNotification('El nombre debe tener al menos 2 caracteres', 'error');
        return;
    }

    if (!email || email.trim().length === 0) {
        showNotification('Por favor, ingresa un email válido', 'error');
        return;
    }

    if (!password || password.length === 0) {
        showNotification('Por favor, ingresa una contraseña', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    // Validar código de liga (si se proporciona)
    if (ligaCode && (!/^[A-Z0-9]+$/.test(ligaCode) || ligaCode.length !== 6)) {
        showNotification('El código de liga debe tener 6 caracteres alfanuméricos', 'error');
        return;
    }

    try {
        let liga = null;
        
        // 1. Si hay código, verificar que existe (opcional)
        if (ligaCode) {
            const { data: ligaData, error: ligaError } = await supabase
                .from('ligas')
                .select('id, name')
                .eq('code', ligaCode)
                .single();

            if (ligaError || !ligaData) {
                showNotification('El código de liga no existe. Verifica con el creador de tu liga.', 'error');
                return;
            }
            liga = ligaData;
        }

        // 2. Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name
                }
            }
        });

        if (authError) {
            // No exponer detalles específicos del error
            if (authError.message.includes('already registered')) {
                showNotification('Este email ya está registrado. Inicia sesión en su lugar.', 'error');
            } else if (authError.message.includes('password')) {
                showNotification('La contraseña no cumple los requisitos de seguridad', 'error');
            } else {
                showNotification('Error al registrar. Intenta de nuevo.', 'error');
            }
            console.error('Error en registro:', authError);
            return;
        }

        // 3. Crear perfil en la tabla users
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: email,
                    name: name,
                    is_admin: false,
                    total_points: 0
                });

            if (profileError) {
                console.error('Error creando perfil:', profileError);
            }

            // 4. Si hay código de liga, añadir usuario a la liga
            if (liga) {
                const { error: memberError } = await supabase
                    .from('liga_members')
                    .insert({
                        liga_id: liga.id,
                        user_id: authData.user.id
                    });

                if (memberError) {
                    console.error('Error añadiendo a liga:', memberError);
                }
            }
        }

        const message = liga 
            ? `¡Cuenta creada! Te has unido a "${liga.name}". Revisa tu email.`
            : '¡Cuenta creada! Puedes unirte a una liga desde tu perfil. Revisa tu email.';
        
        showNotification(message, 'success');
        closeModals();
        document.getElementById('register-form').reset();
    } catch (error) {
        showNotification(error.message || 'Error al registrarse', 'error');
    }
}

// Mostrar modal para crear primera liga
function showCreateFirstLigaModal() {
    closeModals();
    document.getElementById('create-first-liga-modal').classList.add('active');
}

// Crear liga + usuario administrador
async function handleCreateFirstLiga(event) {
    event.preventDefault();
    
    const ligaName = document.getElementById('first-liga-name').value;
    const ligaDescription = document.getElementById('first-liga-description').value;
    const adminName = document.getElementById('admin-name').value;
    const adminEmail = document.getElementById('admin-email').value;
    const adminPassword = document.getElementById('admin-password').value;
    const ligaCode = generateLigaCode();

    try {
        // 1. Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: adminEmail,
            password: adminPassword,
            options: {
                data: {
                    name: adminName
                }
            }
        });

        if (authError) throw authError;

        if (!authData.user) {
            throw new Error('No se pudo crear el usuario');
        }

        // 2. Crear perfil en la tabla users (como admin)
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: adminEmail,
                name: adminName,
                is_admin: true,
                total_points: 0
            });

        if (profileError) {
            console.error('Error creando perfil:', profileError);
            throw profileError;
        }

        // 3. Crear la liga
        const { data: newLiga, error: ligaError } = await supabase
            .from('ligas')
            .insert({
                name: ligaName,
                description: ligaDescription,
                code: ligaCode,
                created_by: authData.user.id
            })
            .select()
            .single();

        if (ligaError) {
            console.error('Error creando liga:', ligaError);
            throw ligaError;
        }

        // 4. Añadir creador como miembro de la liga automáticamente
        const { error: memberError } = await supabase
            .from('liga_members')
            .insert({
                liga_id: newLiga.id,
                user_id: authData.user.id
            });

        if (memberError) {
            console.error('Error añadiendo creador a la liga:', memberError);
            // No lanzamos error porque la liga ya se creó, solo mostramos advertencia
            showNotification('Liga creada, pero hubo un problema al añadirte como miembro. Puedes unirte manualmente.', 'warning');
        } else {
            console.log('✅ Creador añadido automáticamente a la liga');
        }

        // Mostrar código de liga al usuario
        showNotification(`¡Liga creada! Tu código es: ${ligaCode}`, 'success');
        closeModals();
        
        // Mostrar alerta con el código para que lo copie
        setTimeout(() => {
            alert(`¡Liga "${ligaName}" creada correctamente!\n\nTu código de liga es:\n\n${ligaCode}\n\nComparte este código con tus amigos para que se registren.\n\nRevisa tu email para confirmar tu cuenta.`);
        }, 500);

        document.getElementById('create-first-liga-form').reset();
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message || 'Error al crear la liga', 'error');
    }
}

async function handleLogout() {
    console.log('🚪 Cerrando sesión...');
    
    // Asegurarse de que supabase esté disponible
    const clientSupabase = window.supabase || window.supabaseClient;
    if (!clientSupabase) {
        console.error('❌ Supabase no disponible para logout');
        // Forzar mostrar landing page de todas formas
        showLandingPage();
        return;
    }
    
    try {
        const { error } = await clientSupabase.auth.signOut();
        console.log('Resultado signOut:', error ? 'Error' : 'OK');
        
        // Limpiar variables (siempre, aunque haya error)
        currentUser = null;
        isAdmin = false;
        userPredictions = {};
        
        // Ocultar link de admin
        const adminLink = document.getElementById('admin-nav-link');
        if (adminLink) adminLink.style.display = 'none';
        
        // Mostrar página de inicio
        showLandingPage();
        
        if (error) {
            console.error('Error en signOut:', error);
        }
        
        showNotification('Sesión cerrada correctamente', 'success');
        console.log('✅ Logout completado');
    } catch (error) {
        console.error('❌ Error logout:', error);
        
        // Limpiar y mostrar landing de todas formas
        currentUser = null;
        isAdmin = false;
        userPredictions = {};
        showLandingPage();
        showNotification('Sesión cerrada', 'warning');
    }
}

// ========================================
// PERFIL DE USUARIO
// ========================================
async function loadUserProfile() {
    if (!currentUser) {
        console.log('❌ No hay usuario actual');
        return;
    }

    console.log('🔍 Cargando perfil para:', currentUser.id, currentUser.email);

    // Mostrar nombre temporal mientras carga
    const userName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Usuario';
    document.getElementById('user-name').textContent = userName;
    updateNavAvatar(userName, null);

    try {
        // Intentar cargar perfil de la tabla users
        // Primero intentamos sin avatar_url por si no existe la columna
        let { data, error } = await supabase
            .from('users')
            .select('id, name, email, is_admin, total_points')
            .eq('id', currentUser.id)
            .maybeSingle();
        
        // Si la consulta falla, intentamos con avatar_url
        if (error && error.message.includes('avatar_url')) {
            console.log('⚠️ Columna avatar_url no existe, intentando sin ella');
            const retry = await supabase
                .from('users')
                .select('id, name, email, is_admin, total_points')
                .eq('id', currentUser.id)
                .maybeSingle();
            data = retry.data;
            error = retry.error;
        }

        console.log('📦 Resultado consulta users:', { data, error });

        if (error) {
            console.error('❌ Error en consulta:', error.message, error.code);
            // Si hay error de permisos, intentar verificar admin de otra forma
            if (error.code === '42501' || error.message.includes('permission')) {
                console.log('⚠️ Error de permisos RLS - verificando con función alternativa');
            }
            isAdmin = false;
            updateAdminVisibility();
            return;
        }

        if (data) {
            // Verificar is_admin de múltiples formas
            isAdmin = data.is_admin === true || data.is_admin === 1 || data.is_admin === 'true';
            const displayName = data.name || userName;
            document.getElementById('user-name').textContent = displayName;
            
            // Actualizar avatar en navegación (avatar_url puede no existir)
            const avatarUrl = data.avatar_url || null;
            updateNavAvatar(displayName, avatarUrl);
            
            console.log('✅ Perfil cargado:', {
                nombre: displayName,
                is_admin_raw: data.is_admin,
                is_admin_type: typeof data.is_admin,
                isAdmin: isAdmin,
                puntos: data.total_points
            });
        } else {
            console.log('⚠️ No se encontró perfil en tabla users');
            isAdmin = false;
        }

        console.log('🔍 Llamando updateAdminVisibility con isAdmin =', isAdmin);
        updateAdminVisibility();

    } catch (error) {
        console.error('❌ Error en loadUserProfile:', error);
        isAdmin = false;
        updateAdminVisibility();
    }
}

// Función separada para actualizar visibilidad del admin
function updateAdminVisibility() {
    console.log('🔍 updateAdminVisibility llamado. isAdmin =', isAdmin);
    
    const adminLink = document.getElementById('admin-nav-link');
    
    if (!adminLink) {
        console.error('❌ No se encontró el elemento admin-nav-link');
        // Intentar de nuevo después de un pequeño delay
        setTimeout(() => {
            const retryLink = document.getElementById('admin-nav-link');
            if (retryLink) {
                console.log('✅ Elemento encontrado en reintento');
                updateAdminVisibility();
            }
        }, 500);
        return;
    }
    
    if (isAdmin) {
        adminLink.style.display = 'flex';
        adminLink.style.visibility = 'visible';
        adminLink.style.opacity = '1';
        adminLink.classList.add('active');
        console.log('✅ Panel Admin VISIBLE - estilos aplicados');
    } else {
        adminLink.style.display = 'none';
        adminLink.style.visibility = 'hidden';
        adminLink.classList.remove('active');
        console.log('🔒 Panel Admin OCULTO (no es admin)');
    }
}

// ========================================
// NAVEGACIÓN
// ========================================
function showLandingPage() {
    document.getElementById('landing-page').classList.add('active');
    document.getElementById('dashboard-page').classList.remove('active');
}

async function showDashboard() {
    const landingPage = document.getElementById('landing-page');
    const dashboardPage = document.getElementById('dashboard-page');
    
    if (!landingPage || !dashboardPage) {
        console.error('❌ Elementos de página no encontrados');
        return;
    }

    landingPage.classList.remove('active');
    dashboardPage.classList.add('active');
    
    try {
        // Cargar datos iniciales (esperar a que se completen)
        await loadActiveJornada();
        
        // Cargar en paralelo las que no dependen entre sí
        await Promise.allSettled([
            loadUserPredictions(),
            loadProgress()
        ]);
        
        // Cargar dashboard principal
        await loadDashboard();
        
        // Asegurar que la visibilidad del admin se actualice después de mostrar el dashboard
        setTimeout(() => {
            updateAdminVisibility();
        }, 100);
    } catch (error) {
        console.error('❌ Error inicializando dashboard:', error);
    }
}

// ========================================
// DASHBOARD PRINCIPAL
// ========================================
async function loadDashboard() {
    if (!currentUser) {
        console.warn('⚠️ No hay usuario para cargar dashboard');
        return;
    }

    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        console.error('❌ Supabase no está disponible');
        return;
    }

    // Verificar que los elementos existan
    const userNameEl = document.getElementById('user-name');
    const dashboardUserNameEl = document.getElementById('dashboard-user-name');

    if (!userNameEl || !dashboardUserNameEl) {
        console.error('❌ Elementos del dashboard no encontrados');
        return;
    }

    // Actualizar nombre en el dashboard
    const userName = userNameEl.textContent || 'Usuario';
    dashboardUserNameEl.textContent = userName;

    try {
        // Cargar todos los datos del dashboard en paralelo
        await Promise.all([
            loadDashboardSummary(),
            loadDashboardStatistics(),
            loadDashboardJornada(),
            loadDashboardTopLigas(),
            loadDashboardActivity()
        ]);
    } catch (error) {
        console.error('❌ Error cargando dashboard:', error);
    }
}

async function loadDashboardSummary() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener datos del usuario
        const { data: userData, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('users')
                .select('total_points')
                .eq('id', currentUser.id)
                .single()
        , 5000);

        const totalPoints = userData?.total_points || 0;

        // Actualizar puntos totales
        const pointsEl = document.getElementById('dashboard-total-points');
        if (pointsEl) pointsEl.textContent = totalPoints.toLocaleString();

        // Actualizar badge según puntos
        const badgeEl = document.getElementById('dashboard-badge');
        if (badgeEl) {
            if (totalPoints >= 10000) {
                badgeEl.innerHTML = '<i class="fas fa-crown"></i><span>Maestro</span>';
                badgeEl.className = 'dashboard-badge badge-gold';
            } else if (totalPoints >= 5000) {
                badgeEl.innerHTML = '<i class="fas fa-medal"></i><span>Experto</span>';
                badgeEl.className = 'dashboard-badge badge-silver';
            } else if (totalPoints >= 1000) {
                badgeEl.innerHTML = '<i class="fas fa-trophy"></i><span>Pro</span>';
                badgeEl.className = 'dashboard-badge badge-bronze';
            } else {
                badgeEl.innerHTML = '<i class="fas fa-star"></i><span>Principiante</span>';
                badgeEl.className = 'dashboard-badge';
            }
        }

        // Obtener jornada activa
        const { data: configData } = await executeQueryWithTimeout(() =>
            supabase
                .from('config')
                .select('value')
                .eq('key', 'active_jornada')
                .single()
        , 5000).catch(() => ({ data: null }));

        const activeJornada = configData?.value || 1;
        const jornadaInfoEl = document.getElementById('dashboard-jornada-info');
        if (jornadaInfoEl) jornadaInfoEl.textContent = `Jornada ${activeJornada}`;

    } catch (error) {
        console.error('Error cargando resumen:', error);
    }
}

async function loadDashboardStatistics() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener todas las predicciones del usuario
        const { data: predictions, error: predError } = await executeQueryWithTimeout(() =>
            supabase
                .from('predictions')
                .select('points, matches(jornada)')
                .eq('user_id', currentUser.id)
        , 8000).catch(() => ({ data: [], error: null }));

        const predictedCount = predictions?.length || 0;
        const totalPoints = predictions?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
        const avgPoints = predictedCount > 0 ? (totalPoints / predictedCount).toFixed(1) : '0';

        // Calcular puntos por jornada
        const pointsByJornada = {};
        if (predictions) {
            predictions.forEach(p => {
                const jornada = p.matches?.jornada;
                if (jornada) {
                    pointsByJornada[jornada] = (pointsByJornada[jornada] || 0) + (p.points || 0);
                }
            });
        }

        // Calcular promedio por jornada
        const jornadas = Object.keys(pointsByJornada);
        const avgJornada = jornadas.length > 0 
            ? (Object.values(pointsByJornada).reduce((a, b) => a + b, 0) / jornadas.length).toFixed(0)
            : '0';

        // Actualizar estadísticas
        const predictedEl = document.getElementById('dashboard-predicted-matches');
        if (predictedEl) predictedEl.textContent = predictedCount;

        const avgEl = document.getElementById('dashboard-avg-points');
        if (avgEl) avgEl.textContent = avgPoints;

        const avgJornadaEl = document.getElementById('dashboard-avg-jornada');
        if (avgJornadaEl) avgJornadaEl.textContent = avgJornada;

        // Crear gráfico simple de barras
        const chartEl = document.getElementById('dashboard-jornada-chart');
        if (chartEl && jornadas.length > 0) {
            const maxPoints = Math.max(...Object.values(pointsByJornada));
            const sortedJornadas = jornadas.sort((a, b) => parseInt(a) - parseInt(b)).slice(-5); // Últimas 5 jornadas
            
            chartEl.innerHTML = `
                <div class="chart-container">
                    ${sortedJornadas.map(j => {
                        const points = pointsByJornada[j] || 0;
                        const height = maxPoints > 0 ? (points / maxPoints * 100) : 0;
                        return `
                            <div class="chart-bar-wrapper">
                                <div class="chart-bar" style="height: ${height}%">
                                    <span class="chart-value">${points}</span>
                                </div>
                                <span class="chart-label">J${j}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (chartEl) {
            chartEl.innerHTML = '<p class="no-data">Aún no hay datos para mostrar</p>';
        }

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

async function loadDashboardJornada() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener jornada activa
        const { data: configData } = await executeQueryWithTimeout(() =>
            supabase
                .from('config')
                .select('value')
                .eq('key', 'active_jornada')
                .single()
        , 5000).catch(() => ({ data: { value: 1 } }));

        const activeJornada = configData?.value || 1;

        // Obtener partidos de la jornada activa (incluyendo resultados)
        const { data: matches, error: matchesError } = await executeQueryWithTimeout(() =>
            supabase
                .from('matches')
                .select('id, home_team, away_team, match_date, jornada, home_score, away_score')
                .eq('jornada', activeJornada)
                .order('match_date', { ascending: true })
                .limit(4)
        , 8000).catch(() => ({ data: [], error: null }));

        // Contar total de partidos
        const totalMatches = matches?.length || 0;

        // Actualizar estado de jornada (solo mostrar cantidad de partidos)
        const statusEl = document.getElementById('dashboard-jornada-status');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="jornada-progress">
                    <div class="progress-info">
                        <span><strong>${totalMatches}</strong> partido${totalMatches !== 1 ? 's' : ''} en esta jornada</span>
                    </div>
                </div>
            `;
        }

        // Mostrar partidos de la jornada con resultados (sin pronósticos)
        const matchesEl = document.getElementById('dashboard-next-matches');
        if (matchesEl && matches && matches.length > 0) {
            matchesEl.innerHTML = matches.slice(0, 4).map(match => {
                const matchDate = new Date(match.match_date);
                const dateStr = matchDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const timeStr = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                
                // Verificar si el partido tiene resultado
                const hasResult = match.home_score !== null && match.away_score !== null;
                const isFinished = hasResult;
                
                return `
                    <div class="next-match-item ${isFinished ? 'finished' : ''}">
                        <div class="match-teams">
                            <span class="team-name">${match.home_team}</span>
                            ${hasResult ? 
                                `<span class="match-result"><strong>${match.home_score} - ${match.away_score}</strong></span>` :
                                `<span class="vs">vs</span>`
                            }
                            <span class="team-name">${match.away_team}</span>
                        </div>
                        <div class="match-info">
                            <span class="match-date">${dateStr} ${timeStr}</span>
                            ${hasResult ? 
                                `<span class="result-badge finished"><i class="fas fa-check-circle"></i> Finalizado</span>` :
                                '<span class="pending-badge"><i class="fas fa-clock"></i> Pendiente</span>'
                            }
                        </div>
                    </div>
                `;
            }).join('');
        } else if (matchesEl) {
            matchesEl.innerHTML = '<p class="no-data">No hay partidos en esta jornada</p>';
        }

    } catch (error) {
        console.error('Error cargando jornada:', error);
    }
}

async function loadDashboardTopLigas() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener ligas del usuario
        const { data: userLigas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('liga_id, ligas(id, name)')
                .eq('user_id', currentUser.id)
        , 8000).catch(() => ({ data: [], error: null }));

        if (!userLigas || userLigas.length === 0) {
            const ligasEl = document.getElementById('dashboard-top-ligas');
            if (ligasEl) {
                ligasEl.innerHTML = '<p class="no-data">No estás en ninguna liga</p>';
            }
            return;
        }

        // Obtener posición y puntos en cada liga
        const ligasData = await Promise.all(
            userLigas.slice(0, 3).map(async (item) => {
                if (!item.ligas) return null;

                const { data: members } = await executeQueryWithTimeout(() =>
                    supabase
                        .from('liga_members')
                        .select('user_id, users(id, name, total_points)')
                        .eq('liga_id', item.ligas.id)
                , 5000).catch(() => ({ data: [] }));

                const sortedMembers = (members || [])
                    .map(m => ({ id: m.user_id, points: m.users?.total_points || 0 }))
                    .sort((a, b) => b.points - a.points);

                const userPosition = sortedMembers.findIndex(m => m.id === currentUser.id) + 1;
                const userMember = sortedMembers.find(m => m.id === currentUser.id);
                const userPoints = userMember?.points || 0;
                const totalMembers = sortedMembers.length;

                return {
                    id: item.ligas.id,
                    name: item.ligas.name,
                    position: userPosition,
                    points: userPoints,
                    members: totalMembers
                };
            })
        );

        const validLigas = ligasData.filter(l => l !== null);

        const ligasEl = document.getElementById('dashboard-top-ligas');
        if (ligasEl) {
            if (validLigas.length === 0) {
                ligasEl.innerHTML = '<p class="no-data">No hay datos disponibles</p>';
            } else {
                ligasEl.innerHTML = validLigas.map(liga => `
                    <div class="liga-item" onclick="goToClasificaciones('${liga.id}')">
                        <div class="liga-item-header">
                            <h4>${liga.name}</h4>
                            <span class="liga-position-badge ${liga.position === 1 ? 'gold' : liga.position === 2 ? 'silver' : liga.position === 3 ? 'bronze' : ''}">
                                #${liga.position}
                            </span>
                        </div>
                        <div class="liga-item-stats">
                            <div class="liga-stat-small">
                                <i class="fas fa-trophy"></i>
                                <span>${liga.points} pts</span>
                            </div>
                            <div class="liga-stat-small">
                                <i class="fas fa-users"></i>
                                <span>${liga.members} miembros</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

    } catch (error) {
        console.error('Error cargando top ligas:', error);
    }
}

async function loadDashboardActivity() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener últimas predicciones
        const { data: recentPredictions, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('predictions')
                .select('home_prediction, away_prediction, points, matches(home_team, away_team, jornada, match_date, home_score, away_score)')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(5)
        , 8000).catch(() => ({ data: [], error: null }));

        const activityEl = document.getElementById('dashboard-recent-activity');
        if (activityEl) {
            if (!recentPredictions || recentPredictions.length === 0) {
                activityEl.innerHTML = '<p class="no-data">Aún no has hecho pronósticos</p>';
            } else {
                activityEl.innerHTML = recentPredictions.map(pred => {
                    const match = pred.matches;
                    if (!match) return '';

                    const hasResult = match.home_score !== null && match.away_score !== null;
                    const date = new Date(match.match_date);
                    const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

                    return `
                        <div class="activity-item ${hasResult ? 'has-result' : ''}">
                            <div class="activity-match">
                                <div class="activity-teams">
                                    <span>${match.home_team}</span>
                                    <span class="activity-score">${pred.home_prediction} - ${pred.away_prediction}</span>
                                    <span>${match.away_team}</span>
                                </div>
                                <div class="activity-info">
                                    <span class="activity-jornada">J${match.jornada}</span>
                                    <span class="activity-date">${dateStr}</span>
                                    ${hasResult ? 
                                        `<span class="activity-result">
                                            Resultado: ${match.home_score}-${match.away_score}
                                            ${pred.points ? `<span class="activity-points">+${pred.points} pts</span>` : ''}
                                        </span>` :
                                        '<span class="activity-status">Pendiente</span>'
                                    }
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (error) {
        console.error('Error cargando actividad:', error);
    }
}

// Funciones de navegación rápida
function goToPronosticos() {
    document.querySelector('.nav-link[data-page="pronosticos"]')?.click();
}

function goToLigas() {
    document.querySelector('.nav-link[data-page="ligas"]')?.click();
}

function goToClasificaciones(ligaId = null) {
    const link = document.querySelector('.nav-link[data-page="clasificaciones"]');
    if (link) {
        link.click();
        // Si se proporciona ligaId, seleccionarla después de un breve delay
        if (ligaId) {
            setTimeout(() => {
                const select = document.getElementById('liga-select');
                if (select) {
                    select.value = ligaId;
                    if (typeof window !== 'undefined' && window.loadLigaClassification) {
                        window.loadLigaClassification();
                    }
                }
            }, 300);
        }
    }
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
    window.goToPronosticos = goToPronosticos;
    window.goToLigas = goToLigas;
    window.goToClasificaciones = goToClasificaciones;
}

async function loadDashboardLigaCards() {
    const container = document.getElementById('dashboard-ligas-grid');
    if (!container) {
        console.error('❌ No se encontró dashboard-ligas-grid');
        return;
    }

    if (!currentUser) {
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Debes iniciar sesión</p>';
        return;
    }

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error de conexión</h3>
                <p>No se pudo conectar con la base de datos. Por favor, recarga la página.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        // Añadir timeout a la consulta
        const queryPromise = supabase
            .from('liga_members')
            .select('liga_id, ligas(id, name)')
            .eq('user_id', currentUser.id);
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: La consulta tardó más de 10 segundos')), 10000)
        );
        
        let userLigas, error;
        try {
            const result = await Promise.race([queryPromise, timeoutPromise]);
            userLigas = result.data;
            error = result.error;
        } catch (timeoutError) {
            throw timeoutError;
        }

        if (error) throw error;

        let cardsHTML = '';

        // Tarjetas de cada liga (sin mostrar Total Global)
        if (userLigas && userLigas.length > 0) {
            for (const item of userLigas) {
                if (!item.ligas) continue;

                const ligaId = item.ligas.id;
                const ligaName = item.ligas.name;

                // Obtener miembros de la liga
                const { data: members } = await supabase
                    .from('liga_members')
                    .select('user_id, users(id, name, total_points)')
                    .eq('liga_id', ligaId);

                if (!members) continue;

                // Calcular posición del usuario en la liga
                const sortedMembers = members
                    .map(m => ({
                        id: m.users?.id,
                        points: m.users?.total_points || 0
                    }))
                    .sort((a, b) => b.points - a.points);

                const userPosition = sortedMembers.findIndex(m => m.id === currentUser.id) + 1 || '-';
                const membersCount = sortedMembers.length;
                // Obtener puntos del usuario actual en esta liga
                const currentUserMember = sortedMembers.find(m => m.id === currentUser.id);
                const userPointsInLiga = currentUserMember?.points || 0;

                cardsHTML += `
                    <div class="liga-card-dashboard" onclick="showDashboardLigaDetail('${ligaId}', '${ligaName}')">
                        <div class="liga-card-header-dashboard">
                            <div class="liga-card-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <h3>${ligaName}</h3>
                        </div>
                        <div class="liga-card-stats">
                            <div class="liga-stat">
                                <span class="liga-stat-label">Puntos</span>
                                <span class="liga-stat-value">${userPointsInLiga}</span>
                            </div>
                            <div class="liga-stat">
                                <span class="liga-stat-label">Posición</span>
                                <span class="liga-stat-value">${userPosition}</span>
                            </div>
                            <div class="liga-stat">
                                <span class="liga-stat-label">Miembros</span>
                                <span class="liga-stat-value">${membersCount}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = cardsHTML;

    } catch (error) {
        console.error('Error cargando tarjetas de ligas:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Error al cargar las ligas</p>';
    }
}

async function showDashboardLigaDetail(ligaId, ligaName) {
    const detailContainer = document.getElementById('dashboard-liga-detail');
    const detailContent = document.getElementById('dashboard-detail-content');
    const detailTitle = document.getElementById('dashboard-detail-title');
    const gridContainer = document.getElementById('dashboard-ligas-grid');

    if (!detailContainer || !detailContent || !detailTitle) {
        console.error('❌ Elementos del detalle de liga no encontrados');
        return;
    }

    // Ocultar grid de tarjetas
    if (gridContainer) {
        gridContainer.style.display = 'none';
    }
    
    // Mostrar vista de detalle
    detailContainer.style.display = 'block';
    detailTitle.textContent = ligaName;
    detailContent.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        let users = [];

        if (ligaId === 'all') {
            // Clasificación global
            const { data: allUsers, error } = await supabase
                .from('users')
                .select('id, name, total_points')
                .order('total_points', { ascending: false });

            if (error) {
                console.error('❌ Error obteniendo usuarios globales:', error);
                throw error;
            }
            users = allUsers || [];
        } else {
            // Clasificación de la liga específica
            const { data: members, error: membersError } = await supabase
                .from('liga_members')
                .select('user_id, users(id, name, total_points)')
                .eq('liga_id', ligaId);

            if (membersError) {
                console.error('❌ Error obteniendo miembros de liga:', membersError);
                throw membersError;
            }

            if (members) {
                users = members
                    .map(m => ({
                        id: m.users?.id,
                        name: m.users?.name || 'Usuario',
                        total_points: m.users?.total_points || 0
                    }))
                    .sort((a, b) => b.total_points - a.total_points);
            }
        }

        if (users.length === 0) {
            detailContent.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Sin clasificación</p>';
            return;
        }

        // Generar tabla de clasificación
        const classificationHTML = `
            <div class="dashboard-classification-table">
                <div class="classification-header">
                    <span class="pos-col">#</span>
                    <span class="player-col">Jugador</span>
                    <span class="points-col">Puntos</span>
                </div>
                ${users.map((user, index) => `
                    <div class="classification-row ${user.id === currentUser.id ? 'current-user' : ''}">
                        <span class="pos-col ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</span>
                        <div class="player-col">
                            <div class="player-avatar">${getInitials(user.name)}</div>
                            <span class="player-name">${user.name}</span>
                        </div>
                        <span class="points-col">${user.total_points || 0}</span>
                    </div>
                `).join('')}
            </div>
        `;

        detailContent.innerHTML = classificationHTML;

    } catch (error) {
        console.error('❌ Error cargando detalle de liga:', error);
        const errorMessage = error.message || 'Error desconocido';
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                    <p>No se pudo cargar la clasificación: ${errorMessage}</p>
                    <button class="btn btn-primary btn-small" onclick="showDashboardLigaDetail('${ligaId}', '${ligaName}')" style="margin-top: 12px;">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

function closeDashboardDetail() {
    const detailEl = document.getElementById('dashboard-liga-detail');
    const gridEl = document.getElementById('dashboard-ligas-grid');
    
    if (detailEl) {
        detailEl.style.display = 'none';
    }
    
    if (gridEl) {
        gridEl.style.display = 'grid';
    }
}

async function loadDashboardLigaSelector() {
    const selector = document.getElementById('dashboard-liga-select');
    if (!selector) return;

    try {
        const { data: userLigas, error } = await supabase
            .from('liga_members')
            .select('liga_id, ligas(id, name)')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Mantener la opción "all" y limpiar el resto
        selector.innerHTML = '<option value="all">Todas las ligas (Global)</option>';

        if (userLigas && userLigas.length > 0) {
            userLigas.forEach(item => {
                if (item.ligas) {
                    const option = document.createElement('option');
                    option.value = item.ligas.id;
                    option.textContent = item.ligas.name;
                    selector.appendChild(option);
                }
            });
        }

        // Restaurar selección anterior si existe
        if (selectedDashboardLiga !== 'all') {
            selector.value = selectedDashboardLiga;
        }
    } catch (error) {
        console.error('Error cargando ligas para selector:', error);
    }
}

async function loadDashboardStats(ligaId = 'all') {
    try {
        // Obtener datos del usuario
        const { data: userData } = await supabase
            .from('users')
            .select('total_points')
            .eq('id', currentUser.id)
            .maybeSingle();

        const totalPoints = userData?.total_points || 0;
        document.getElementById('dashboard-total-points').textContent = totalPoints;

        let position = '-';
        let ligaName = '';
        let membersCount = 0;

        if (ligaId === 'all') {
            // Datos globales
            const { data: allUsers } = await supabase
                .from('users')
                .select('id, total_points')
                .order('total_points', { ascending: false });

            if (allUsers) {
                position = allUsers.findIndex(u => u.id === currentUser.id) + 1 || '-';
            }

            // Contar todas las ligas del usuario
            const { data: ligas } = await supabase
                .from('liga_members')
                .select('id')
                .eq('user_id', currentUser.id);
            
            membersCount = ligas?.length || 0;
            ligaName = '';
        } else {
            // Datos de la liga específica
            const { data: ligaData } = await supabase
                .from('ligas')
                .select('name')
                .eq('id', ligaId)
                .single();

            if (ligaData) {
                ligaName = ligaData.name;
            }

            // Obtener miembros de la liga con sus puntos
            const { data: members, error: membersError } = await supabase
                .from('liga_members')
                .select('user_id, users(id, total_points)')
                .eq('liga_id', ligaId);

            if (!membersError && members) {
                // Ordenar por puntos
                const sortedMembers = members
                    .map(m => ({
                        id: m.users?.id,
                        points: m.users?.total_points || 0
                    }))
                    .sort((a, b) => b.points - a.points);

                position = sortedMembers.findIndex(m => m.id === currentUser.id) + 1 || '-';
                membersCount = sortedMembers.length;
            }
        }

        document.getElementById('dashboard-position').textContent = position;
        const ligaNameSpan = document.getElementById('dashboard-liga-name');
        if (ligaNameSpan) {
            ligaNameSpan.textContent = ligaId === 'all' ? '' : `en ${ligaName}`;
        }
        document.getElementById('dashboard-leagues-count').textContent = membersCount;

        // Progreso de pronósticos (siempre global)
        await loadProgress();
        const progressText = document.querySelector('.nav-progress')?.textContent || '0%';
        document.getElementById('dashboard-progress').textContent = progressText;

        // Jornada actual
        document.getElementById('dashboard-jornada-num').textContent = currentJornada || 1;

    } catch (error) {
        console.error('Error cargando estadísticas del dashboard:', error);
    }
}

async function loadDashboardMatches() {
    const container = document.getElementById('dashboard-matches-preview');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const { data: matches, error } = await supabase
            .from('matches')
            .select('*')
            .eq('jornada', currentJornada)
            .order('match_date', { ascending: true })
            .limit(5);

        if (error) throw error;

        if (!matches || matches.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">No hay partidos próximos</p>';
            return;
        }

        // Cargar predicciones del usuario
        await loadUserPredictions();

        const formatDate = (date) => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        container.innerHTML = matches.map(match => {
            const prediction = userPredictions[match.id] || {};
            const matchDate = new Date(match.match_date);
            const now = new Date();
            const isLocked = matchDate < now;
            const isFinished = match.home_score !== null && match.away_score !== null;

            return `
                <div class="match-preview-item ${isLocked ? 'locked' : ''}">
                    <div class="match-preview-date">${formatDate(match.match_date)}</div>
                    <div class="match-preview-teams">
                        <span class="team-home">${match.home_team}</span>
                        <span class="match-preview-score">
                            ${prediction.home_prediction !== undefined && prediction.home_prediction !== null ? prediction.home_prediction : '-'}
                            -
                            ${prediction.away_prediction !== undefined && prediction.away_prediction !== null ? prediction.away_prediction : '-'}
                        </span>
                        <span class="team-away">${match.away_team}</span>
                    </div>
                    ${isFinished ? `<div class="match-preview-result">Resultado: ${match.home_score} - ${match.away_score}</div>` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando partidos del dashboard:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Error al cargar partidos</p>';
    }
}

async function loadDashboardTop5(ligaId = 'all') {
    const container = document.getElementById('dashboard-top5');
    const titleSpan = document.getElementById('dashboard-top5-title');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        let users = [];
        let ligaName = '';

        if (ligaId === 'all') {
            // Top 5 global
            const { data: allUsers, error } = await supabase
                .from('users')
                .select('id, name, total_points')
                .order('total_points', { ascending: false })
                .limit(5);

            if (error) throw error;
            users = allUsers || [];
        } else {
            // Obtener nombre de la liga
            const { data: ligaData } = await supabase
                .from('ligas')
                .select('name')
                .eq('id', ligaId)
                .single();

            if (ligaData) {
                ligaName = ligaData.name;
            }

            // Top 5 de la liga específica
            const { data: members, error: membersError } = await supabase
                .from('liga_members')
                .select('user_id, users(id, name, total_points)')
                .eq('liga_id', ligaId);

            if (membersError) throw membersError;

            if (members) {
                // Ordenar por puntos y tomar top 5
                users = members
                    .map(m => ({
                        id: m.users?.id,
                        name: m.users?.name || 'Usuario',
                        total_points: m.users?.total_points || 0
                    }))
                    .sort((a, b) => b.total_points - a.total_points)
                    .slice(0, 5);
            }
        }

        // Actualizar título
        if (titleSpan) {
            titleSpan.textContent = ligaId === 'all' ? '' : `- ${ligaName}`;
        }

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Sin clasificación</p>';
            return;
        }

        container.innerHTML = users.map((user, index) => `
            <div class="top5-item ${user.id === currentUser.id ? 'current-user' : ''}">
                <span class="top5-position ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</span>
                <span class="top5-name">${user.name}</span>
                <span class="top5-points">${user.total_points || 0} pts</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando top 5:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Error al cargar clasificación</p>';
    }
}

function setupQuickActions() {
    document.querySelectorAll('.quick-action-card[data-page]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const page = card.dataset.page;
            
            // Actualizar navegación
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
            if (navLink) navLink.classList.add('active');
            
            // Mostrar sección
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${page}-section`).classList.add('active');
            
            // Cargar datos
            if (page === 'pronosticos') {
                loadMatches();
            } else if (page === 'clasificaciones') {
                loadLigasForSelect();
            } else if (page === 'ligas') {
                loadUserLigas();
            }
        });
    });

    document.querySelectorAll('.view-all-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            // Actualizar navegación
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
            if (navLink) navLink.classList.add('active');
            
            // Mostrar sección
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${page}-section`).classList.add('active');
            
            // Cargar datos
            if (page === 'pronosticos') {
                loadMatches();
            } else if (page === 'clasificaciones') {
                loadLigasForSelect();
            }
        });
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            // Actualizar links activos
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Mostrar sección correspondiente
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${page}-section`).classList.add('active');
            
            // Cargar datos según la sección
            if (page === 'dashboard') {
                loadDashboard();
            } else if (page === 'pronosticos') {
                loadPronosticosLigaSelector();
                // loadMatches se llamará cuando se seleccione una liga
            } else if (page === 'clasificaciones') {
                loadLigasForSelect();
            } else if (page === 'ligas') {
                loadUserLigas();
            } else if (page === 'reglas') {
                // No requiere carga de datos, solo mostrar contenido estático
            } else if (page === 'noticias') {
                // Cargar noticias si es necesario en el futuro
            } else if (page === 'estadisticas') {
                // Cargar estadísticas si es necesario en el futuro
            } else if (page === 'admin') {
                loadAdminData();
            }
        });
    });
}

// ========================================
// JORNADAS
// ========================================
async function loadActiveJornada() {
    try {
        const { data, error } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'active_jornada')
            .single();

        if (data && data.value) {
            activeJornada = parseInt(data.value) || 1;
            currentJornada = activeJornada;
        } else {
            // Valor por defecto si no existe en config
            activeJornada = 1;
            currentJornada = 1;
            console.warn('⚠️ No se encontró jornada activa en config, usando 1');
        }
        
        updateJornadaDisplay();
    } catch (error) {
        console.warn('⚠️ Error cargando jornada activa, usando valor por defecto:', error);
        // Valores por defecto si falla
        activeJornada = 1;
        currentJornada = 1;
        updateJornadaDisplay();
    }
}

function updateJornadaDisplay() {
    const jornadaEl = document.getElementById('current-jornada');
    if (jornadaEl) {
        jornadaEl.textContent = `Jornada ${currentJornada || 1}`;
    }
}

function changeJornada(delta) {
    const newJornada = currentJornada + delta;
    if (newJornada >= 1 && newJornada <= CONFIG_TEMPORADA.TOTAL_JORNADAS) {
        currentJornada = newJornada;
        updateJornadaDisplay();
        loadMatches();
    }
}

// ========================================
// PRONÓSTICOS POR LIGA
// ========================================
async function loadPronosticosLigaSelector() {
    const selector = document.getElementById('pronosticos-liga-select');
    const container = document.getElementById('matches-container');
    
    if (!selector) return;

    // Mostrar inmediatamente el mensaje de seleccionar liga si no hay liga seleccionada
    if (container && !selector.value) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Selecciona una liga</h3>
                <p>Por favor, selecciona una liga del menú desplegable para ver y hacer tus pronósticos.</p>
            </div>
        `;
    }

    if (!currentUser) {
        selector.innerHTML = '<option value="">Debes iniciar sesión</option>';
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Debes iniciar sesión</h3>
                    <p>Por favor, inicia sesión para ver tus pronósticos.</p>
                </div>
            `;
        }
        return;
    }

    try {
        const supabase = window.supabase || window.supabaseClient;
        if (!supabase || !supabase.from) {
            selector.innerHTML = '<option value="">Cargando...</option>';
            return;
        }

        const { data: userLigas, error } = await supabase
            .from('liga_members')
            .select('liga_id, ligas(id, name)')
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('Error cargando ligas:', error);
            selector.innerHTML = '<option value="">Error al cargar ligas</option>';
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error</h3>
                        <p>No se pudieron cargar las ligas. Por favor, intenta de nuevo.</p>
                    </div>
                `;
            }
            return;
        }

        selector.innerHTML = '<option value="">Selecciona una liga</option>';

        if (userLigas && userLigas.length > 0) {
            userLigas.forEach(item => {
                if (item.ligas) {
                    const option = document.createElement('option');
                    option.value = item.ligas.id;
                    option.textContent = item.ligas.name;
                    selector.appendChild(option);
                }
            });

            // Si hay una liga seleccionada previamente, restaurarla y cargar partidos
            if (selectedPronosticosLiga) {
                selector.value = selectedPronosticosLiga;
                loadMatches();
            } else {
                // Asegurar que se muestre el mensaje de seleccionar liga
                if (container && !selector.value) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>Selecciona una liga</h3>
                            <p>Por favor, selecciona una liga del menú desplegable para ver y hacer tus pronósticos.</p>
                            <p style="margin-top: 16px;">
                                <button class="btn btn-primary" onclick="showJoinLigaModal()">
                                    <i class="fas fa-sign-in-alt"></i> Unirse a una Liga
                                </button>
                            </p>
                        </div>
                    `;
                }
            }
        } else {
            selector.innerHTML = '<option value="">No estás en ninguna liga</option>';
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No estás en ninguna liga</h3>
                        <p>Únete a una liga primero para poder hacer pronósticos.</p>
                        <p style="margin-top: 16px;">
                            <button class="btn btn-primary" onclick="showJoinLigaModal()">
                                <i class="fas fa-sign-in-alt"></i> Unirse a una Liga
                            </button>
                        </p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error en loadPronosticosLigaSelector:', error);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                    <p>Ocurrió un error al cargar las ligas. Por favor, recarga la página.</p>
                </div>
            `;
        }
    }
}

// ========================================
// PARTIDOS Y PRONÓSTICOS
// ========================================
async function loadMatches() {
    console.log('⚽ Cargando partidos de jornada:', currentJornada);
    
    const container = document.getElementById('matches-container');
    if (!container) {
        console.error('❌ No se encontró el contenedor matches-container');
        return;
    }

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error de conexión</h3>
                <p>No se pudo conectar con la base de datos. Por favor, recarga la página.</p>
                <button class="btn btn-primary btn-small" onclick="location.reload()" style="margin-top: 12px;">
                    <i class="fas fa-redo"></i> Recargar
                </button>
            </div>
        `;
        console.error('❌ Supabase no está disponible');
        return;
    }

    // Obtener liga seleccionada
    const ligaSelect = document.getElementById('pronosticos-liga-select');
    if (!ligaSelect) {
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Error: selector de liga no encontrado</p>';
        return;
    }

    const ligaId = ligaSelect.value;
    if (!ligaId) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Selecciona una liga</h3>
                <p>Por favor, selecciona una liga del menú desplegable para ver y hacer tus pronósticos.</p>
            </div>
        `;
        return;
    }

    selectedPronosticosLiga = ligaId;

    // Verificar que currentJornada esté inicializado
    if (!currentJornada || currentJornada < 1) {
        console.warn('⚠️ currentJornada no inicializado, usando 1');
        currentJornada = 1;
    }

    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando partidos...</p>
        </div>
    `;

    try {
        // Ejecutar consulta con timeout usando la función auxiliar
        const result = await executeQueryWithTimeout(() => 
            supabase
                .from('matches')
                .select('*')
                .eq('jornada', currentJornada)
                .order('match_date', { ascending: true })
        , 10000);
        
        const matches = result.data;
        const error = result.error;

        console.log('📦 Resultado consulta matches:', { matches, error, count: matches?.length });

        if (error) throw error;

        if (!matches || matches.length === 0) {
            console.log('⚠️ No hay partidos para jornada', currentJornada);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No hay partidos</h3>
                    <p>No hay partidos programados para la Jornada ${currentJornada}.</p>
                </div>
            `;
            return;
        }

        // Cargar predicciones del usuario para esta liga ANTES de renderizar
        try {
            await loadUserPredictions(ligaId);
            console.log('✅ Predicciones cargadas antes de renderizar:', Object.keys(userPredictions).length);
        } catch (predError) {
            console.warn('⚠️ Error cargando predicciones, continuando sin ellas:', predError);
            userPredictions = {}; // Asegurar que esté inicializado
        }

        console.log('🎯 Renderizando', matches.length, 'partidos con predicciones:', Object.keys(userPredictions).length);
        
        // Header de la tabla
        const tableHeader = `
            <div class="matches-table-header">
                <span class="col-jornada">J</span>
                <span class="col-fecha">Fecha</span>
                <span class="col-hora">Hora</span>
                <span class="col-local">Equipo Local</span>
                <span class="col-goles">Goles</span>
                <span class="col-goles">Goles</span>
                <span class="col-visitante">Equipo Visitante</span>
                <span class="col-resultado">Resultado</span>
            </div>
        `;
        
        container.innerHTML = tableHeader + matches.map(match => createMatchCard(match)).join('');
        console.log('✅ Partidos renderizados');
        
        // Verificar que las predicciones se aplicaron correctamente
        let appliedCount = 0;
        matches.forEach(match => {
            const homeSelect = document.getElementById(`home-${match.id}`);
            const awaySelect = document.getElementById(`away-${match.id}`);
            const prediction = userPredictions[match.id];
            if (prediction && homeSelect && awaySelect) {
                if (homeSelect.value == prediction.home_prediction && awaySelect.value == prediction.away_prediction) {
                    appliedCount++;
                } else {
                    console.warn(`⚠️ Predicción no aplicada para partido ${match.id}:`, {
                        saved: `${prediction.home_prediction}-${prediction.away_prediction}`,
                        shown: `${homeSelect.value}-${awaySelect.value}`
                    });
                }
            }
        });
        console.log(`✅ Predicciones aplicadas correctamente: ${appliedCount}/${Object.keys(userPredictions).length}`);
        
        // Iniciar actualizaciones en vivo (si la función está disponible)
        if (typeof window !== 'undefined' && window.startLiveUpdates) {
            window.startLiveUpdates();
        }
    } catch (error) {
        console.error('❌ Error cargando partidos:', error);
        const errorMessage = error.message || 'Error desconocido';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>No se pudieron cargar los partidos: ${errorMessage}</p>
                <button class="btn btn-primary btn-small" onclick="loadMatches()" style="margin-top: 12px;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

async function loadUserPredictions(ligaId = null) {
    if (!currentUser) {
        console.log('⚠️ No hay usuario para cargar predicciones');
        return;
    }

    if (!ligaId) {
        console.warn('⚠️ No se proporcionó liga_id, no se cargarán predicciones');
        userPredictions = {};
        return;
    }

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        console.error('❌ Supabase no está disponible para cargar predicciones');
        userPredictions = {};
        return;
    }

    // Convertir ligaId a número si es string
    const ligaIdNum = typeof ligaId === 'string' ? parseInt(ligaId) : ligaId;
    
    console.log('📥 Cargando predicciones para usuario:', currentUser.id, 'liga:', ligaIdNum, '(tipo:', typeof ligaIdNum, ')');

    try {
        // Ejecutar consulta con timeout
        let result;
        try {
            result = await executeQueryWithTimeout(() => 
                supabase
                    .from('predictions')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .eq('liga_id', ligaIdNum)
            , 8000);
        } catch (queryError) {
            // Si el error es que la columna liga_id no existe, intentar sin filtrar
            if (queryError.message && (queryError.message.includes('liga_id') || queryError.message.includes('column'))) {
                console.warn('⚠️ Problema con columna liga_id, cargando todas las predicciones y filtrando en memoria');
                result = await executeQueryWithTimeout(() => 
                    supabase
                        .from('predictions')
                        .select('*')
                        .eq('user_id', currentUser.id)
                , 8000);
                
                // Filtrar en memoria si es necesario
                if (result.data) {
                    result.data = result.data.filter(pred => {
                        // Si la predicción tiene liga_id, comparar; si no, incluir todas (compatibilidad)
                        if (pred.liga_id !== undefined && pred.liga_id !== null) {
                            return parseInt(pred.liga_id) === ligaIdNum;
                        }
                        // Si no tiene liga_id, incluirla (predicciones antiguas sin liga_id)
                        return true;
                    });
                }
            } else {
                throw queryError;
            }
        }
        
        const data = result.data;
        const error = result.error;

        console.log('📦 Predicciones desde Supabase:', data);

        if (error) throw error;

        // Convertir a objeto para fácil acceso
        userPredictions = {};
        if (data && data.length > 0) {
            data.forEach(pred => {
                // Asegurar que los valores de predicción sean números
                userPredictions[pred.match_id] = {
                    ...pred,
                    home_prediction: pred.home_prediction !== null && pred.home_prediction !== undefined ? parseInt(pred.home_prediction) : null,
                    away_prediction: pred.away_prediction !== null && pred.away_prediction !== undefined ? parseInt(pred.away_prediction) : null
                };
                console.log(`  Partido ${pred.match_id}: ${userPredictions[pred.match_id].home_prediction} - ${userPredictions[pred.match_id].away_prediction} (liga: ${pred.liga_id || 'N/A'})`);
            });
        } else {
            console.log('  (Sin predicciones guardadas para esta liga)');
        }
        
        console.log('✅ Total predicciones cargadas:', Object.keys(userPredictions).length);
    } catch (error) {
        console.error('❌ Error cargando predicciones:', error);
        userPredictions = {};
    }
}

function createMatchCard(match) {
    const prediction = userPredictions[match.id] || {};
    const matchDate = new Date(match.match_date);
    const now = new Date();
    const isLocked = matchDate < now;
    const isFinished = match.home_score !== null && match.away_score !== null;

    let pointsEarned = null;
    if (isFinished && prediction.home_prediction !== null && prediction.away_prediction !== null) {
        pointsEarned = calculatePoints(
            prediction.home_prediction,
            prediction.away_prediction,
            match.home_score,
            match.away_score
        );
    }

    // Generar opciones del desplegable: "-" por defecto, luego 0-9
    const generateScoreOptions = (selectedValue) => {
        // Verificar si hay un valor válido guardado (incluido el 0)
        const hasValue = typeof selectedValue === 'number';
        
        // Opción vacía "-" como primera opción
        let options = `<option value="" ${!hasValue ? 'selected' : ''}>-</option>`;
        
        // Opciones 0-9
        for (let i = 0; i <= 9; i++) {
            const isSelected = hasValue && selectedValue === i;
            options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${i}</option>`;
        }
        return options;
    };

    // Formato de fecha: DD/MM
    const formatDate = (date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${d}/${m}`;
    };
    
    // Formato de hora: HH:MM
    const formatTime = (date) => {
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${min}`;
    };

    return `
        <div class="match-row ${isLocked ? 'locked' : ''} ${isFinished ? 'finished' : ''}" data-match-id="${match.id}" ${match.fixture_id || match.api_football_id ? `data-fixture-id="${match.fixture_id || match.api_football_id}"` : ''}>
            <span class="col-jornada">${match.jornada}</span>
            <span class="col-fecha">${formatDate(matchDate)}</span>
            <span class="col-hora">${formatTime(matchDate)}</span>
            <span class="col-local">${match.home_team}</span>
            <span class="col-goles">
                <select class="goal-select ${prediction.home_prediction !== undefined && prediction.home_prediction !== null ? 'has-value' : ''}" 
                        id="home-${match.id}" 
                        ${isLocked ? 'disabled' : ''} 
                        onchange="markPredictionChanged(${match.id})">
                    ${generateScoreOptions(prediction.home_prediction)}
                </select>
            </span>
            <span class="col-goles">
                <select class="goal-select ${prediction.away_prediction !== undefined && prediction.away_prediction !== null ? 'has-value' : ''}" 
                        id="away-${match.id}" 
                        ${isLocked ? 'disabled' : ''} 
                        onchange="markPredictionChanged(${match.id})">
                    ${generateScoreOptions(prediction.away_prediction)}
                </select>
            </span>
            <span class="col-visitante">${match.away_team}</span>
            <span class="col-resultado">
                ${isFinished ? `
                    <span class="result-final">${match.home_score} - ${match.away_score}</span>
                    ${pointsEarned !== null ? `<span class="result-points">${pointsEarned}pts</span>` : ''}
                ` : '-'}
            </span>
        </div>
    `;
}

function markPredictionChanged(matchId) {
    const row = document.querySelector(`[data-match-id="${matchId}"]`);
    if (row) {
        row.style.background = 'rgba(230, 126, 0, 0.08)';
    }
    // Actualizar clase has-value en el select
    const homeSelect = document.getElementById(`home-${matchId}`);
    const awaySelect = document.getElementById(`away-${matchId}`);
    if (homeSelect) homeSelect.classList.toggle('has-value', homeSelect.value !== '');
    if (awaySelect) awaySelect.classList.toggle('has-value', awaySelect.value !== '');
}

async function resetPredictions() {
    if (!confirm('¿Estás seguro de que quieres borrar todos los pronósticos de esta jornada? Se eliminarán de la base de datos.')) {
        return;
    }
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }
    
    try {
        // Obtener IDs de partidos de esta jornada
        const matchIds = Array.from(document.querySelectorAll('.match-row'))
            .map(row => parseInt(row.dataset.matchId));
        
        console.log('🗑️ Eliminando predicciones para partidos:', matchIds);
        
        // Eliminar predicciones de la base de datos
        const { error } = await supabase
            .from('predictions')
            .delete()
            .eq('user_id', currentUser.id)
            .in('match_id', matchIds);
        
        if (error) throw error;
        
        // Limpiar selectores en la interfaz
        const selects = document.querySelectorAll('.goal-select:not(:disabled)');
        selects.forEach(select => {
            select.value = '';
            select.classList.remove('has-value');
        });
        
        // Limpiar estilos de filas modificadas
        document.querySelectorAll('.match-row').forEach(row => {
            row.style.background = '';
        });
        
        // Actualizar predicciones locales
        matchIds.forEach(id => delete userPredictions[id]);
        
        // Actualizar progreso
        await loadProgress();
        
        showNotification('Pronósticos de esta jornada eliminados', 'success');
    } catch (error) {
        console.error('Error eliminando predicciones:', error);
        showNotification('Error al eliminar pronósticos', 'error');
    }
}

async function savePredictions() {
    console.log('💾 Guardando pronósticos...');
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }

    // Obtener liga seleccionada
    const ligaSelect = document.getElementById('pronosticos-liga-select');
    if (!ligaSelect || !ligaSelect.value) {
        showNotification('Debes seleccionar una liga primero', 'error');
        return;
    }

    const ligaId = parseInt(ligaSelect.value);
    console.log('💾 Guardando para liga:', ligaId);

    // Buscar filas de partidos (match-row es la clase actual)
    const matchRows = document.querySelectorAll('.match-row:not(.locked)');
    console.log('Filas encontradas:', matchRows.length);
    
    const predictions = [];

    matchRows.forEach(row => {
        const matchId = row.dataset.matchId;
        const homeSelect = document.getElementById(`home-${matchId}`);
        const awaySelect = document.getElementById(`away-${matchId}`);

        console.log(`Partido ${matchId}:`, homeSelect?.value, '-', awaySelect?.value);

        if (homeSelect && awaySelect && homeSelect.value !== '' && awaySelect.value !== '') {
            predictions.push({
                user_id: currentUser.id,
                match_id: parseInt(matchId),
                liga_id: ligaId,
                home_prediction: parseInt(homeSelect.value),
                away_prediction: parseInt(awaySelect.value)
            });
        }
    });

    console.log('Pronósticos a guardar:', predictions.length);

    if (predictions.length === 0) {
        showNotification('No hay pronósticos para guardar', 'warning');
        return;
    }

    try {
        console.log('📤 Enviando a Supabase:', predictions);
        
        // Upsert predictions (intentar con liga_id, si falla por columna no existente, intentar sin ella)
        let { data: savedData, error } = await supabase
            .from('predictions')
            .upsert(predictions, { 
                onConflict: 'user_id,match_id,liga_id',
                ignoreDuplicates: false 
            })
            .select();

        // Si falla porque la columna liga_id no existe, intentar sin ella (compatibilidad)
        if (error && error.message && error.message.includes('liga_id')) {
            console.warn('⚠️ Columna liga_id no existe, guardando sin ella (compatibilidad)');
            // Remover liga_id de las predicciones
            const predictionsWithoutLiga = predictions.map(p => {
                const { liga_id, ...rest } = p;
                return rest;
            });
            
            const retry = await supabase
                .from('predictions')
                .upsert(predictionsWithoutLiga, { 
                    onConflict: 'user_id,match_id',
                    ignoreDuplicates: false 
                })
                .select();
            
            savedData = retry.data;
            error = retry.error;
        }

        console.log('📦 Respuesta de Supabase:', { savedData, error });

        if (error) throw error;

        showNotification(`¡${predictions.length} pronósticos guardados!`, 'success');
        
        // Recargar predicciones con la liga correcta
        await loadUserPredictions(ligaId);
        
        // Recargar los partidos para mostrar los valores guardados
        await loadMatches();
        
        // Quitar indicador de cambios
        matchRows.forEach(row => {
            row.style.background = '';
        });
    } catch (error) {
        console.error('Error guardando predicciones:', error);
        showNotification('Error al guardar pronósticos', 'error');
    }
}

// ========================================
// CÁLCULO DE PUNTOS
// ========================================
function calculatePoints(predHome, predAway, realHome, realAway) {
    let points = 0;

    // 1X2 (48 puntos)
    const predResult = predHome > predAway ? '1' : (predHome < predAway ? '2' : 'X');
    const realResult = realHome > realAway ? '1' : (realHome < realAway ? '2' : 'X');
    if (predResult === realResult) {
        points += PUNTUACION.RESULTADO_1X2;
    }

    // Goles local exactos (15 puntos)
    if (predHome === realHome) {
        points += PUNTUACION.GOLES_LOCAL;
    }

    // Goles visitante exactos (15 puntos)
    if (predAway === realAway) {
        points += PUNTUACION.GOLES_VISITANTE;
    }

    // Diferencia de goles (12 puntos)
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;
    if (predDiff === realDiff) {
        points += PUNTUACION.DIFERENCIA_GOLES;
    }

    return points;
}

// ========================================
// PROGRESO
// ========================================
async function loadProgress() {
    if (!currentUser) return;

    const progressEl = document.getElementById('progress-percentage');
    if (!progressEl) {
        console.warn('⚠️ Elemento progress-percentage no encontrado');
        return;
    }

    try {
        // Verificar que activeJornada esté inicializado
        if (!activeJornada || activeJornada < 1) {
            console.warn('⚠️ activeJornada no inicializado, usando currentJornada');
            activeJornada = currentJornada || 1;
        }

        // Obtener total de partidos de la jornada activa
        const { data: matches, error: matchError } = await supabase
            .from('matches')
            .select('id')
            .eq('jornada', activeJornada);

        if (matchError) {
            console.warn('⚠️ Error obteniendo partidos para progreso:', matchError);
            progressEl.textContent = '0%';
            return;
        }

        const matchIds = matches?.map(m => m.id) || [];
        if (matchIds.length === 0) {
            progressEl.textContent = '0%';
            return;
        }

        // Obtener predicciones del usuario para esa jornada
        const { data: predictions, error: predError } = await supabase
            .from('predictions')
            .select('match_id')
            .eq('user_id', currentUser.id)
            .in('match_id', matchIds);

        if (predError) {
            console.warn('⚠️ Error obteniendo predicciones para progreso:', predError);
            progressEl.textContent = '0%';
            return;
        }

        const totalMatches = matchIds.length;
        const predictedMatches = predictions?.length || 0;
        const percentage = totalMatches > 0 ? Math.round((predictedMatches / totalMatches) * 100) : 0;

        progressEl.textContent = `${percentage}%`;
    } catch (error) {
        console.error('❌ Error calculando progreso:', error);
        if (progressEl) {
            progressEl.textContent = '0%';
        }
    }
}

// ========================================
// CLASIFICACIONES
// ========================================
function setupClassificationTabs() {
    // Esta función ya no es necesaria, pero la mantenemos para no romper referencias
    // La clasificación solo se muestra por liga ahora
}

// Función eliminada - ya no se muestra clasificación individual

async function loadLigasForSelect() {
    if (!currentUser) {
        const container = document.getElementById('liga-leaderboard');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Debes iniciar sesión</h3>
                    <p>Por favor, inicia sesión para ver las clasificaciones.</p>
                </div>
            `;
        }
        return;
    }

    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        return;
    }

    try {
        const { data: userLigas, error } = await supabase
            .from('liga_members')
            .select('liga_id, ligas(id, name)')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        const select = document.getElementById('liga-select');
        const selectorContainer = document.querySelector('.liga-selector');
        
        if (!select || !selectorContainer) return;

        // Si solo hay una liga, ocultar el selector y cargar automáticamente
        if (userLigas && userLigas.length === 1 && userLigas[0].ligas) {
            selectorContainer.style.display = 'none';
            select.value = userLigas[0].ligas.id;
            loadLigaClassification();
            return;
        }

        // Si hay más de una liga, mostrar el selector
        selectorContainer.style.display = 'block';
        select.innerHTML = '<option value="">Selecciona una liga</option>';
        
        if (userLigas && userLigas.length > 0) {
            userLigas.forEach(item => {
                if (item.ligas) {
                    select.innerHTML += `<option value="${item.ligas.id}">${item.ligas.name}</option>`;
                }
            });
        } else {
            const container = document.getElementById('liga-leaderboard');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No estás en ninguna liga</h3>
                        <p>Únete a una liga primero para ver las clasificaciones.</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error cargando ligas:', error);
        const container = document.getElementById('liga-leaderboard');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                    <p>No se pudieron cargar las ligas. Por favor, recarga la página.</p>
                </div>
            `;
        }
    }
}

async function loadLigaClassification() {
    const ligaId = document.getElementById('liga-select')?.value;
    const container = document.getElementById('liga-leaderboard');
    
    if (!container) {
        console.error('❌ Contenedor de clasificación no encontrado');
        return;
    }
    
    if (!ligaId) {
        container.innerHTML = '';
        return;
    }

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error de conexión</h3>
                <p>No se pudo conectar con la base de datos. Por favor, recarga la página.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        // Obtener miembros de la liga
        const membersResult = await executeQueryWithTimeout(() => 
            supabase
                .from('liga_members')
                .select('user_id, users(id, name, total_points)')
                .eq('liga_id', ligaId)
        , 10000);
        
        const data = membersResult.data;
        const error = membersResult.error;

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Sin miembros</h3>
                    <p>Esta liga no tiene miembros.</p>
                </div>
            `;
            return;
        }

        // Obtener predicciones con puntos agrupadas por jornada
        const predictionsResult = await executeQueryWithTimeout(() => 
            supabase
                .from('predictions')
                .select('user_id, points, matches(jornada)')
                .in('user_id', data.map(m => m.user_id))
                .not('points', 'is', null)
        , 10000);
        
        const predictions = predictionsResult.data || [];

        // Obtener jornadas con partidos que tienen resultados
        const matchesResult = await executeQueryWithTimeout(() => 
            supabase
                .from('matches')
                .select('jornada')
                .not('home_score', 'is', null)
        , 10000);
        
        const matches = matchesResult.data || [];
        const jornadasConResultados = [...new Set(matches.map(m => m.jornada))].sort((a, b) => a - b);

        // Calcular puntos por usuario y jornada
        const userPoints = {};
        data.forEach(member => {
            const userId = member.user_id;
            userPoints[userId] = {
                name: member.users?.name || 'Usuario',
                total: member.users?.total_points || 0,
                jornadas: {}
            };
            jornadasConResultados.forEach(j => {
                userPoints[userId].jornadas[j] = 0;
            });
        });

        // Sumar puntos por jornada
        predictions.forEach(pred => {
            if (userPoints[pred.user_id] && pred.matches?.jornada) {
                userPoints[pred.user_id].jornadas[pred.matches.jornada] += pred.points || 0;
            }
        });

        // Ordenar por total
        const sortedData = data.sort((a, b) => (b.users?.total_points || 0) - (a.users?.total_points || 0));

        // Generar header con jornadas
        const jornadaHeaders = jornadasConResultados.map(j => `<span class="jornada-col">J${j}</span>`).join('');

        container.innerHTML = `
            <div class="classification-table">
                <div class="classification-header">
                    <span class="pos-col">#</span>
                    <span class="player-col">Jugador</span>
                    <span class="total-col highlighted">Total</span>
                    ${jornadaHeaders}
                </div>
                ${sortedData.map((member, index) => {
                    const userId = member.user_id;
                    const userData = userPoints[userId];
                    const jornadaCells = jornadasConResultados.map(j => 
                        `<span class="jornada-col">${userData.jornadas[j] || 0}</span>`
                    ).join('');
                    
                    return `
                        <div class="classification-row ${currentUser && userId === currentUser.id ? 'current-user' : ''}">
                            <span class="pos-col ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</span>
                            <div class="player-col">
                                <div class="player-avatar">${getInitials(userData.name)}</div>
                                <span class="player-name">${userData.name}</span>
                            </div>
                            <span class="total-col highlighted">${userData.total}</span>
                            ${jornadaCells}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('❌ Error cargando clasificación de liga:', error);
        const errorMessage = error.message || 'Error desconocido';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>No se pudo cargar la clasificación: ${errorMessage}</p>
                <button class="btn btn-primary btn-small" onclick="loadLigaClassification()" style="margin-top: 12px;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ========================================
// LIGAS / PORRAS
// ========================================
function showCreateLigaModal() {
    console.log('📝 Abriendo modal crear liga...');
    closeModals();
    const modal = document.getElementById('create-liga-modal');
    console.log('Modal encontrado:', modal);
    if (modal) {
        modal.classList.add('active');
        console.log('✅ Modal activado');
    } else {
        console.error('❌ Modal create-liga-modal no encontrado');
    }
}

function showJoinLigaModal() {
    closeModals();
    document.getElementById('join-liga-modal').classList.add('active');
}

async function createLiga(event) {
    event.preventDefault();

    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }

    const name = document.getElementById('liga-name').value;
    const description = document.getElementById('liga-description').value;
    const code = generateLigaCode();

    try {
        // Crear liga
        const { data: liga, error: ligaError } = await supabase
            .from('ligas')
            .insert({
                name,
                description,
                code,
                created_by: currentUser.id
            })
            .select()
            .single();

        if (ligaError) throw ligaError;

        // Añadir creador como miembro automáticamente
        const { error: memberError } = await supabase
            .from('liga_members')
            .insert({
                liga_id: liga.id,
                user_id: currentUser.id
            });

        if (memberError) {
            console.error('Error añadiendo creador a la liga:', memberError);
            // No lanzamos error porque la liga ya se creó, solo mostramos advertencia
            showNotification('Liga creada, pero hubo un problema al añadirte como miembro. Puedes unirte manualmente.', 'warning');
        } else {
            console.log('✅ Creador añadido automáticamente a la liga');
        }

        showNotification('¡Liga creada correctamente! Ya estás incluido en ella.', 'success');
        closeModals();
        document.getElementById('create-liga-form').reset();
        loadUserLigas();
    } catch (error) {
        console.error('Error creando liga:', error);
        showNotification('Error al crear la liga', 'error');
    }
}

async function joinLiga(event) {
    event.preventDefault();

    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }

    const code = document.getElementById('liga-code').value.toUpperCase();

    try {
        // Buscar liga por código
        const { data: liga, error: ligaError } = await supabase
            .from('ligas')
            .select('id')
            .eq('code', code)
            .single();

        if (ligaError || !liga) {
            showNotification('Código de liga no válido', 'error');
            return;
        }

        // Verificar si ya es miembro
        const { data: existing } = await supabase
            .from('liga_members')
            .select('id')
            .eq('liga_id', liga.id)
            .eq('user_id', currentUser.id)
            .single();

        if (existing) {
            showNotification('Ya eres miembro de esta liga', 'warning');
            return;
        }

        // Unirse a la liga
        const { error: joinError } = await supabase
            .from('liga_members')
            .insert({
                liga_id: liga.id,
                user_id: currentUser.id
            });

        if (joinError) throw joinError;

        showNotification('¡Te has unido a la liga!', 'success');
        closeModals();
        document.getElementById('join-liga-form').reset();
        loadUserLigas();
    } catch (error) {
        console.error('Error uniéndose a liga:', error);
        showNotification('Error al unirse a la liga', 'error');
    }
}

async function loadUserLigas() {
    if (!currentUser) {
        console.warn('⚠️ No hay usuario para cargar ligas');
        return;
    }

    const container = document.getElementById('ligas-container');
    if (!container) {
        console.error('❌ No se encontró ligas-container');
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const { data, error } = await supabase
            .from('liga_members')
            .select(`
                liga_id,
                ligas (
                    id,
                    name,
                    description,
                    code,
                    created_by
                )
            `)
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('❌ Error obteniendo ligas:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No estás en ninguna liga</h3>
                    <p>Crea una liga o únete a una existente.</p>
                </div>
            `;
            return;
        }

        // Obtener conteo de miembros para cada liga
        const ligaIds = data.map(item => item.ligas?.id).filter(Boolean);
        const { data: memberCounts } = await supabase
            .from('liga_members')
            .select('liga_id')
            .in('liga_id', ligaIds);

        const counts = {};
        memberCounts?.forEach(m => {
            counts[m.liga_id] = (counts[m.liga_id] || 0) + 1;
        });

        container.innerHTML = data.map(item => {
            if (!item.ligas) return '';
            const liga = item.ligas;
            const memberCount = counts[liga.id] || 1;
            const isCreator = liga.created_by === currentUser.id;
            
            return `
                <div class="liga-card" onclick="showLigaDetail('${liga.id}')">
                    <div class="liga-card-header">
                        <div>
                            <h3>${liga.name}</h3>
                            ${isCreator ? '<span class="liga-badge-creator"><i class="fas fa-crown"></i> Creador</span>' : ''}
                        </div>
                        <div class="liga-members">
                            <i class="fas fa-users"></i>
                            ${memberCount} miembros
                        </div>
                    </div>
                    ${liga.description ? `<p class="liga-description">${liga.description}</p>` : ''}
                    <div class="liga-code">
                        <i class="fas fa-key"></i>
                        <span>${liga.code}</span>
                        <button class="btn btn-small" onclick="event.stopPropagation(); copyToClipboard('${liga.code}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="liga-actions">
                        <div class="liga-share">
                            <button class="share-btn facebook" onclick="event.stopPropagation(); shareOnFacebook('${liga.code}')">
                                <i class="fab fa-facebook"></i>
                            </button>
                            <button class="share-btn twitter" onclick="event.stopPropagation(); shareOnTwitter('${liga.code}')">
                                <i class="fab fa-twitter"></i>
                            </button>
                            <button class="share-btn whatsapp" onclick="event.stopPropagation(); shareOnWhatsapp('${liga.code}')">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                        ${isCreator ? `
                            <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteLiga('${liga.id}', '${liga.name}')" title="Eliminar liga">
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error cargando ligas:', error);
    }
}

async function showLigaDetail(ligaId) {
    console.log('🏆 Abriendo detalle de liga:', ligaId);
    
    const modal = document.getElementById('liga-detail-modal');
    const content = document.getElementById('liga-detail-content');
    
    content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
    modal.classList.add('active');

    try {
        // Obtener info de la liga
        console.log('📥 Cargando info de liga...');
        const { data: liga, error: ligaError } = await supabase
            .from('ligas')
            .select('id, name, description, code, created_by')
            .eq('id', ligaId)
            .single();

        console.log('Liga:', liga, 'Error:', ligaError);
        if (ligaError) throw ligaError;

        // Obtener miembros (consulta simple sin join)
        console.log('📥 Cargando miembros...');
        const { data: memberIds, error: membersError } = await supabase
            .from('liga_members')
            .select('user_id')
            .eq('liga_id', ligaId);

        console.log('Member IDs:', memberIds, 'Error:', membersError);
        if (membersError) throw membersError;

        // Obtener datos de usuarios por separado
        let members = [];
        if (memberIds && memberIds.length > 0) {
            const userIds = memberIds.map(m => m.user_id);
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, name, total_points')
                .in('id', userIds);
            
            console.log('Users:', usersData, 'Error:', usersError);
            if (!usersError && usersData) {
                members = usersData;
            }
        }

        // Ordenar por puntos
        const sortedMembers = members.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

        console.log('✅ Renderizando detalle de liga');
        content.innerHTML = `
            <h2><i class="fas fa-trophy"></i> ${liga.name}</h2>
            <div class="liga-detail-info">
                ${liga.description ? `<p><strong>Descripción:</strong> ${liga.description}</p>` : ''}
                <p><strong>Código:</strong> <span style="font-family: monospace; color: var(--primary-600);">${liga.code}</span></p>
                <p><strong>Miembros:</strong> ${members.length}</p>
            </div>
            <h3 style="margin-bottom: 15px;"><i class="fas fa-medal"></i> Clasificación de la Liga</h3>
            <div class="leaderboard">
                <div class="leaderboard-header">
                    <span>#</span>
                    <span>Jugador</span>
                    <span>Puntos</span>
                </div>
                ${sortedMembers.length > 0 ? sortedMembers.map((member, index) => `
                    <div class="leaderboard-row ${currentUser && member.id === currentUser.id ? 'current-user' : ''}">
                        <span class="position ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</span>
                        <div class="player-info">
                            <div class="player-avatar">${getInitials(member.name || 'U')}</div>
                            <span class="player-name">${member.name || 'Usuario'}</span>
                        </div>
                        <span class="player-points">${member.total_points || 0}</span>
                    </div>
                `).join('') : '<p style="text-align: center; color: var(--slate-500);">Sin miembros</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Error:', error);
        content.innerHTML = '<p>Error al cargar la información de la liga.</p>';
    }
}

// ========================================
// ADMINISTRACIÓN
// ========================================
function setupAdminTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.adminTab;
            
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tab}-admin-tab`).classList.add('active');
            
            // Cargar datos según tab
            if (tab === 'resultados') {
                loadMatchesForResults();
            } else if (tab === 'usuarios') {
                loadUsersList();
            } else if (tab === 'puntos') {
                loadLigasForEditPoints();
            } else if (tab === 'reiniciar') {
                loadLigasForReset();
            }
        });
    });
}

function loadTeamsInSelectors() {
    const homeSelect = document.getElementById('match-home');
    const awaySelect = document.getElementById('match-away');
    
    console.log('🏟️ Cargando equipos en selectores...');
    
    if (homeSelect && awaySelect) {
        // Limpiar opciones existentes excepto la primera
        homeSelect.innerHTML = '<option value="">Seleccionar...</option>';
        awaySelect.innerHTML = '<option value="">Seleccionar...</option>';
        
        EQUIPOS_LALIGA.forEach(team => {
            homeSelect.innerHTML += `<option value="${team}">${team}</option>`;
            awaySelect.innerHTML += `<option value="${team}">${team}</option>`;
        });
        console.log('✅ Equipos cargados:', EQUIPOS_LALIGA.length);
    } else {
        console.log('⚠️ Selectores de equipos no encontrados');
    }
}

function loadJornadasSelectors() {
    const adminSelect = document.getElementById('admin-jornada-select');
    const resultsSelect = document.getElementById('results-jornada-select');
    
    for (let i = 1; i <= CONFIG_TEMPORADA.TOTAL_JORNADAS; i++) {
        const option = `<option value="${i}">Jornada ${i}</option>`;
        if (adminSelect) adminSelect.innerHTML += option;
        if (resultsSelect) resultsSelect.innerHTML += option;
    }
}

async function loadAdminData() {
    console.log('⚙️ Cargando panel de administración...');
    
    if (!isAdmin) {
        showNotification('No tienes permisos de administrador', 'error');
        return;
    }
    
    // Cargar equipos en selectores
    loadTeamsInSelectors();
    
    // Cargar jornadas en selectores
    loadJornadasSelectors();
    
    // Cargar partidos
    loadAdminMatches();
    
    console.log('✅ Panel admin cargado');
}

async function addMatch(event) {
    event.preventDefault();
    console.log('📝 Añadiendo partido...');

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        showNotification('Error: No se pudo conectar con la base de datos. Por favor, recarga la página.', 'error');
        console.error('❌ Supabase no está disponible');
        return;
    }

    const jornadaEl = document.getElementById('match-jornada');
    const matchDateEl = document.getElementById('match-datetime');
    const homeTeamEl = document.getElementById('match-home');
    const awayTeamEl = document.getElementById('match-away');

    if (!jornadaEl || !matchDateEl || !homeTeamEl || !awayTeamEl) {
        showNotification('Error: No se encontraron los campos del formulario', 'error');
        console.error('❌ Elementos del formulario no encontrados');
        return;
    }

    const jornada = jornadaEl.value.trim();
    const matchDate = matchDateEl.value.trim();
    const homeTeam = homeTeamEl.value.trim();
    const awayTeam = awayTeamEl.value.trim();

    console.log('Datos del formulario:', { jornada, matchDate, homeTeam, awayTeam });

    // Validaciones
    if (!jornada || !matchDate || !homeTeam || !awayTeam) {
        showNotification('Por favor, rellena todos los campos', 'error');
        console.error('❌ Campos vacíos');
        return;
    }

    if (homeTeam === awayTeam) {
        showNotification('El equipo local y visitante no pueden ser el mismo', 'error');
        return;
    }

    // Convertir fecha de datetime-local a formato ISO para Supabase
    let matchDateISO;
    try {
        // datetime-local devuelve formato: YYYY-MM-DDTHH:mm
        // Necesitamos convertirlo a ISO 8601 para Supabase
        const dateObj = new Date(matchDate);
        if (isNaN(dateObj.getTime())) {
            throw new Error('Fecha inválida');
        }
        matchDateISO = dateObj.toISOString();
        console.log('Fecha convertida a ISO:', matchDateISO);
    } catch (dateError) {
        showNotification('Error: La fecha introducida no es válida', 'error');
        console.error('❌ Error al procesar la fecha:', dateError);
        return;
    }

    try {
        console.log('Insertando partido en Supabase...');
        
        const { data, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('matches')
                .insert({
                    jornada: parseInt(jornada),
                    match_date: matchDateISO,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    home_score: null,
                    away_score: null
                })
                .select()
        , 10000);

        console.log('Resultado insert:', { data, error });

        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('No se creó el partido. Verifica los datos.');
        }

        showNotification('✅ Partido añadido correctamente', 'success');
        
        // Resetear formulario
        const form = document.getElementById('add-match-form');
        if (form) {
            form.reset();
        }
        
        // Recargar lista de partidos
        if (typeof loadAdminMatches === 'function') {
            loadAdminMatches();
        }
        
    } catch (error) {
        console.error('❌ Error añadiendo partido:', error);
        const errorMessage = error.message || 'Error desconocido al añadir el partido';
        showNotification('Error al añadir el partido: ' + errorMessage, 'error');
    }
}

// ========================================
// IMPORTAR DESDE EXCEL
// ========================================
function clearExcelData() {
    document.getElementById('excel-data').value = '';
    document.getElementById('import-preview').innerHTML = '';
}

async function importFromExcel() {
    const excelData = document.getElementById('excel-data').value.trim();
    
    if (!excelData) {
        showNotification('No hay datos para importar', 'warning');
        return;
    }

    const lines = excelData.split('\n').filter(line => line.trim());
    const matches = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Separar por tabulación o múltiples espacios
        const parts = line.split(/\t|(?:  +)/).map(p => p.trim()).filter(p => p);
        
        if (parts.length < 5) {
            errors.push({ line: i + 1, error: `Faltan columnas (tiene ${parts.length}, necesita 5)`, data: line });
            continue;
        }

        const [jornadaStr, fechaStr, horaStr, homeTeam, awayTeam] = parts;

        // Validar jornada
        const jornada = parseInt(jornadaStr);
        if (isNaN(jornada) || jornada < 1 || jornada > 38) {
            errors.push({ line: i + 1, error: `Jornada inválida: ${jornadaStr}`, data: line });
            continue;
        }

        // Parsear fecha y hora
        let matchDate;
        try {
            matchDate = parseSpanishDate(fechaStr, horaStr);
            if (!matchDate || isNaN(matchDate.getTime())) {
                throw new Error('Fecha inválida');
            }
        } catch (e) {
            errors.push({ line: i + 1, error: `Fecha/hora inválida: ${fechaStr} ${horaStr}`, data: line });
            continue;
        }

        // Validar equipos
        if (homeTeam === awayTeam) {
            errors.push({ line: i + 1, error: 'Equipo local y visitante son iguales', data: line });
            continue;
        }

        matches.push({
            jornada,
            match_date: matchDate.toISOString(),
            home_team: homeTeam,
            away_team: awayTeam
        });
    }

    // Mostrar preview
    showImportPreview(matches, errors);

    if (matches.length === 0) {
        showNotification('No hay partidos válidos para importar', 'error');
        return;
    }

    // Confirmar importación
    if (!confirm(`¿Importar ${matches.length} partidos? ${errors.length > 0 ? `(${errors.length} con errores serán ignorados)` : ''}`)) {
        return;
    }

    // Insertar en base de datos
    try {
        const { data, error } = await supabase
            .from('matches')
            .insert(matches);

        if (error) throw error;

        showNotification(`¡${matches.length} partidos importados correctamente!`, 'success');
        clearExcelData();
        loadAdminMatches();
    } catch (error) {
        console.error('Error importando partidos:', error);
        showNotification('Error al importar partidos: ' + error.message, 'error');
    }
}

function parseSpanishDate(dateStr, timeStr) {
    // Soporta formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    let day, month, year;
    
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[0].length === 4) {
            // YYYY/MM/DD
            [year, month, day] = parts;
        } else {
            // DD/MM/YYYY
            [day, month, year] = parts;
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            [year, month, day] = parts;
        } else {
            // DD-MM-YYYY
            [day, month, year] = parts;
        }
    } else {
        return null;
    }

    // Parsear hora
    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n));
    
    // Crear fecha
    const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        hours || 0,
        minutes || 0
    );

    return date;
}

function showImportPreview(matches, errors) {
    const container = document.getElementById('import-preview');
    
    if (matches.length === 0 && errors.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <h4><i class="fas fa-eye"></i> Vista Previa</h4>
        <div class="import-summary">
            <div class="stat success">
                <i class="fas fa-check-circle"></i>
                <span>${matches.length} partidos válidos</span>
            </div>
            ${errors.length > 0 ? `
                <div class="stat error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${errors.length} con errores</span>
                </div>
            ` : ''}
        </div>
    `;

    if (matches.length > 0) {
        html += `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>Jornada</th>
                        <th>Fecha</th>
                        <th>Local</th>
                        <th>Visitante</th>
                    </tr>
                </thead>
                <tbody>
                    ${matches.slice(0, 20).map(m => `
                        <tr>
                            <td>${m.jornada}</td>
                            <td>${formatDate(new Date(m.match_date))}</td>
                            <td>${m.home_team}</td>
                            <td>${m.away_team}</td>
                        </tr>
                    `).join('')}
                    ${matches.length > 20 ? `
                        <tr>
                            <td colspan="4" style="text-align: center; font-style: italic;">
                                ... y ${matches.length - 20} partidos más
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        `;
    }

    if (errors.length > 0) {
        html += `
            <h4 style="margin-top: 20px; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle"></i> Errores encontrados
            </h4>
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>Línea</th>
                        <th>Error</th>
                        <th>Datos</th>
                    </tr>
                </thead>
                <tbody>
                    ${errors.map(e => `
                        <tr class="error-row">
                            <td>${e.line}</td>
                            <td>${e.error}</td>
                            <td style="font-family: monospace; font-size: 0.8rem;">${e.data.substring(0, 50)}...</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    container.innerHTML = html;
}

async function loadAdminMatches() {
    const jornada = document.getElementById('admin-jornada-select')?.value || 1;
    const container = document.getElementById('admin-matches-list');
    
    if (!container) return;

    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('jornada', jornada)
            .order('match_date', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay partidos en esta jornada.</p>';
            return;
        }

        container.innerHTML = data.map(match => `
            <div class="admin-match-item">
                <div>
                    <div class="admin-match-teams">${match.home_team} vs ${match.away_team}</div>
                    <div class="admin-match-date">${formatDate(new Date(match.match_date))}</div>
                </div>
                <div class="admin-match-actions">
                    <button class="btn btn-small btn-danger" onclick="deleteMatch(${match.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando partidos:', error);
    }
}

async function deleteMatch(matchId) {
    if (!confirm('¿Estás seguro de eliminar este partido?')) return;

    try {
        // Primero eliminar predicciones asociadas
        await supabase
            .from('predictions')
            .delete()
            .eq('match_id', matchId);

        // Luego eliminar el partido
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', matchId);

        if (error) throw error;

        showNotification('Partido eliminado', 'success');
        loadAdminMatches();
    } catch (error) {
        console.error('Error eliminando partido:', error);
        showNotification('Error al eliminar el partido', 'error');
    }
}

async function loadMatchesForResults() {
    const jornada = document.getElementById('results-jornada-select')?.value || 1;
    const container = document.getElementById('results-matches-list');
    
    if (!container) return;

    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('jornada', jornada)
            .order('match_date', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">No hay partidos en esta jornada.</p>';
            return;
        }

        // Función para generar opciones del selector
        const generateResultOptions = (selectedValue) => {
            const hasValue = typeof selectedValue === 'number';
            let options = `<option value="" ${!hasValue ? 'selected' : ''}>-</option>`;
            for (let i = 0; i <= 9; i++) {
                const isSelected = hasValue && selectedValue === i;
                options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${i}</option>`;
            }
            return options;
        };

        // Formato de fecha
        const formatMatchDate = (date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${d}/${m}`;
        };
        
        const formatMatchTime = (date) => {
            const h = date.getHours().toString().padStart(2, '0');
            const min = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${min}`;
        };

        // Header de la tabla
        const tableHeader = `
            <div class="results-table-header">
                <span class="col-jornada">J</span>
                <span class="col-fecha">Fecha</span>
                <span class="col-hora">Hora</span>
                <span class="col-local">Equipo Local</span>
                <span class="col-goles">Goles</span>
                <span class="col-goles">Goles</span>
                <span class="col-visitante">Equipo Visitante</span>
                <span class="col-accion">Acción</span>
            </div>
        `;

        container.innerHTML = tableHeader + data.map(match => {
            const matchDate = new Date(match.match_date);
            const hasResult = match.home_score !== null && match.away_score !== null;
            
            return `
                <div class="result-row ${hasResult ? 'has-result' : ''}" data-match-id="${match.id}">
                    <span class="col-jornada">${match.jornada}</span>
                    <span class="col-fecha">${formatMatchDate(matchDate)}</span>
                    <span class="col-hora">${formatMatchTime(matchDate)}</span>
                    <span class="col-local">${match.home_team}</span>
                    <span class="col-goles">
                        <select class="goal-select ${match.home_score !== null ? 'has-value' : ''}" 
                                id="result-home-${match.id}">
                            ${generateResultOptions(match.home_score)}
                        </select>
                    </span>
                    <span class="col-goles">
                        <select class="goal-select ${match.away_score !== null ? 'has-value' : ''}" 
                                id="result-away-${match.id}">
                            ${generateResultOptions(match.away_score)}
                        </select>
                    </span>
                    <span class="col-visitante">${match.away_team}</span>
                    <span class="col-accion">
                        <button class="btn btn-small ${hasResult ? 'btn-secondary' : 'btn-success'}" onclick="saveMatchResult(${match.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    </span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error cargando partidos:', error);
    }
}

async function saveMatchResult(matchId) {
    const homeSelect = document.getElementById(`result-home-${matchId}`);
    const awaySelect = document.getElementById(`result-away-${matchId}`);
    const homeScore = homeSelect.value;
    const awayScore = awaySelect.value;

    if (homeScore === '' || awayScore === '') {
        showNotification('Introduce ambos resultados', 'error');
        return;
    }
    
    // Actualizar clases visuales
    homeSelect.classList.add('has-value');
    awaySelect.classList.add('has-value');

    try {
        // Guardar resultado
        const { error: matchError } = await supabase
            .from('matches')
            .update({
                home_score: parseInt(homeScore),
                away_score: parseInt(awayScore)
            })
            .eq('id', matchId);

        if (matchError) throw matchError;

        // Calcular puntos para todos los usuarios que hicieron predicción
        await calculatePointsForMatch(matchId, parseInt(homeScore), parseInt(awayScore));

        showNotification('Resultado guardado y puntos calculados', 'success');
    } catch (error) {
        console.error('Error guardando resultado:', error);
        showNotification('Error al guardar el resultado', 'error');
    }
}

async function calculatePointsForMatch(matchId, homeScore, awayScore) {
    try {
        // Obtener todas las predicciones para este partido
        const { data: predictions, error: predError } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_id', matchId);

        if (predError) throw predError;

        // Calcular puntos para cada predicción
        for (const pred of predictions || []) {
            const points = calculatePoints(
                pred.home_prediction,
                pred.away_prediction,
                homeScore,
                awayScore
            );

            // Actualizar puntos en la predicción
            await supabase
                .from('predictions')
                .update({ points: points })
                .eq('id', pred.id);
        }

        // Recalcular puntos totales de cada usuario
        await recalculateAllUserPoints();
    } catch (error) {
        console.error('Error calculando puntos:', error);
    }
}

async function recalculateAllUserPoints() {
    try {
        // Obtener todos los usuarios
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id');

        if (userError) throw userError;

        // Para cada usuario, sumar sus puntos
        for (const user of users || []) {
            const { data: predictions } = await supabase
                .from('predictions')
                .select('points')
                .eq('user_id', user.id)
                .not('points', 'is', null);

            const totalPoints = predictions?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

            await supabase
                .from('users')
                .update({ total_points: totalPoints })
                .eq('id', user.id);
        }
    } catch (error) {
        console.error('Error recalculando puntos:', error);
    }
}

async function loadUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No hay usuarios registrados.</p>';
            return;
        }

        container.innerHTML = data.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-avatar">${getInitials(user.name)}</div>
                    <div class="user-details">
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                    </div>
                </div>
                <span class="user-badge ${user.is_admin ? 'admin' : 'user'}">
                    ${user.is_admin ? 'Admin' : 'Usuario'}
                </span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

async function setActiveJornada(event) {
    event.preventDefault();
    
    const jornada = document.getElementById('active-jornada').value;

    try {
        const { error } = await supabase
            .from('config')
            .upsert({
                key: 'active_jornada',
                value: jornada
            }, { onConflict: 'key' });

        if (error) throw error;

        activeJornada = parseInt(jornada);
        showNotification(`Jornada ${jornada} establecida como activa`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al establecer la jornada', 'error');
    }
}

// ========================================
// UTILIDADES
// ========================================
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    messageEl.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function formatDate(date) {
    const options = { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleDateString('es-ES', options);
}

// ========================================
// PERFIL DE USUARIO
// ========================================
let userAvatarUrl = null;

function showProfileModal() {
    closeModals();
    loadProfileData();
    document.getElementById('profile-modal').classList.add('active');
}

async function loadProfileData() {
    if (!currentUser) return;

    try {
        // Obtener datos del usuario (sin avatar_url por si no existe)
        let { data: userData, error } = await supabase
            .from('users')
            .select('id, name, email, is_admin, total_points')
            .eq('id', currentUser.id)
            .single();

        // Si falla por avatar_url, intentar sin ella
        if (error && error.message.includes('avatar_url')) {
            const retry = await supabase
                .from('users')
                .select('id, name, email, is_admin, total_points')
                .eq('id', currentUser.id)
                .single();
            userData = retry.data;
            error = retry.error;
        }

        if (error) throw error;

        // Llenar formulario
        document.getElementById('profile-name').value = userData?.name || '';
        document.getElementById('profile-email').value = currentUser.email || '';
        document.getElementById('profile-points').textContent = userData?.total_points || 0;

        // Cargar avatar (avatar_url puede no existir en la tabla)
        const initials = getInitials(userData?.name);
        document.getElementById('avatar-initials').textContent = initials;
        
        const avatarUrl = userData?.avatar_url || null;
        if (avatarUrl) {
            userAvatarUrl = avatarUrl;
            document.getElementById('avatar-image').src = avatarUrl;
            document.getElementById('avatar-image').style.display = 'block';
            document.getElementById('avatar-initials').style.display = 'none';
            document.getElementById('remove-avatar-btn').style.display = 'inline-flex';
        } else {
            document.getElementById('avatar-image').style.display = 'none';
            document.getElementById('avatar-initials').style.display = 'flex';
            document.getElementById('remove-avatar-btn').style.display = 'none';
        }

        // Contar ligas
        const { data: ligas } = await supabase
            .from('liga_members')
            .select('id')
            .eq('user_id', currentUser.id);
        
        document.getElementById('profile-ligas').textContent = ligas?.length || 0;

    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('La imagen no puede superar 2MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('avatar-image').src = e.target.result;
        document.getElementById('avatar-image').style.display = 'block';
        document.getElementById('avatar-initials').style.display = 'none';
        document.getElementById('remove-avatar-btn').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function removeAvatar() {
    document.getElementById('avatar-input').value = '';
    document.getElementById('avatar-image').src = '';
    document.getElementById('avatar-image').style.display = 'none';
    document.getElementById('avatar-initials').style.display = 'flex';
    document.getElementById('remove-avatar-btn').style.display = 'none';
    userAvatarUrl = null;
}

async function saveProfile(event) {
    event.preventDefault();
    
    if (!currentUser) return;

    const name = document.getElementById('profile-name').value.trim();
    const avatarInput = document.getElementById('avatar-input');
    
    if (!name) {
        showNotification('El nombre es obligatorio', 'error');
        return;
    }

    try {
        let avatarUrl = userAvatarUrl;

        // Subir nueva imagen si hay una seleccionada
        if (avatarInput.files[0]) {
            const file = avatarInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

            // Subir a Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error('Error subiendo avatar:', uploadError);
                // Continuar sin avatar si falla
            } else {
                // Obtener URL pública
                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);
                avatarUrl = urlData.publicUrl;
            }
        }

        // Actualizar usuario en la base de datos
        const updateData = { name: name };
        if (avatarUrl) {
            updateData.avatar_url = avatarUrl;
        }
        
        let { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', currentUser.id);

        // Si falla por avatar_url, intentar solo con name
        if (error && error.message.includes('avatar_url')) {
            console.log('⚠️ Columna avatar_url no existe, actualizando solo nombre');
            const retry = await supabase
                .from('users')
                .update({ name: name })
                .eq('id', currentUser.id);
            error = retry.error;
        }

        if (error) throw error;

        // Actualizar UI
        document.getElementById('user-name').textContent = name;
        updateNavAvatar(name, avatarUrl);
        
        // Recargar datos del perfil para actualizar estadísticas
        await loadProfileData();
        
        showNotification('Perfil actualizado correctamente', 'success');

    } catch (error) {
        console.error('Error guardando perfil:', error);
        showNotification('Error al guardar el perfil', 'error');
    }
}

async function joinLigaFromProfile(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }

    const code = document.getElementById('profile-liga-code').value.toUpperCase().trim();
    
    if (!code) {
        showNotification('Introduce un código de liga', 'error');
        return;
    }

    try {
        // Buscar liga por código
        const { data: liga, error: ligaError } = await supabase
            .from('ligas')
            .select('id, name')
            .eq('code', code)
            .single();

        if (ligaError || !liga) {
            showNotification('Código de liga no válido', 'error');
            return;
        }

        // Verificar si ya es miembro
        const { data: existing } = await supabase
            .from('liga_members')
            .select('id')
            .eq('liga_id', liga.id)
            .eq('user_id', currentUser.id)
            .single();

        if (existing) {
            showNotification('Ya eres miembro de esta liga', 'warning');
            document.getElementById('profile-liga-code').value = '';
            return;
        }

        // Unirse a la liga
        const { error: joinError } = await supabase
            .from('liga_members')
            .insert({
                liga_id: liga.id,
                user_id: currentUser.id
            });

        if (joinError) throw joinError;

        showNotification(`¡Te has unido a la liga "${liga.name}"!`, 'success');
        document.getElementById('profile-liga-code').value = '';
        
        // Recargar datos del perfil para actualizar número de ligas
        await loadProfileData();
        
        // Recargar sección de ligas si está abierta
        if (document.getElementById('ligas-section').classList.contains('active')) {
            loadUserLigas();
        }
    } catch (error) {
        console.error('Error uniéndose a liga:', error);
        showNotification('Error al unirse a la liga', 'error');
    }
}

function updateNavAvatar(name, avatarUrl) {
    const initials = getInitials(name);
    document.getElementById('nav-avatar-initials').textContent = initials;
    
    if (avatarUrl) {
        document.getElementById('nav-avatar-image').src = avatarUrl;
        document.getElementById('nav-avatar-image').style.display = 'block';
        document.getElementById('nav-avatar-initials').style.display = 'none';
    } else {
        document.getElementById('nav-avatar-image').style.display = 'none';
        document.getElementById('nav-avatar-initials').style.display = 'flex';
    }
}

function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function generateLigaCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Código copiado al portapapeles', 'success');
    });
}

function shareOnFacebook(code) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`¡Únete a mi liga de SuperLiga! Código: ${code}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
}

function shareOnTwitter(code) {
    const text = encodeURIComponent(`¡Únete a mi liga de SuperLiga! Código: ${code}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function shareOnWhatsapp(code) {
    const text = encodeURIComponent(`¡Únete a mi liga de SuperLiga! Código: ${code} - ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

// Hacer funciones disponibles globalmente para onClick handlers
if (typeof window !== 'undefined') {
    window.showLoginModal = showLoginModal;
    window.showRegisterModal = showRegisterModal;
    window.showForgotPasswordModal = showForgotPasswordModal;
    window.showRulesModal = showRulesModal;
    window.handleForgotPassword = handleForgotPassword;
    window.closeModals = closeModals;
    window.handleLogin = handleLogin;
    window.handleRegister = handleRegister;
    window.handleCreateFirstLiga = handleCreateFirstLiga;
    window.handleLogout = handleLogout;
    window.showProfileModal = showProfileModal;
    window.showCreateLigaModal = showCreateLigaModal;
    window.showJoinLigaModal = showJoinLigaModal;
    window.closeDashboardDetail = closeDashboardDetail;
    window.changeJornada = changeJornada;
    window.loadMatches = loadMatches;
    window.savePredictions = savePredictions;
    window.resetPredictions = resetPredictions;
    window.loadLigaClassification = loadLigaClassification;
    window.importFromExcel = importFromExcel;
    window.clearExcelData = clearExcelData;
    window.addMatch = addMatch;
    window.loadAdminMatches = loadAdminMatches;
    window.loadMatchesForResults = loadMatchesForResults;
    window.setActiveJornada = setActiveJornada;
    window.createLiga = createLiga;
    window.joinLiga = joinLiga;
    window.joinLigaFromProfile = joinLigaFromProfile;
    window.previewAvatar = previewAvatar;
    window.removeAvatar = removeAvatar;
    window.saveProfile = saveProfile;
    window.copyToClipboard = copyToClipboard;
    window.shareOnFacebook = shareOnFacebook;
    window.shareOnTwitter = shareOnTwitter;
    window.shareOnWhatsapp = shareOnWhatsapp;
    window.markPredictionChanged = markPredictionChanged;
    window.deleteLiga = deleteLiga;
    window.loadLigasForEditPoints = loadLigasForEditPoints;
    window.loadUsersForLiga = loadUsersForLiga;
    window.updateUserPoints = updateUserPoints;
    window.loadLigasForReset = loadLigasForReset;
    window.resetLiga = resetLiga;
    window.resetWeb = resetWeb;
    window.resetAllUserPoints = resetAllUserPoints;
    window.deleteLiga = deleteLiga;
}

// ========================================
// ELIMINAR LIGA
// ========================================
async function deleteLiga(ligaId, ligaName) {
    if (!currentUser) {
        showNotification('Debes estar autenticado para eliminar una liga', 'error');
        return;
    }

    // Verificar que el usuario es el creador de la liga
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        const { data: liga, error: ligaError } = await executeQueryWithTimeout(() =>
            supabase
                .from('ligas')
                .select('created_by')
                .eq('id', ligaId)
                .single()
        , 5000);

        if (ligaError) throw ligaError;

        if (liga.created_by !== currentUser.id) {
            showNotification('Solo el creador de la liga puede eliminarla', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar la liga "${ligaName}"?\n\nEsta acción eliminará:\n- La liga\n- Todos los miembros de la liga\n- Esta acción NO se puede deshacer.`)) {
            return;
        }

        if (!confirm('ÚLTIMA CONFIRMACIÓN: ¿Eliminar la liga definitivamente?')) {
            return;
        }

        showNotification('Eliminando liga...', 'info');

        // 1. Eliminar todos los miembros de la liga
        const { error: membersError } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .delete()
                .eq('liga_id', ligaId)
        , 10000);

        if (membersError) {
            console.warn('Error eliminando miembros (continuando):', membersError);
        }

        // 2. Eliminar la liga
        const { error: deleteError } = await executeQueryWithTimeout(() =>
            supabase
                .from('ligas')
                .delete()
                .eq('id', ligaId)
        , 10000);

        if (deleteError) throw deleteError;

        showNotification(`Liga "${ligaName}" eliminada correctamente`, 'success');

        // Recargar la lista de ligas
        setTimeout(() => {
            loadUserLigas();
        }, 1000);

    } catch (error) {
        console.error('Error eliminando liga:', error);
        showNotification('Error al eliminar la liga: ' + (error.message || 'Error desconocido'), 'error');
    }
}

