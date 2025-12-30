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
let currentCompetitionId = 1; // ID de la competición activa (por defecto La Liga)
let currentCompetition = null; // Objeto con datos de la competición activa

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
        // Primero mostrar el dashboard
        await showDashboard();
        // Después cargar competición activa (mostrará modal si hay múltiples)
        await loadActiveCompetition();
    }

    // Listener para cambios de autenticación (usar la variable local supabase)
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await loadUserProfile();
            // Primero mostrar el dashboard
            await showDashboard();
            // Esperar un momento para que el DOM esté completamente listo
            await new Promise(resolve => setTimeout(resolve, 300));
            // Después cargar competición activa (mostrará modal si hay múltiples)
            // Esto se ejecuta cada vez que un usuario inicia sesión
            await loadActiveCompetition();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            isAdmin = false;
            currentCompetitionId = null;
            currentCompetition = null;
            // Limpiar cualquier estado guardado
            localStorage.removeItem('active_competition_id');
            showLandingPage();
        }
    });
    
    // Configurar navegación
    setupNavigation();
    
    // Tabs de clasificación eliminados - solo se muestra por liga
    
    // Configurar tabs de admin
    setupAdminTabs();
    
    // Cargar equipos en selectores (después de cargar competición)
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
    console.log('🔓 showLoginModal() llamado');
    closeModals();
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('active');
        loginModal.style.display = 'flex';
        console.log('✅ Modal de login mostrado');
    } else {
        console.error('❌ Modal de login no encontrado');
    }
}

function showRegisterModal() {
    console.log('📝 showRegisterModal() llamado');
    closeModals();
    const registerModal = document.getElementById('register-modal');
    if (registerModal) {
        registerModal.classList.add('active');
        registerModal.style.display = 'flex';
        console.log('✅ Modal de registro mostrado');
    } else {
        console.error('❌ Modal de registro no encontrado');
    }
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
        // NO cerrar el modal de selección de competición (debe permanecer hasta que el usuario seleccione)
        if (modal.id !== 'competition-selector-modal') {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    });
}

// Cerrar modal al hacer clic fuera (excepto el modal de competición)
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        // NO permitir cerrar el modal de competición haciendo clic fuera
        if (e.target === modal && modal.id !== 'competition-selector-modal') {
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

    // Obtener referencia a Supabase
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.auth) {
        console.error('❌ Supabase no está disponible');
        showNotification('Error: No se pudo conectar con el servidor. Por favor, recarga la página.', 'error');
        return;
    }

    try {
        console.log('🔐 Intentando iniciar sesión con email:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Mostrar mensajes más descriptivos para ayudar al usuario
            console.error('❌ Error de login:', error);
            
            if (error.message && error.message.includes('Invalid login')) {
                showNotification('Email o contraseña incorrectos', 'error');
            } else if (error.message && error.message.includes('Email not confirmed')) {
                showNotification('Por favor, verifica tu email antes de iniciar sesión', 'error');
            } else {
                showNotification(`Error: ${error.message || 'No se pudo iniciar sesión'}`, 'error');
            }
            return;
        }

        console.log('✅ Login exitoso, datos:', data);
        
        // Cerrar el modal de login
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('active');
            loginModal.style.display = 'none';
        }
        
        showNotification('¡Bienvenido de nuevo!', 'success');
        
        // El evento onAuthStateChange se encargará de redirigir al dashboard
        // Ya no esperamos aquí, el listener se ejecutará automáticamente
    } catch (error) {
        console.error('❌ Error en login (catch):', error);
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

        // 3. Crear la liga (asociada a la competición activa)
        const ligaData = {
            name: ligaName,
            description: ligaDescription,
            code: ligaCode,
            created_by: authData.user.id
        };
        
        // Añadir competition_id si existe la columna
        try {
            ligaData.competition_id = currentCompetitionId;
        } catch (e) {
            // Si no existe la columna, continuar sin ella (compatibilidad)
            console.warn('⚠️ Columna competition_id no existe en ligas');
        }
        
        const { data: newLiga, error: ligaError } = await supabase
            .from('ligas')
            .insert(ligaData)
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
    
    try {
        // Usar getSupabase() para obtener el cliente correctamente
        const supabase = getSupabase();
        
        if (supabase) {
            const { error } = await supabase.auth.signOut();
            console.log('Resultado signOut:', error ? 'Error' : 'OK');
            
            if (error) {
                console.error('Error en signOut:', error);
            }
        } else {
            console.warn('⚠️ Supabase no disponible para logout, limpiando sesión localmente');
        }
        
        // Limpiar variables (siempre, aunque haya error)
        currentUser = null;
        isAdmin = false;
        userPredictions = {};
        currentCompetitionId = null;
        currentCompetition = null;
        
        // Ocultar link de admin
        const adminBtn = document.getElementById('admin-header-btn');
        if (adminBtn) adminBtn.style.display = 'none';
        
        // Cerrar todos los modales
        closeAllModals();
        
        // Mostrar página de inicio
        showLandingPage();
        
        showNotification('Sesión cerrada correctamente', 'success');
        console.log('✅ Logout completado');
    } catch (error) {
        console.error('❌ Error logout:', error);
        
        // Limpiar y mostrar landing de todas formas
        currentUser = null;
        isAdmin = false;
        userPredictions = {};
        currentCompetitionId = null;
        currentCompetition = null;
        
        // Cerrar todos los modales (forzar cierre incluso del selector de competición)
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        });
        
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
    
    const adminBtn = document.getElementById('admin-header-btn');
    
    if (!adminBtn) {
        console.warn('⚠️ No se encontró el elemento admin-header-btn, intentando más tarde...');
        // Intentar de nuevo después de un pequeño delay (puede que el DOM aún no esté listo)
        setTimeout(() => {
            const retryBtn = document.getElementById('admin-header-btn');
            if (retryBtn) {
                console.log('✅ Elemento encontrado en reintento');
                updateAdminVisibility();
            } else {
                console.warn('⚠️ Elemento admin-header-btn no encontrado después del reintento');
            }
        }, 500);
        return;
    }
    
    if (isAdmin) {
        adminBtn.style.display = 'flex';
        console.log('✅ Panel Admin VISIBLE');
    } else {
        adminBtn.style.display = 'none';
        console.log('🔒 Panel Admin OCULTO (no es admin)');
    }
}

// ========================================
// NAVEGACIÓN
// ========================================
function showLandingPage() {
    console.log('🔄 showLandingPage() llamado');
    const landingPage = document.getElementById('landing-page');
    const dashboardPage = document.getElementById('dashboard-page');
    
    if (!landingPage || !dashboardPage) {
        console.error('❌ Elementos de página no encontrados');
        console.error('Landing page existe:', !!landingPage);
        console.error('Dashboard page existe:', !!dashboardPage);
        return;
    }
    
    console.log('📄 Cambiando de dashboard a landing page...');
    
    // Mostrar landing page
    landingPage.classList.add('active');
    landingPage.style.display = 'block';
    
    // Ocultar dashboard
    dashboardPage.classList.remove('active');
    dashboardPage.style.display = 'none';
    
    // Limpiar cualquier contenido que pueda estar visible
    console.log('✅ Landing page mostrada, dashboard oculto');
}

async function showDashboard() {
    console.log('🔄 showDashboard() llamado');
    const landingPage = document.getElementById('landing-page');
    const dashboardPage = document.getElementById('dashboard-page');
    
    if (!landingPage || !dashboardPage) {
        console.error('❌ Elementos de página no encontrados');
        console.error('Landing page existe:', !!landingPage);
        console.error('Dashboard page existe:', !!dashboardPage);
        return;
    }

    console.log('📄 Cambiando de landing page a dashboard...');
    landingPage.classList.remove('active');
    landingPage.style.display = 'none';
    dashboardPage.classList.add('active');
    dashboardPage.style.display = 'block';
    
    console.log('✅ Dashboard mostrado');
    
    try {
        // Cargar datos iniciales (esperar a que se completen)
        console.log('📊 Cargando datos del dashboard...');
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
        // Cargar selectores de ligas primero
        await loadDashboardStatisticsLigaSelector();
        await loadDashboardClassificationLigaSelector();
        
        await Promise.all([
            loadDashboardSummary(),
            loadDashboardStatistics(), // Ahora puede recibir ligaId del selector
            loadDashboardJornada(),
            loadDashboardTopLigas(), // Ahora carga clasificación según liga seleccionada
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

// Cargar selector de ligas para estadísticas del dashboard
async function loadDashboardStatisticsLigaSelector() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        const { data: userLigas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('liga_id, ligas(id, name)')
                .eq('user_id', currentUser.id)
        , 8000);

        if (error) throw error;

        const select = document.getElementById('dashboard-statistics-liga-select');
        if (!select) return;

        // Limpiar opciones
        select.innerHTML = '<option value="">Selecciona una liga</option>';

        if (userLigas && userLigas.length > 0) {
            userLigas.forEach(item => {
                if (item.ligas) {
                    select.innerHTML += `<option value="${item.ligas.id}">${item.ligas.name}</option>`;
                }
            });

            // Si solo hay una liga, seleccionarla automáticamente
            if (userLigas.length === 1 && userLigas[0].ligas) {
                select.value = userLigas[0].ligas.id;
                loadDashboardStatistics(userLigas[0].ligas.id);
            }
        } else {
            select.innerHTML = '<option value="">No perteneces a ninguna liga</option>';
        }
    } catch (error) {
        console.error('Error cargando ligas para estadísticas:', error);
        const select = document.getElementById('dashboard-statistics-liga-select');
        if (select) {
            select.innerHTML = '<option value="">Error al cargar ligas</option>';
        }
    }
}

async function loadDashboardStatistics(ligaId = null) {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    // Si no se proporciona ligaId, intentar obtenerlo del selector
    if (!ligaId) {
        const select = document.getElementById('dashboard-statistics-liga-select');
        ligaId = select ? parseInt(select.value) : null;
    }

    // Si aún no hay ligaId, no cargar estadísticas
    if (!ligaId) {
        // Limpiar estadísticas
        const predictedEl = document.getElementById('dashboard-predicted-matches');
        if (predictedEl) predictedEl.textContent = '0';
        const avgEl = document.getElementById('dashboard-avg-points');
        if (avgEl) avgEl.textContent = '0';
        const avgJornadaEl = document.getElementById('dashboard-avg-jornada');
        if (avgJornadaEl) avgJornadaEl.textContent = '0';
        const chartEl = document.getElementById('dashboard-jornada-chart');
        if (chartEl) chartEl.innerHTML = '<p class="no-data">Selecciona una liga para ver estadísticas</p>';
        return;
    }

    try {
        // Construir consulta base
        let query = supabase
            .from('predictions')
            .select('points, matches(jornada)')
            .eq('user_id', currentUser.id);

        // Filtrar por liga_id si existe la columna (con manejo de errores)
        try {
            query = query.eq('liga_id', ligaId);
        } catch (e) {
            // Si la columna no existe, continuar sin filtrar
            console.warn('⚠️ Columna liga_id no existe en predictions, cargando todas las predicciones');
        }

        const { data: predictions, error: predError } = await executeQueryWithTimeout(() => query, 8000).catch(() => ({ data: [], error: null }));

        // Si hay error relacionado con liga_id, intentar sin filtrar
        if (predError && (predError.message?.includes('liga_id') || predError.code === '42703')) {
            console.warn('⚠️ Error con liga_id, cargando todas las predicciones y filtrando en memoria');
            const { data: allPredictions } = await executeQueryWithTimeout(() =>
                supabase
                    .from('predictions')
                    .select('points, matches(jornada), liga_id')
                    .eq('user_id', currentUser.id)
            , 8000).catch(() => ({ data: [] }));

            // Filtrar en memoria
            const filteredPredictions = allPredictions?.filter(p => {
                if (p.liga_id !== undefined && p.liga_id !== null) {
                    return parseInt(p.liga_id) === ligaId;
                }
                // Si no tiene liga_id, incluirla (compatibilidad)
                return true;
            }) || [];

            processDashboardStatistics(filteredPredictions);
        } else {
            processDashboardStatistics(predictions || []);
        }

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function processDashboardStatistics(predictions) {
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
}

// Función para manejar cambio de liga en estadísticas
function onDashboardStatisticsLigaChange() {
    const select = document.getElementById('dashboard-statistics-liga-select');
    if (select && select.value) {
        loadDashboardStatistics(parseInt(select.value));
    } else {
        loadDashboardStatistics(null);
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

        // Obtener TODOS los partidos de la jornada activa (incluyendo resultados)
        // Filtrar por competición activa
        let matchesQuery = supabase
            .from('matches')
            .select('id, home_team, away_team, match_date, jornada, home_score, away_score')
            .eq('jornada', activeJornada);
        
        // Filtrar por competition_id si existe
        try {
            matchesQuery = matchesQuery.eq('competition_id', currentCompetitionId);
        } catch (e) {
            console.warn('⚠️ Columna competition_id no existe en matches');
        }
        
        const { data: matches, error: matchesError } = await executeQueryWithTimeout(() =>
            matchesQuery.order('match_date', { ascending: true })
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

        // Mostrar TODOS los partidos de la jornada con resultados (sin pronósticos)
        const matchesEl = document.getElementById('dashboard-next-matches');
        if (matchesEl && matches && matches.length > 0) {
            matchesEl.innerHTML = matches.map(match => {
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

// Cargar selector de ligas para clasificación del dashboard
async function loadDashboardClassificationLigaSelector() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        const { data: userLigas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('liga_id, ligas(id, name)')
                .eq('user_id', currentUser.id)
        , 8000);

        if (error) throw error;

        const select = document.getElementById('dashboard-classification-liga-select');
        if (!select) return;

        // Filtrar ligas por competición activa en memoria
        let filteredLigas = userLigas || [];
        if (userLigas && userLigas.length > 0 && userLigas[0].ligas?.competition_id !== undefined) {
            filteredLigas = userLigas.filter(item => 
                item.ligas && parseInt(item.ligas.competition_id) === currentCompetitionId
            );
        }

        // Limpiar opciones
        select.innerHTML = '<option value="">Selecciona una liga</option>';

        if (filteredLigas && filteredLigas.length > 0) {
            filteredLigas.forEach(item => {
                if (item.ligas) {
                    select.innerHTML += `<option value="${item.ligas.id}">${item.ligas.name}</option>`;
                }
            });

            // Si solo hay una liga, seleccionarla automáticamente
            if (filteredLigas.length === 1 && filteredLigas[0].ligas) {
                select.value = filteredLigas[0].ligas.id;
                loadDashboardClassification(filteredLigas[0].ligas.id);
            }
        } else {
            select.innerHTML = '<option value="">No perteneces a ninguna liga</option>';
            const ligasEl = document.getElementById('dashboard-top-ligas');
            if (ligasEl) {
                ligasEl.innerHTML = '<p class="no-data">No estás en ninguna liga</p>';
            }
        }
    } catch (error) {
        console.error('Error cargando ligas para clasificación:', error);
        const select = document.getElementById('dashboard-classification-liga-select');
        if (select) {
            select.innerHTML = '<option value="">Error al cargar ligas</option>';
        }
    }
}

async function loadDashboardTopLigas(ligaId = null) {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    // Si no se proporciona ligaId, intentar obtenerlo del selector
    if (!ligaId) {
        const select = document.getElementById('dashboard-classification-liga-select');
        ligaId = select ? parseInt(select.value) : null;
    }

    // Si no hay liga seleccionada, no cargar clasificación
    if (!ligaId) {
        const ligasEl = document.getElementById('dashboard-top-ligas');
        if (ligasEl) {
            ligasEl.innerHTML = '<p class="no-data">Selecciona una liga para ver la clasificación</p>';
        }
        return;
    }

    await loadDashboardClassification(ligaId);
}

// Función para cargar la clasificación de una liga en el dashboard
async function loadDashboardClassification(ligaId) {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    const container = document.getElementById('dashboard-top-ligas');
    if (!container) return;

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        // Obtener miembros de la liga con sus puntos totales
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
            container.innerHTML = '<p class="no-data">Esta liga no tiene miembros</p>';
            return;
        }

        // Crear array de usuarios con sus puntos y ordenar por puntos (descendente)
        const classification = (data || [])
            .map(member => ({
                userId: member.user_id,
                name: member.users?.name || 'Usuario',
                points: member.users?.total_points || 0
            }))
            .sort((a, b) => b.points - a.points);

        // Obtener posiciones anteriores desde localStorage
        const storageKey = `classification_positions_liga_${ligaId}`;
        const previousPositions = JSON.parse(localStorage.getItem(storageKey) || '{}');

        // Crear mapa de posiciones actuales por userId
        const currentPositions = {};
        classification.forEach((user, index) => {
            currentPositions[user.userId] = index + 1;
        });

        // Función para determinar el cambio de posición
        const getPositionChange = (userId) => {
            const currentPos = currentPositions[userId];
            const previousPos = previousPositions[userId];
            
            if (!previousPos || previousPos === 0) {
                // Primera vez que se carga, no hay comparación
                return 'same';
            }
            
            if (currentPos < previousPos) {
                // Subió de posición (número menor = mejor posición)
                return 'up';
            } else if (currentPos > previousPos) {
                // Bajó de posición (número mayor = peor posición)
                return 'down';
            } else {
                // Se mantuvo igual
                return 'same';
            }
        };

        // Guardar las posiciones actuales para la próxima vez
        localStorage.setItem(storageKey, JSON.stringify(currentPositions));

        // Renderizar clasificación (solo mostrar top 10 para el dashboard)
        const topClassification = classification.slice(0, 10);
        
        container.innerHTML = `
            <div class="dashboard-classification-table">
                ${topClassification.map((user, index) => {
                    const position = index + 1;
                    const isCurrentUser = user.userId === currentUser.id;
                    const positionChange = getPositionChange(user.userId);
                    
                    // Determinar el icono y clase según el cambio
                    let changeIcon = '';
                    let changeClass = '';
                    
                    if (positionChange === 'up') {
                        changeIcon = '<i class="fas fa-arrow-up"></i>';
                        changeClass = 'position-change-up';
                    } else if (positionChange === 'down') {
                        changeIcon = '<i class="fas fa-arrow-down"></i>';
                        changeClass = 'position-change-down';
                    } else {
                        changeIcon = '<i class="fas fa-minus"></i>';
                        changeClass = 'position-change-same';
                    }
                    
                    return `
                        <div class="classification-row ${isCurrentUser ? 'current-user' : ''}">
                            <span class="position">
                                ${position}
                                ${previousPositions[user.userId] ? `<span class="position-change ${changeClass}">${changeIcon}</span>` : ''}
                            </span>
                            <span class="user-name">${escapeHtml(user.name)}</span>
                            <span class="points">${user.points} pts</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Error cargando clasificación:', error);
        container.innerHTML = '<p class="no-data">Error al cargar la clasificación</p>';
    }
}

// Función para manejar cambio de liga en clasificación del dashboard
function onDashboardClassificationLigaChange() {
    const select = document.getElementById('dashboard-classification-liga-select');
    if (select && select.value) {
        loadDashboardClassification(parseInt(select.value));
    } else {
        loadDashboardTopLigas(null);
    }
}

async function loadDashboardActivity() {
    if (!currentUser) return;
    
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Intentar obtener últimas noticias desde la tabla 'noticias'
        // Si la tabla no existe, manejar el error graciosamente
        const { data: news, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('noticias')
                .select('id, titulo, contenido, autor, created_at')
                .order('created_at', { ascending: false })
                .limit(5)
        , 8000).catch((err) => {
            // Si la tabla no existe, retornar datos vacíos
            if (err.code === '42P01' || err.message?.includes('does not exist')) {
                return { data: [], error: null };
            }
            return { data: [], error: err };
        });

        const activityEl = document.getElementById('dashboard-recent-activity');
        if (activityEl) {
            // Si no hay noticias o hay error (tabla no existe), mostrar mensaje
            if (!news || news.length === 0 || error) {
                activityEl.innerHTML = '<p class="no-data">Aún no hay noticias disponibles</p>';
            } else {
                activityEl.innerHTML = news.map(item => {
                    const date = new Date(item.created_at);
                    const dateStr = date.toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    // Limitar el contenido a 150 caracteres
                    const preview = item.contenido && item.contenido.length > 150 
                        ? item.contenido.substring(0, 150) + '...' 
                        : item.contenido || '';

                    return `
                        <div class="activity-item news-item">
                            <div class="news-header">
                                <h4 class="news-title">${escapeHtml(item.titulo || 'Sin título')}</h4>
                                <span class="news-date">${dateStr}</span>
                            </div>
                            <p class="news-content">${escapeHtml(preview)}</p>
                            ${item.autor ? `<span class="news-author">Por ${escapeHtml(item.autor)}</span>` : ''}
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (error) {
        console.error('Error cargando noticias:', error);
        const activityEl = document.getElementById('dashboard-recent-activity');
        if (activityEl) {
            activityEl.innerHTML = '<p class="no-data">Error al cargar noticias</p>';
        }
    }
}

// Función auxiliar para escapar HTML (si no existe ya)
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Funciones de navegación rápida
function goToPronosticos() {
    document.querySelector('.nav-link[data-page="pronosticos"]')?.click();
}

function goToNoticias() {
    document.querySelector('.nav-link[data-page="noticias"]')?.click();
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
    window.goToNoticias = goToNoticias;
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
        const supabase = getSupabase();
        if (!supabase) {
            activeJornada = 1;
            currentJornada = 1;
            updateJornadaDisplay();
            return;
        }

        // Calcular automáticamente la jornada activa basándose en la fecha actual
        // La jornada activa es la primera jornada futura o la jornada actual si hay partidos hoy
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Resetear a medianoche para comparar solo fechas

        // Obtener todas las jornadas con partidos de la competición activa
        let matchesQuery = supabase
            .from('matches')
            .select('jornada, match_date')
            .order('jornada', { ascending: true })
            .order('match_date', { ascending: true });

        // Filtrar por competición activa si existe
        try {
            if (currentCompetitionId) {
                matchesQuery = matchesQuery.eq('competition_id', currentCompetitionId);
            }
        } catch (e) {
            console.warn('⚠️ Columna competition_id no existe en matches');
        }

        const { data: matches, error } = await executeQueryWithTimeout(() => matchesQuery, 5000).catch(() => ({ data: [], error: null }));

        if (error) {
            console.warn('⚠️ Error obteniendo partidos para calcular jornada activa:', error);
            activeJornada = 1;
            currentJornada = 1;
            updateJornadaDisplay();
            return;
        }

        if (!matches || matches.length === 0) {
            // Si no hay partidos, usar jornada 1 por defecto
            activeJornada = 1;
            currentJornada = 1;
            updateJornadaDisplay();
            return;
        }

        // Encontrar la jornada más próxima a la fecha actual
        let nextJornada = 1;
        for (const match of matches) {
            const matchDate = new Date(match.match_date);
            matchDate.setHours(0, 0, 0, 0);
            
            // Si el partido es hoy o futuro, esa es la jornada activa
            if (matchDate >= now) {
                nextJornada = match.jornada;
                break;
            }
        }

        // Si no encontramos una jornada futura, usar la última jornada
        if (nextJornada === 1 && matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const lastMatchDate = new Date(lastMatch.match_date);
            lastMatchDate.setHours(0, 0, 0, 0);
            
            if (lastMatchDate < now) {
                // Todas las jornadas son pasadas, usar la última
                const jornadas = [...new Set(matches.map(m => m.jornada))];
                nextJornada = Math.max(...jornadas);
            }
        }

        activeJornada = nextJornada;
        currentJornada = nextJornada;
        console.log(`✅ Jornada activa calculada: ${nextJornada}`);
        
        updateJornadaDisplay();
    } catch (error) {
        console.warn('⚠️ Error calculando jornada activa, usando valor por defecto:', error);
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
// GESTIÓN DE COMPETICIONES
// ========================================
/**
 * Cargar competición activa desde config o localStorage
 */
async function loadActiveCompetition() {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('⚠️ Supabase no disponible');
        return;
    }

    try {
        // Primero, verificar cuántas competiciones activas hay
        const { data: activeCompetitions, error: countError } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('id, name, is_active')
                .eq('is_active', true)
        , 5000).catch(() => ({ data: [], error: null }));

        if (countError) {
            console.warn('⚠️ Error contando competiciones activas:', countError);
        }

        // Si hay más de una competición activa, SIEMPRE mostrar modal para seleccionar
        if (activeCompetitions && activeCompetitions.length > 1) {
            console.log(`📊 ${activeCompetitions.length} competiciones activas encontradas, mostrando selector`);
            
            // Verificar si hay una competición guardada válida (solo para mostrar como seleccionada en el modal)
            const { data: configData } = await executeQueryWithTimeout(() =>
                supabase
                    .from('config')
                    .select('value')
                    .eq('key', 'active_competition_id')
                    .single()
            , 5000).catch(() => ({ data: null }));
            
            // Cuando hay múltiples competiciones activas, SIEMPRE mostrar el modal cada vez que el usuario inicia sesión
            // NO usar ninguna competición guardada, usar la primera activa temporalmente solo para mostrar datos iniciales
            currentCompetitionId = activeCompetitions[0].id;
            await loadCompetitionData(currentCompetitionId);
            console.log(`✅ Usando primera competición activa temporalmente: ${currentCompetition?.name}, mostrando modal para que usuario seleccione`);
            
            // SIEMPRE mostrar modal sobre el dashboard (que ya está visible)
            // El usuario debe seleccionar cada vez que inicia sesión
            await showCompetitionSelectorModal();
            return true;
        }

        // Si hay 0 o 1 competición activa, usar la única disponible (sin guardar para próxima sesión)
        if (activeCompetitions && activeCompetitions.length === 1) {
            // Solo una competición activa, cargarla automáticamente sin modal
            currentCompetitionId = activeCompetitions[0].id;
            await loadCompetitionData(currentCompetitionId);
            console.log(`✅ Una sola competición activa: ${currentCompetition?.name}, cargando automáticamente`);
            return true;
        } else if (activeCompetitions && activeCompetitions.length === 0) {
            console.warn('⚠️ No hay competiciones activas');
            return true;
        }
        
        // Retornar true si se cargó una competición correctamente
        return true;
        
    } catch (error) {
        console.warn('⚠️ Error cargando competición activa:', error);
        return false;
    }
}

/**
 * Cargar datos de la competición activa
 */
async function loadCompetitionData(competitionId) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('*')
                .eq('id', competitionId)
                .single()
        , 5000).catch(() => ({ data: null, error: null }));

        if (data && !error) {
            currentCompetition = data;
        } else {
            // Si no existe, usar valores por defecto
            currentCompetition = {
                id: competitionId,
                name: 'La Liga',
                slug: 'la-liga'
            };
        }
        
        // Actualizar nombre de competición en el header
        updateNavCompetitionName();
    } catch (error) {
        console.warn('⚠️ Error cargando datos de competición:', error);
        currentCompetition = {
            id: competitionId,
            name: 'La Liga',
            slug: 'la-liga'
        };
        updateNavCompetitionName();
    }
}

/**
 * Actualizar el nombre de la competición en el header
 */
function updateNavCompetitionName() {
    const navCompetitionEl = document.getElementById('nav-competition-name');
    if (navCompetitionEl && currentCompetition) {
        navCompetitionEl.textContent = currentCompetition.name;
    } else if (navCompetitionEl) {
        navCompetitionEl.textContent = 'Seleccionar';
    }
}

/**
 * Mostrar modal de selección de competición
 */
async function showCompetitionSelectorModal() {
    console.log('🔍 Intentando mostrar modal de selección de competición');
    const modal = document.getElementById('competition-selector-modal');
    if (!modal) {
        console.error('❌ Modal de selección de competición no encontrado en el DOM');
        return;
    }

    // Cerrar otros modales pero NO este
    document.querySelectorAll('.modal').forEach(m => {
        if (m.id !== 'competition-selector-modal') {
            m.classList.remove('active');
        }
    });

    console.log('✅ Modal encontrado, cargando competiciones...');
    // Cargar competiciones en el modal
    await loadCompetitionsForModal();

    // Mostrar modal (no se puede cerrar hasta seleccionar una competición)
    modal.classList.add('active');
    modal.style.display = 'flex'; // Forzar display para asegurar visibilidad
    console.log('✅ Modal marcado como activo, clases:', modal.className);
    
    // Verificar que se haya añadido la clase
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            console.error('❌ La clase active no se añadió al modal, reintentando...');
            // Intentar forzar de nuevo
            modal.classList.add('active');
            modal.style.display = 'flex';
        } else {
            console.log('✅ Modal activo correctamente, visible:', modal.style.display);
        }
    }, 100);
}

/**
 * Cargar competiciones en el modal de selección (solo activas)
 */
async function loadCompetitionsForModal() {
    const container = document.getElementById('competitions-list-modal');
    if (!container) {
        console.error('❌ Container competitions-list-modal no encontrado');
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando competiciones...</div>';

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = '<p style="color: var(--red-500); text-align: center;">Error de conexión</p>';
        return;
    }

    try {
        // Cargar competiciones activas
        const { data: competitions, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('id, name, description, is_active')
                .eq('is_active', true)
                .order('id', { ascending: true })
        , 5000).catch(() => ({ data: null, error: null }));

        if (error) {
            console.error('Error cargando competiciones:', error);
            container.innerHTML = '<p style="color: var(--red-500); text-align: center;">Error al cargar competiciones</p>';
            return;
        }

        if (!competitions || competitions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No hay competiciones disponibles</h3>
                    <p>Por favor, contacta al administrador.</p>
                </div>
            `;
            return;
        }

        // Renderizar tarjetas de competiciones
        let html = '';
        
        // Si el usuario es admin, añadir tarjeta de Panel de Administración al principio
        if (isAdmin) {
            html += `
            <div class="competition-card-modal admin-panel-card" onclick="openAdminDashboardFromSelector()">
                <div class="competition-card-icon" style="background: linear-gradient(135deg, var(--purple-500), var(--purple-600));">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="competition-card-content">
                    <h3>Panel de Administración</h3>
                    <p>Gestiona competiciones, partidos, usuarios y más</p>
                </div>
                <div class="competition-card-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
            `;
        }
        
        // Añadir competiciones
        html += competitions.map(comp => {
            const isSelected = comp.id === currentCompetitionId;
            return `
            <div class="competition-card-modal ${isSelected ? 'selected' : ''}" onclick="selectCompetition(${comp.id}, '${escapeHtml(comp.name)}')">
                <div class="competition-card-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="competition-card-content">
                    <h3>${escapeHtml(comp.name)}${isSelected ? ' <span style="color: var(--blue-500); font-size: 14px;">(Actual)</span>' : ''}</h3>
                    ${comp.description ? `<p>${escapeHtml(comp.description)}</p>` : ''}
                </div>
                <div class="competition-card-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
        }).join('');
        
        container.innerHTML = html;

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: var(--red-500); text-align: center;">Error al cargar competiciones</p>';
    }
}

/**
 * Seleccionar una competición desde el modal
 */
async function selectCompetition(competitionId, competitionName) {
    const supabase = getSupabase();
    if (!supabase) {
        showNotification('Error de conexión', 'error');
        return;
    }

    try {
        // Guardar competición seleccionada (solo para esta sesión, NO guardar para próxima sesión)
        currentCompetitionId = competitionId;
        // NO llamar a saveActiveCompetitionToConfig para que el modal aparezca cada vez
        await loadCompetitionData(competitionId);

        // Cerrar modal - quitar clase y resetear display
        const modal = document.getElementById('competition-selector-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = ''; // Resetear display para que el CSS lo oculte
            console.log('✅ Modal cerrado, clases:', modal.className, 'display:', modal.style.display);
        }

        showNotification(`Competición seleccionada: ${competitionName}`, 'success');
        
        // Actualizar nombre en el header
        updateNavCompetitionName();

        // Recargar datos según la página actual (el dashboard ya está visible)
        const activePage = document.querySelector('.section.active')?.id;
        
        if (activePage === 'dashboard-section') {
            if (typeof loadDashboard === 'function') {
                loadDashboard();
            }
        } else if (activePage === 'pronosticos-section') {
            if (typeof loadPronosticosLigaSelector === 'function') {
                loadPronosticosLigaSelector();
            }
        } else if (activePage === 'clasificaciones-section') {
            if (typeof loadLigasForSelect === 'function') {
                loadLigasForSelect();
            }
        } else if (activePage === 'admin-section') {
            if (typeof loadAdminData === 'function') {
                loadAdminData();
            }
        } else {
            // Si no hay página activa, cargar dashboard
            if (typeof loadDashboard === 'function') {
                loadDashboard();
            }
        }
    } catch (error) {
        console.error('Error seleccionando competición:', error);
        showNotification('Error al seleccionar competición', 'error');
    }
}

/**
 * Guardar competición activa en config y localStorage
 */
async function saveActiveCompetitionToConfig(competitionId) {
    // NO guardar en localStorage/config porque queremos que el modal aparezca cada vez
    // La competición solo se mantiene durante la sesión actual
    // localStorage.setItem('active_competition_id', competitionId.toString()); // COMENTADO: no guardar

    const supabase = getSupabase();
    if (!supabase) return;

    // NO guardar en config para que el modal aparezca cada vez que el usuario inicia sesión
    // Si hay múltiples competiciones activas, el usuario debe seleccionar cada vez
    try {
        // Solo guardar en config si es admin Y queremos persistencia
        // Por ahora, NO guardamos para que aparezca el modal cada vez
        /*
        if (isAdmin) {
            await executeQueryWithTimeout(() =>
                supabase
                    .from('config')
                    .upsert({ 
                        key: 'active_competition_id', 
                        value: competitionId.toString() 
                    }, {
                        onConflict: 'key'
                    })
            , 3000).catch(err => {
                console.warn('⚠️ No se pudo guardar competición activa en config:', err);
            });
        }
        */
    } catch (error) {
        console.warn('⚠️ Error guardando competición activa:', error);
    }
}

/**
 * Cambiar competición (mostrar modal para seleccionar otra)
 */
async function changeCompetition() {
    await showCompetitionSelectorModal();
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

        // Filtrar ligas por competición activa
        const { data: userLigas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('liga_id, ligas(id, name, competition_id)')
                .eq('user_id', currentUser.id)
        , 8000).catch(() => ({ data: [], error: null }));

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

        // Filtrar ligas por competición activa en memoria
        let filteredLigas = userLigas || [];
        if (userLigas && userLigas.length > 0 && userLigas[0].ligas?.competition_id !== undefined) {
            filteredLigas = userLigas.filter(item => 
                item.ligas && parseInt(item.ligas.competition_id) === currentCompetitionId
            );
        }

        selector.innerHTML = '<option value="">Selecciona una liga</option>';

        if (filteredLigas && filteredLigas.length > 0) {
            filteredLigas.forEach(item => {
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
        // Filtrar por competición activa y jornada
        let query = supabase
            .from('matches')
            .select('*')
            .eq('jornada', currentJornada);
        
        // Filtrar por competition_id si existe la columna (con manejo de errores)
        try {
            query = query.eq('competition_id', currentCompetitionId);
        } catch (e) {
            // Si la columna no existe aún, continuar sin filtrar (compatibilidad)
            console.warn('⚠️ Columna competition_id no existe en matches, cargando todos los partidos');
        }
        
        const result = await executeQueryWithTimeout(() => 
            query.order('match_date', { ascending: true })
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
            console.log('📋 IDs de partidos con predicciones:', Object.keys(userPredictions).join(', '));
            console.log('📋 IDs de partidos a renderizar:', matches.map(m => parseInt(m.id)).join(', '));
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
        
        // Verificar que los selectores estén habilitados/deshabilitados correctamente
        // Usar la misma lógica que createMatchCard para mantener consistencia
        let enabledCount = 0;
        let disabledCount = 0;
        const MARGIN_MINUTES = 5;
        const marginMs = MARGIN_MINUTES * 60 * 1000;
        
        matches.forEach(match => {
            let matchDate;
            try {
                const dateStr = String(match.match_date);
                // Parsear fecha igual que en createMatchCard
                if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
                    matchDate = new Date(dateStr + 'Z');
                } else {
                    matchDate = new Date(dateStr);
                }
                if (isNaN(matchDate.getTime())) {
                    if (!dateStr.includes('Z') && !dateStr.includes('+')) {
                        matchDate = new Date(dateStr + 'Z');
                    } else {
                        matchDate = new Date(dateStr);
                    }
                }
                if (isNaN(matchDate.getTime())) {
                    matchDate = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Fallback: mañana
                }
            } catch (e) {
                matchDate = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Fallback: mañana
            }
            
            const now = new Date();
            const matchTimestamp = matchDate.getTime();
            const nowTimestamp = now.getTime();
            
            // Usar la MISMA lógica que createMatchCard
            const shouldBeLocked = (matchTimestamp - marginMs) <= nowTimestamp;
            
            const homeSelect = document.getElementById(`home-${match.id}`);
            const awaySelect = document.getElementById(`away-${match.id}`);
            
            if (homeSelect && awaySelect) {
                const isActuallyDisabled = homeSelect.disabled || awaySelect.disabled;
                
                if (shouldBeLocked && !isActuallyDisabled) {
                    console.warn(`⚠️ Partido ${match.id} debería estar bloqueado pero los selectores están habilitados`, {
                        matchDate: matchDate.toISOString(),
                        now: now.toISOString(),
                        diffMinutes: Math.round((matchTimestamp - nowTimestamp) / (60 * 1000))
                    });
                    // Forzar bloqueo si corresponde
                    homeSelect.disabled = true;
                    awaySelect.disabled = true;
                } else if (!shouldBeLocked && isActuallyDisabled) {
                    const diffMinutes = Math.round((matchTimestamp - nowTimestamp) / (60 * 1000));
                    console.error(`❌ Partido ${match.id} NO debería estar bloqueado pero los selectores están deshabilitados!`, {
                        matchDate: matchDate.toISOString(),
                        matchDateLocal: matchDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
                        now: now.toISOString(),
                        nowLocal: now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
                        diffMinutes: diffMinutes,
                        diffHours: (diffMinutes / 60).toFixed(1),
                        diffDays: (diffMinutes / (60 * 24)).toFixed(1)
                    });
                    // Forzar habilitación si el partido es futuro
                    homeSelect.disabled = false;
                    awaySelect.disabled = false;
                    homeSelect.removeAttribute('disabled');
                    awaySelect.removeAttribute('disabled');
                    
                    // También remover la clase locked de la fila si existe
                    const row = document.querySelector(`[data-match-id="${match.id}"]`);
                    if (row) {
                        row.classList.remove('locked');
                    }
                    enabledCount++;
                }
                
                if (homeSelect.disabled || awaySelect.disabled) disabledCount++;
                else enabledCount++;
            }
        });
        console.log(`📊 Selectores: ${enabledCount} habilitados, ${disabledCount} deshabilitados`);
        
        // Verificar que las predicciones se aplicaron correctamente y corregir si es necesario
        let appliedCount = 0;
        let correctedCount = 0;
        matches.forEach(match => {
            // Normalizar match.id a número para consistencia
            const matchId = parseInt(match.id);
            const homeSelect = document.getElementById(`home-${matchId}`);
            const awaySelect = document.getElementById(`away-${matchId}`);
            const prediction = userPredictions[matchId];
            
            if (prediction && homeSelect && awaySelect) {
                const savedHome = prediction.home_prediction;
                const savedAway = prediction.away_prediction;
                const currentHome = homeSelect.value === '' ? null : parseInt(homeSelect.value);
                const currentAway = awaySelect.value === '' ? null : parseInt(awaySelect.value);
                
                // Verificar si los valores coinciden
                if (currentHome === savedHome && currentAway === savedAway) {
                    appliedCount++;
                } else {
                    console.warn(`⚠️ Predicción no aplicada para partido ${matchId}:`, {
                        saved: `${savedHome}-${savedAway}`,
                        shown: `${currentHome}-${currentAway}`,
                        homeSelectValue: homeSelect.value,
                        awaySelectValue: awaySelect.value
                    });
                    
                    // Intentar corregir los valores
                    if (savedHome !== null && savedHome !== undefined) {
                        homeSelect.value = savedHome.toString();
                        correctedCount++;
                    }
                    if (savedAway !== null && savedAway !== undefined) {
                        awaySelect.value = savedAway.toString();
                        correctedCount++;
                    }
                    
                    // Añadir clase 'has-value' si tiene valor
                    if (savedHome !== null && savedHome !== undefined) {
                        homeSelect.classList.add('has-value');
                    } else {
                        homeSelect.classList.remove('has-value');
                    }
                    if (savedAway !== null && savedAway !== undefined) {
                        awaySelect.classList.add('has-value');
                    } else {
                        awaySelect.classList.remove('has-value');
                    }
                }
            }
        });
        
        if (correctedCount > 0) {
            console.log(`🔧 Corregidas ${correctedCount} predicciones que no se aplicaron correctamente`);
        }
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
            // Si el error es que la columna liga_id no existe, intentar sin filtrar por liga_id
            if (queryError.code === '42703' || (queryError.message && (queryError.message.includes('liga_id') || queryError.message.includes('column predictions.liga_id') || queryError.message.includes('does not exist')))) {
                console.warn('⚠️ La columna liga_id no existe en la tabla predictions. Cargando predicciones sin filtrar por liga.');
                // Intentar cargar sin filtrar por liga_id
                result = await executeQueryWithTimeout(() => 
                    supabase
                        .from('predictions')
                        .select('*')
                        .eq('user_id', currentUser.id)
                , 8000);
                
                // Filtrar en memoria si es necesario (aunque probablemente no haya liga_id)
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
                // Normalizar match_id a número para asegurar consistencia
                const matchId = parseInt(pred.match_id);
                
                // Asegurar que los valores de predicción sean números
                userPredictions[matchId] = {
                    ...pred,
                    match_id: matchId, // Normalizar también en el objeto
                    home_prediction: pred.home_prediction !== null && pred.home_prediction !== undefined ? parseInt(pred.home_prediction) : null,
                    away_prediction: pred.away_prediction !== null && pred.away_prediction !== undefined ? parseInt(pred.away_prediction) : null
                };
                console.log(`  ✅ Cargada predicción para partido ${matchId} (tipo: ${typeof matchId}): ${userPredictions[matchId].home_prediction} - ${userPredictions[matchId].away_prediction} (liga: ${pred.liga_id || 'N/A'})`);
            });
        } else {
            console.log('  (Sin predicciones guardadas para esta liga)');
        }
        
        console.log('✅ Total predicciones cargadas:', Object.keys(userPredictions).length);
        console.log('📋 IDs de partidos con predicciones:', Object.keys(userPredictions).join(', '));
    } catch (error) {
        console.error('❌ Error cargando predicciones:', error);
        userPredictions = {};
    }
}

function createMatchCard(match) {
    // Normalizar match.id a número para asegurar consistencia con userPredictions
    const matchId = parseInt(match.id);
    const prediction = userPredictions[matchId] || {};
    
    // Debug: Verificar si hay predicción para este partido
    if (Object.keys(prediction).length > 0) {
        console.log(`🎯 Partido ${matchId} tiene predicción cargada:`, {
            home: prediction.home_prediction,
            away: prediction.away_prediction,
            homeType: typeof prediction.home_prediction,
            awayType: typeof prediction.away_prediction,
            homeIsNull: prediction.home_prediction === null,
            awayIsNull: prediction.away_prediction === null
        });
    } else {
        console.log(`⚠️ Partido ${matchId} NO tiene predicción en userPredictions. Claves disponibles:`, Object.keys(userPredictions).join(', '));
    }
    
    // Asegurar que la fecha se parsea correctamente
    let matchDate;
    try {
        const dateStr = String(match.match_date);
        
        // Si la fecha viene en formato ISO sin Z, asumir que es UTC
        // Si tiene Z o offset, usar directamente
        if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
            // Formato ISO sin timezone: añadir Z para UTC
            matchDate = new Date(dateStr + 'Z');
        } else {
            // Intentar parsear directamente
            matchDate = new Date(dateStr);
        }
        
        // Si la fecha no es válida después del primer intento
        if (isNaN(matchDate.getTime())) {
            // Intentar añadir Z si no lo tiene
            if (!dateStr.includes('Z') && !dateStr.includes('+')) {
                matchDate = new Date(dateStr + 'Z');
            } else {
                matchDate = new Date(dateStr);
            }
        }
        
        // Si aún no es válida, usar fallback
        if (isNaN(matchDate.getTime())) {
            console.error(`❌ No se pudo parsear la fecha del partido ${match.id}: ${match.match_date}`);
            // Si no se puede parsear, asumir que es futuro para no bloquearlo incorrectamente
            matchDate = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Mañana como fallback
        }
        
        // Corregir fechas obviamente incorrectas (años < 2020)
        // Si el año es menor a 2020, probablemente es un error de parsing (1925 en lugar de 2025)
        const year = matchDate.getFullYear();
        if (year < 2020) {
            console.warn(`⚠️ Fecha con año incorrecto detectada (${year}) para partido ${match.id}. Corrigiendo a 2025...`);
            // Extraer día, mes, hora y minutos, y crear nueva fecha con año 2025
            const month = matchDate.getMonth();
            const day = matchDate.getDate();
            const hours = matchDate.getHours();
            const minutes = matchDate.getMinutes();
            
            // Crear nueva fecha con año 2025
            matchDate = new Date(2025, month, day, hours, minutes, 0);
            
            // Si aún es inválida, intentar con año actual
            if (isNaN(matchDate.getTime())) {
                const currentYear = new Date().getFullYear();
                matchDate = new Date(currentYear, month, day, hours, minutes, 0);
            }
        }
    } catch (e) {
        console.error(`❌ Error parseando fecha del partido ${match.id}:`, e);
        // Si hay error, asumir que es futuro para no bloquearlo incorrectamente
        matchDate = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Mañana como fallback
    }
    
    const now = new Date();
    
    // Un partido está finalizado si tiene resultados
    const isFinished = match.home_score !== null && match.away_score !== null;
    
    // Comparar fechas usando timestamps (ambos en UTC internamente)
    // getTime() devuelve milisegundos desde epoch UTC, por lo que la comparación es correcta
    const matchTimestamp = matchDate.getTime();
    const nowTimestamp = now.getTime();
    
    // Añadir un margen de 5 minutos antes del inicio para permitir cambios de último minuto
    const MARGIN_MINUTES = 5;
    const marginMs = MARGIN_MINUTES * 60 * 1000;
    
    // Bloquear SOLO si la fecha/hora del partido YA pasó (con margen de 5 minutos)
    // Un partido está bloqueado si: (hora del partido - margen) <= hora actual
    // Si el partido es en el futuro: matchTimestamp > nowTimestamp, entonces NO está bloqueado
    // Si el partido es en el pasado: matchTimestamp < nowTimestamp, entonces SÍ está bloqueado
    const isLocked = (matchTimestamp - marginMs) <= nowTimestamp;
    
    // Debug: Log para verificar fechas
    const diffMinutes = Math.round((matchTimestamp - nowTimestamp) / (60 * 1000));
    const diffHours = (diffMinutes / 60).toFixed(1);
    const diffDays = (diffMinutes / (60 * 24)).toFixed(1);
    
    // Loggear información del partido para depuración
    console.log(`🔍 Partido ${match.id} (${match.home_team} vs ${match.away_team}):`, {
        fechaOriginal: match.match_date,
        matchDateISO: matchDate.toISOString(),
        matchDateLocal: matchDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        nowISO: now.toISOString(),
        nowLocal: now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        diffMinutes: diffMinutes,
        diffHours: diffHours + ' horas',
        diffDays: diffDays + ' días',
        tiempoRestante: diffMinutes > 0 ? `Faltan ${diffMinutes} minutos (${diffHours}h)` : `Hace ${Math.abs(diffMinutes)} minutos`,
        isLocked: isLocked ? '🔒 BLOQUEADO' : '✅ DISPONIBLE',
        isFinished: isFinished ? 'Finalizado' : 'Pendiente',
        marginApplied: `${MARGIN_MINUTES} minutos antes del inicio`
    });

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
        // Tiene valor si es un número (incluido 0) y no es null/undefined
        const hasValue = selectedValue !== null && selectedValue !== undefined && !isNaN(selectedValue);
        const numValue = hasValue ? parseInt(selectedValue) : null;
        
        // Debug: Log para verificar el valor
        if (hasValue) {
            console.log(`  🎯 Generando opciones para valor: ${numValue} (tipo: ${typeof selectedValue}, original: ${selectedValue})`);
        }
        
        // Opción vacía "-" como primera opción
        let options = `<option value="" ${!hasValue ? 'selected' : ''}>-</option>`;
        
        // Opciones 0-9
        for (let i = 0; i <= 9; i++) {
            const isSelected = hasValue && numValue === i;
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
        <div class="match-row ${isLocked ? 'locked' : ''} ${isFinished ? 'finished' : ''}" data-match-id="${matchId}" ${match.fixture_id || match.api_football_id ? `data-fixture-id="${match.fixture_id || match.api_football_id}"` : ''}>
            <span class="col-jornada">${match.jornada}</span>
            <span class="col-fecha">${formatDate(matchDate)}</span>
            <span class="col-hora">${formatTime(matchDate)}</span>
            <span class="col-local">${match.home_team}</span>
            <span class="col-goles">
                <select class="goal-select ${prediction.home_prediction !== undefined && prediction.home_prediction !== null ? 'has-value' : ''}" 
                        id="home-${matchId}" 
                        ${isLocked ? 'disabled title="Este partido ya ha comenzado. No se pueden modificar los pronósticos."' : 'title="Selecciona goles del equipo local"'} 
                        onchange="markPredictionChanged(${matchId})">
                    ${generateScoreOptions(prediction.home_prediction)}
                </select>
            </span>
            <span class="col-goles">
                <select class="goal-select ${prediction.away_prediction !== undefined && prediction.away_prediction !== null ? 'has-value' : ''}" 
                        id="away-${matchId}" 
                        ${isLocked ? 'disabled title="Este partido ya ha comenzado. No se pueden modificar los pronósticos."' : 'title="Selecciona goles del equipo visitante"'} 
                        onchange="markPredictionChanged(${matchId})">
                    ${generateScoreOptions(prediction.away_prediction)}
                </select>
            </span>
            <span class="col-visitante">${match.away_team}</span>
            <span class="col-resultado">
                ${isFinished ? `
                    <span class="result-final">${match.home_score} - ${match.away_score}</span>
                    ${pointsEarned !== null ? `<span class="result-points">${pointsEarned}pts</span>` : ''}
                ` : (isLocked ? '<span class="locked-badge" title="Partido bloqueado"><i class="fas fa-lock"></i></span>' : '-')}
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

    // Obtener liga seleccionada
    const ligaSelect = document.getElementById('pronosticos-liga-select');
    if (!ligaSelect || !ligaSelect.value) {
        showNotification('Debes seleccionar una liga primero', 'error');
        return;
    }

    const ligaId = parseInt(ligaSelect.value);
    
    try {
        // Obtener IDs de partidos de esta jornada
        const matchIds = Array.from(document.querySelectorAll('.match-row'))
            .map(row => parseInt(row.dataset.matchId))
            .filter(id => !isNaN(id));
        
        if (matchIds.length === 0) {
            showNotification('No hay partidos para eliminar', 'warning');
            return;
        }

        console.log('🗑️ Eliminando predicciones para partidos:', matchIds, 'en liga:', ligaId);
        
        // Eliminar predicciones de la base de datos (SOLO DE ESTA LIGA)
        const supabase = window.supabase || window.supabaseClient;
        if (!supabase) {
            showNotification('Error: No se pudo conectar con la base de datos', 'error');
            return;
        }

        const { error } = await executeQueryWithTimeout(() =>
            supabase
                .from('predictions')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('liga_id', ligaId)  // IMPORTANTE: Solo eliminar predicciones de esta liga
                .in('match_id', matchIds)
        , 10000);
        
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
        // Normalizar matchId a número para consistencia
        const matchId = parseInt(row.dataset.matchId);
        const homeSelect = document.getElementById(`home-${matchId}`);
        const awaySelect = document.getElementById(`away-${matchId}`);

        console.log(`💾 Partido ${matchId} (tipo: ${typeof matchId}):`, homeSelect?.value, '-', awaySelect?.value);

        if (homeSelect && awaySelect && homeSelect.value !== '' && awaySelect.value !== '') {
            predictions.push({
                user_id: currentUser.id,
                match_id: matchId, // Ya está normalizado
                liga_id: ligaId,
                home_prediction: parseInt(homeSelect.value),
                away_prediction: parseInt(awaySelect.value)
            });
            console.log(`  ✅ Añadido a lista: match_id=${matchId}, home=${homeSelect.value}, away=${awaySelect.value}`);
        } else {
            console.log(`  ⚠️ Partido ${matchId} omitido: selectores no disponibles o valores vacíos`);
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
        // Filtrar ligas por competición activa
        const { data: userLigas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('liga_id, ligas(id, name, competition_id)')
                .eq('user_id', currentUser.id)
        , 8000).catch(() => ({ data: [], error: null }));

        if (error) throw error;

        // Filtrar ligas por competición activa en memoria
        let filteredLigas = userLigas || [];
        if (userLigas && userLigas.length > 0 && userLigas[0].ligas?.competition_id !== undefined) {
            filteredLigas = userLigas.filter(item => 
                item.ligas && parseInt(item.ligas.competition_id) === currentCompetitionId
            );
        }

        const select = document.getElementById('liga-select');
        const selectorContainer = document.querySelector('.liga-selector');
        
        if (!select || !selectorContainer) return;

        // Si solo hay una liga, ocultar el selector y cargar automáticamente
        if (filteredLigas && filteredLigas.length === 1 && filteredLigas[0].ligas) {
            selectorContainer.style.display = 'none';
            select.value = filteredLigas[0].ligas.id;
            loadLigaClassification();
            return;
        }

        // Si hay más de una liga, mostrar el selector
        selectorContainer.style.display = 'block';
        select.innerHTML = '<option value="">Selecciona una liga</option>';
        
        if (filteredLigas && filteredLigas.length > 0) {
            filteredLigas.forEach(item => {
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

        // Obtener predicciones con puntos agrupadas por jornada (FILTRADAS POR LIGA)
        const predictionsResult = await executeQueryWithTimeout(() => 
            supabase
                .from('predictions')
                .select('user_id, points, matches(jornada)')
                .in('user_id', data.map(m => m.user_id))
                .eq('liga_id', ligaId)  // IMPORTANTE: Filtrar por liga_id
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

        // Calcular puntos por usuario y jornada (SOLO PARA ESTA LIGA)
        const userPoints = {};
        data.forEach(member => {
            const userId = member.user_id;
            userPoints[userId] = {
                name: member.users?.name || 'Usuario',
                total: 0,  // Se calculará sumando solo predicciones de esta liga
                jornadas: {}
            };
            jornadasConResultados.forEach(j => {
                userPoints[userId].jornadas[j] = 0;
            });
        });

        // Sumar puntos por jornada (solo predicciones de esta liga)
        predictions.forEach(pred => {
            if (userPoints[pred.user_id] && pred.matches?.jornada) {
                const puntos = pred.points || 0;
                userPoints[pred.user_id].jornadas[pred.matches.jornada] += puntos;
                userPoints[pred.user_id].total += puntos;  // Sumar al total de la liga
            }
        });

        // Ordenar por total de esta liga (no por total_points global)
        const sortedData = data.sort((a, b) => {
            const totalA = userPoints[a.user_id]?.total || 0;
            const totalB = userPoints[b.user_id]?.total || 0;
            return totalB - totalA;
        });

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
        // Filtrar ligas por competición activa
        const { data, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select(`
                    liga_id,
                    ligas (
                        id,
                        name,
                        description,
                        code,
                        created_by,
                        competition_id
                    )
                `)
                .eq('user_id', currentUser.id)
        , 8000).catch(() => ({ data: [], error: null }));
        
        // Filtrar ligas por competición activa en memoria
        let filteredData = data || [];
        if (data && data.length > 0 && data[0].ligas?.competition_id !== undefined) {
            filteredData = data.filter(item => 
                item.ligas && parseInt(item.ligas.competition_id) === currentCompetitionId
            );
        }

        if (error) {
            console.error('❌ Error obteniendo ligas:', error);
            throw error;
        }

        if (!filteredData || filteredData.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No estás en ninguna liga</h3>
                    <p>Crea una liga o únete a una existente para la competición "${currentCompetition?.name || 'La Liga'}".</p>
                </div>
            `;
            return;
        }

        // Obtener conteo de miembros para cada liga
        const ligaIds = filteredData.map(item => item.ligas?.id).filter(Boolean);
        const { data: memberCounts } = await supabase
            .from('liga_members')
            .select('liga_id')
            .in('liga_id', ligaIds);

        const counts = {};
        memberCounts?.forEach(m => {
            counts[m.liga_id] = (counts[m.liga_id] || 0) + 1;
        });

        container.innerHTML = filteredData.map(item => {
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
            if (tab === 'partidos') {
                loadAdminPartidosCompetitionSelector();
            } else if (tab === 'resultados') {
                loadAdminResultadosCompetitionSelector();
            } else if (tab === 'competiciones') {
                loadCompetitionsList();
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

async function loadJornadasSelectors(type = 'all') {
    console.log(`📅 loadJornadasSelectors() llamado con tipo: ${type}`);
    
    // Buscar elementos tanto en el modal como en la sección original
    let adminSelect = document.getElementById('admin-jornada-select');
    if (!adminSelect && (type === 'admin' || type === 'all')) {
        adminSelect = document.querySelector('#admin-panel-modal #admin-jornada-select');
    }
    
    let resultsSelect = document.getElementById('results-jornada-select');
    if (!resultsSelect && (type === 'results' || type === 'all')) {
        resultsSelect = document.querySelector('#admin-panel-modal #results-jornada-select');
    }
    
    const supabase = getSupabase();
    if (!supabase) {
        if (type === 'admin' || type === 'all') {
            if (adminSelect) adminSelect.innerHTML = '<option value="">Error de conexión</option>';
        }
        if (type === 'results' || type === 'all') {
            if (resultsSelect) resultsSelect.innerHTML = '<option value="">Error de conexión</option>';
        }
        return;
    }

    try {
        // Obtener la competición seleccionada según el tipo
        let competitionId = null;
        if (type === 'admin') {
            let compSelect = document.getElementById('admin-partidos-competition-select');
            if (!compSelect) {
                compSelect = document.querySelector('#admin-panel-modal #admin-partidos-competition-select');
            }
            competitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;
            console.log(`📋 Competición para admin: ${competitionId} (selector: ${compSelect?.value}, current: ${currentCompetitionId})`);
        } else if (type === 'results') {
            let compSelect = document.getElementById('admin-resultados-competition-select');
            if (!compSelect) {
                compSelect = document.querySelector('#admin-panel-modal #admin-resultados-competition-select');
            }
            competitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;
        } else {
            competitionId = currentCompetitionId;
        }

        if (!competitionId) {
            if (type === 'admin' || type === 'all') {
                if (adminSelect) adminSelect.innerHTML = '<option value="">Selecciona una competición primero</option>';
            }
            if (type === 'results' || type === 'all') {
                if (resultsSelect) resultsSelect.innerHTML = '<option value="">Selecciona una competición primero</option>';
            }
            return;
        }

        // Obtener jornadas únicas de los partidos de esta competición
        console.log(`🔍 Buscando jornadas para competición ${competitionId}`);
        let matchesQuery = supabase
            .from('matches')
            .select('jornada')
            .eq('competition_id', competitionId);

        const { data: matches, error } = await executeQueryWithTimeout(() => matchesQuery, 5000).catch(() => ({ data: [], error: null }));

        if (error) {
            console.error('❌ Error al cargar jornadas:', error);
            throw error;
        }

        console.log(`✅ Partidos encontrados: ${matches?.length || 0}`);

        // Obtener jornadas únicas y ordenarlas
        const jornadas = matches && matches.length > 0
            ? [...new Set(matches.map(m => m.jornada))].sort((a, b) => a - b)
            : [];
        
        console.log(`📅 Jornadas únicas encontradas:`, jornadas);

        // Generar opciones de jornadas
        let optionsHtml = '<option value="">Todas las jornadas</option>';
        if (jornadas.length > 0) {
            jornadas.forEach(j => {
                optionsHtml += `<option value="${j}">Jornada ${j}</option>`;
            });
        } else {
            optionsHtml += '<option value="">No hay jornadas disponibles</option>';
        }

        if (type === 'admin' || type === 'all') {
            if (adminSelect) {
                adminSelect.innerHTML = optionsHtml;
                console.log(`✅ Selector de jornadas admin actualizado con ${jornadas.length} jornadas`);
            } else {
                console.warn('⚠️ Selector admin-jornada-select no encontrado');
            }
        }
        if (type === 'results' || type === 'all') {
            if (resultsSelect) {
                resultsSelect.innerHTML = optionsHtml;
                console.log(`✅ Selector de jornadas results actualizado con ${jornadas.length} jornadas`);
            } else {
                console.warn('⚠️ Selector results-jornada-select no encontrado');
            }
        }
    } catch (error) {
        console.error('Error cargando jornadas:', error);
        if (type === 'admin' || type === 'all') {
            if (adminSelect) adminSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
        if (type === 'results' || type === 'all') {
            if (resultsSelect) resultsSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
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
    
    // Cargar selectores de competición
    loadAdminPartidosCompetitionSelector();
    loadAdminResultadosCompetitionSelector();
    
    console.log('✅ Panel admin cargado');
}

// Cargar selector de competición para "Gestionar Partidos"
async function loadAdminPartidosCompetitionSelector() {
    console.log('🔄 loadAdminPartidosCompetitionSelector() llamado');
    
    // Buscar el selector tanto en el modal como en la sección original
    let select = document.getElementById('admin-partidos-competition-select');
    if (!select) {
        select = document.querySelector('#admin-panel-modal #admin-partidos-competition-select');
    }
    
    if (!select) {
        console.warn('⚠️ Selector admin-partidos-competition-select no encontrado');
        return;
    }
    
    console.log('✅ Selector encontrado, cargando competiciones...');

    const supabase = getSupabase();
    if (!supabase) {
        select.innerHTML = '<option value="">Error de conexión</option>';
        return;
    }

    try {
        const { data: competitions, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('id, name, is_active')
                .eq('is_active', true)
                .order('name', { ascending: true })
        , 5000).catch(() => ({ data: [], error: null }));

        if (error) throw error;

        select.innerHTML = '<option value="">Seleccionar competición...</option>';
        
        if (competitions && competitions.length > 0) {
            competitions.forEach(comp => {
                const option = document.createElement('option');
                option.value = comp.id;
                option.textContent = comp.name;
                if (comp.id === currentCompetitionId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            // Añadir event listener si no existe
            const existingHandler = select.getAttribute('data-listener-attached');
            if (!existingHandler) {
                select.addEventListener('change', onAdminPartidosCompetitionChange);
                select.setAttribute('data-listener-attached', 'true');
                console.log('✅ Event listener añadido al selector');
            }
            
            // Si hay una competición seleccionada, cargar jornadas y partidos
            if (currentCompetitionId) {
                await loadJornadasSelectors('admin');
                loadAdminMatches();
            }
            
            console.log(`✅ ${competitions.length} competiciones cargadas en el selector`);
        } else {
            select.innerHTML = '<option value="">No hay competiciones activas</option>';
        }
    } catch (error) {
        console.error('Error cargando competiciones:', error);
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// Cambio de competición en "Gestionar Partidos"
async function onAdminPartidosCompetitionChange() {
    console.log('🔄 onAdminPartidosCompetitionChange() llamado');
    
    // Buscar el selector tanto en el modal como en la sección original
    let select = document.getElementById('admin-partidos-competition-select');
    if (!select) {
        select = document.querySelector('#admin-panel-modal #admin-partidos-competition-select');
    }
    
    if (!select) {
        console.error('❌ Selector admin-partidos-competition-select no encontrado');
        return;
    }

    const competitionId = parseInt(select.value);
    console.log('📋 Competición seleccionada:', competitionId);
    
    if (!competitionId) {
        console.warn('⚠️ No se seleccionó ninguna competición');
        // Buscar elementos en el modal
        let jornadaSelect = document.getElementById('admin-jornada-select');
        if (!jornadaSelect) {
            jornadaSelect = document.querySelector('#admin-panel-modal #admin-jornada-select');
        }
        if (jornadaSelect) {
            jornadaSelect.innerHTML = '<option value="">Selecciona una competición primero</option>';
        }
        
        let matchesList = document.getElementById('admin-matches-list');
        if (!matchesList) {
            matchesList = document.querySelector('#admin-panel-modal #admin-matches-list');
        }
        if (matchesList) {
            matchesList.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Selecciona una competición primero</p>';
        }
        return;
    }

    // Actualizar competición actual temporalmente para cargar datos
    const previousCompetitionId = currentCompetitionId;
    currentCompetitionId = competitionId;

    try {
        console.log('📊 Cargando jornadas y partidos para competición:', competitionId);
        
        // Forzar actualización de jornadas primero
        await loadJornadasSelectors('admin');
        
        // Esperar un poco para que el selector se actualice
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Cargar partidos
        loadAdminMatches();
        console.log('✅ Datos cargados correctamente');
    } catch (error) {
        console.error('❌ Error al cambiar competición:', error);
        currentCompetitionId = previousCompetitionId;
        showNotification('Error al cargar los datos de la competición: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// Cargar selector de competición para "Introducir Resultados"
async function loadAdminResultadosCompetitionSelector() {
    // Buscar el selector tanto en el modal como en la sección original
    let select = document.getElementById('admin-resultados-competition-select');
    if (!select) {
        // Intentar buscar en el modal
        select = document.querySelector('#admin-panel-modal #admin-resultados-competition-select');
    }
    if (!select) {
        console.warn('⚠️ Selector admin-resultados-competition-select no encontrado');
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        select.innerHTML = '<option value="">Error de conexión</option>';
        return;
    }

    try {
        const { data: competitions, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('id, name, is_active')
                .eq('is_active', true)
                .order('name', { ascending: true })
        , 5000).catch(() => ({ data: [], error: null }));

        if (error) throw error;

        select.innerHTML = '<option value="">Seleccionar competición...</option>';
        
        if (competitions && competitions.length > 0) {
            competitions.forEach(comp => {
                const option = document.createElement('option');
                option.value = comp.id;
                option.textContent = comp.name;
                if (comp.id === currentCompetitionId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            // Si hay una competición seleccionada, cargar jornadas y partidos
            if (currentCompetitionId) {
                await loadJornadasSelectors('results');
                loadMatchesForResults();
            }
        } else {
            select.innerHTML = '<option value="">No hay competiciones activas</option>';
        }
    } catch (error) {
        console.error('Error cargando competiciones:', error);
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// Cambio de competición en "Introducir Resultados"
async function onAdminResultadosCompetitionChange() {
    const select = document.getElementById('admin-resultados-competition-select');
    if (!select) return;

    const competitionId = parseInt(select.value);
    if (!competitionId) {
        document.getElementById('results-jornada-select').innerHTML = '<option value="">Selecciona una competición primero</option>';
        document.getElementById('results-matches-list').innerHTML = '';
        return;
    }

    // Actualizar competición actual temporalmente para cargar datos
    const previousCompetitionId = currentCompetitionId;
    currentCompetitionId = competitionId;

    try {
        await loadJornadasSelectors('results');
        loadMatchesForResults();
    } catch (error) {
        console.error('Error al cambiar competición:', error);
        currentCompetitionId = previousCompetitionId;
    }
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
        
        // Preparar datos del partido
        const matchData = {
            jornada: parseInt(jornada),
            match_date: matchDateISO,
            home_team: homeTeam,
            away_team: awayTeam,
            home_score: null,
            away_score: null
        };
        
        // Añadir competition_id desde el selector de competición en "Gestionar Partidos"
        try {
            const compSelect = document.getElementById('admin-partidos-competition-select');
            const selectedCompetitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;
            if (selectedCompetitionId) {
                matchData.competition_id = selectedCompetitionId;
            } else {
                matchData.competition_id = currentCompetitionId;
            }
        } catch (e) {
            console.warn('⚠️ Columna competition_id no existe en matches');
        }
        
        const { data, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('matches')
                .insert(matchData)
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
        
        // Recargar jornadas y lista de partidos
        if (typeof loadJornadasSelectors === 'function') {
            await loadJornadasSelectors('admin');
        }
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
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
}

// Función para manejar la subida de archivos
async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
        showNotification('Por favor, sube un archivo CSV o XLSX', 'error');
        event.target.value = '';
        return;
    }

    try {
        showNotification('Leyendo archivo...', 'info');

        if (isCSV) {
            // Leer archivo CSV
            const text = await file.text();
            const textarea = document.getElementById('excel-data');
            if (textarea) {
                textarea.value = text;
                showNotification('Archivo CSV cargado. Revisa los datos y haz clic en "Importar Partidos"', 'success');
            }
        } else if (isExcel) {
            // Para Excel necesitaríamos una librería como SheetJS
            // Por ahora, instruimos al usuario a copiar y pegar
            showNotification('Para archivos Excel, por favor copia y pega los datos en el área de texto', 'warning');
            
            // Intentar leer como texto (puede funcionar si Excel guarda como CSV internamente)
            try {
                const text = await file.text();
                const textarea = document.getElementById('excel-data');
                if (textarea && text && text.length > 0 && text.includes(',')) {
                    textarea.value = text;
                    showNotification('Datos cargados. Si el formato no es correcto, copia y pega manualmente desde Excel', 'info');
                } else {
                    showNotification('No se pudo leer el archivo Excel directamente. Por favor, abre Excel y copia/pega los datos manualmente', 'warning');
                }
            } catch (e) {
                showNotification('No se pudo leer el archivo Excel. Por favor, abre Excel y copia/pega los datos manualmente', 'warning');
            }
        }
    } catch (error) {
        console.error('Error leyendo archivo:', error);
        showNotification('Error al leer el archivo. Por favor, copia y pega los datos manualmente', 'error');
        event.target.value = '';
    }
}

async function importFromExcel() {
    const excelData = document.getElementById('excel-data').value.trim();
    
    if (!excelData) {
        showNotification('No hay datos para importar', 'warning');
        return;
    }

    // Verificar que el usuario esté autenticado y sea admin
    if (!currentUser) {
        showNotification('Debes iniciar sesión para importar partidos', 'error');
        return;
    }

    if (!isAdmin) {
        showNotification('Solo los administradores pueden importar partidos', 'error');
        return;
    }

    // Verificar que Supabase esté disponible
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase || !supabase.from) {
        showNotification('Error: No se pudo conectar con la base de datos', 'error');
        console.error('❌ Supabase no está disponible');
        return;
    }

    console.log('✅ Usuario autenticado como admin:', currentUser.email);

    const lines = excelData.split('\n').filter(line => line.trim());
    const matches = [];
    const errors = [];

    console.log(`📊 Procesando ${lines.length} líneas de datos...`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Separar por tabulación, comas (CSV) o múltiples espacios
        // Intentar primero con tabulación (Excel), luego con comas (CSV), luego con espacios
        let parts;
        if (line.includes('\t')) {
            // Tabulación (Excel)
            parts = line.split('\t').map(p => p.trim()).filter(p => p);
        } else if (line.includes(',')) {
            // Comas (CSV) - manejar comas dentro de comillas
            parts = parseCSVLine(line);
        } else {
            // Múltiples espacios
            parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
        }
        
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
        if (!homeTeam || !awayTeam) {
            errors.push({ line: i + 1, error: 'Equipo local o visitante vacío', data: line });
            continue;
        }

        if (homeTeam === awayTeam) {
            errors.push({ line: i + 1, error: 'Equipo local y visitante son iguales', data: line });
            continue;
        }

        // Validar que la fecha sea válida y no esté en el pasado (opcional)
        if (isNaN(matchDate.getTime())) {
            errors.push({ line: i + 1, error: `Fecha inválida: ${matchDate}`, data: line });
            continue;
        }

        // Crear objeto del partido con competition_id
        const matchObj = {
            jornada,
            match_date: matchDate.toISOString(),
            home_team: homeTeam.trim(),
            away_team: awayTeam.trim(),
            home_score: null,
            away_score: null
        };
        
        // Añadir competition_id desde el selector de competición en "Gestionar Partidos"
        const compSelect = document.getElementById('admin-partidos-competition-select');
        const selectedCompetitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;
        if (selectedCompetitionId) {
            matchObj.competition_id = selectedCompetitionId;
        } else if (currentCompetitionId) {
            matchObj.competition_id = currentCompetitionId;
        }
        
        matches.push(matchObj);
        
        console.log(`✅ Línea ${i + 1} procesada:`, {
            jornada,
            match_date: matchDate.toISOString(),
            home_team: homeTeam.trim(),
            away_team: awayTeam.trim()
        });
    }

    console.log(`✅ ${matches.length} partidos válidos encontrados, ${errors.length} errores`);

    if (errors.length > 0) {
        console.warn('⚠️ Errores encontrados:', errors);
    }

    // Mostrar preview
    showImportPreview(matches, errors);

    if (matches.length === 0) {
        showNotification('No hay partidos válidos para importar', 'error');
        if (errors.length > 0) {
            console.error('❌ Errores que impidieron la importación:', errors);
        }
        return;
    }

    // Validar que todos los partidos tengan los campos necesarios
    const invalidMatches = matches.filter(m => 
        !m.jornada || 
        !m.match_date || 
        !m.home_team || 
        !m.away_team ||
        isNaN(new Date(m.match_date).getTime())
    );

    if (invalidMatches.length > 0) {
        console.error('❌ Partidos inválidos detectados:', invalidMatches);
        showNotification(`Error: ${invalidMatches.length} partidos tienen datos inválidos`, 'error');
        return;
    }

    // Confirmar importación
    if (!confirm(`¿Importar ${matches.length} partidos? ${errors.length > 0 ? `(${errors.length} con errores serán ignorados)` : ''}`)) {
        return;
    }

    // Insertar en base de datos
    try {
        showNotification('Importando partidos...', 'info');
        
        // Verificar que Supabase esté disponible y funcionando
        if (!supabase || !supabase.from) {
            throw new Error('Supabase no está disponible. Recarga la página.');
        }
        
        // Probar conexión con una consulta simple
        try {
            const { data: testData, error: testError } = await supabase
                .from('matches')
                .select('id')
                .limit(1);
            
            if (testError) {
                console.error('❌ Error de conexión a Supabase:', testError);
                throw new Error(`Error de conexión: ${testError.message}`);
            }
            console.log('✅ Conexión a Supabase verificada');
        } catch (testError) {
            throw new Error(`No se pudo conectar con la base de datos: ${testError.message}`);
        }
        
        console.log('📤 Insertando partidos en Supabase...');
        console.log('📊 Total a insertar:', matches.length);
        
        // Asegurar que los datos estén en el formato correcto
        const matchesToInsert = matches.map(m => {
            // Validar y convertir tipos
            const matchDate = new Date(m.match_date);
            if (isNaN(matchDate.getTime())) {
                throw new Error(`Fecha inválida en partido: ${m.home_team} vs ${m.away_team}`);
            }
            
            // Obtener competition_id del objeto match o del selector
            const compSelect = document.getElementById('admin-partidos-competition-select');
            const selectedCompetitionId = compSelect ? parseInt(compSelect.value) : (m.competition_id || currentCompetitionId);
            
            const matchToInsert = {
                jornada: parseInt(m.jornada),
                match_date: matchDate.toISOString(), // Asegurar formato ISO
                home_team: String(m.home_team).trim(),
                away_team: String(m.away_team).trim(),
                home_score: null,
                away_score: null
            };
            
            // Añadir competition_id si existe
            if (selectedCompetitionId) {
                matchToInsert.competition_id = selectedCompetitionId;
            }
            
            return matchToInsert;
        });

        console.log('📋 Primer partido formateado:', matchesToInsert[0]);
        console.log('📋 Estructura completa:', JSON.stringify(matchesToInsert[0], null, 2));
        
        // Insertar en lotes de 50 para evitar problemas con muchos partidos
        const BATCH_SIZE = 50;
        let insertedCount = 0;
        let failedCount = 0;
        
        for (let i = 0; i < matchesToInsert.length; i += BATCH_SIZE) {
            const batch = matchesToInsert.slice(i, i + BATCH_SIZE);
            console.log(`📦 Insertando lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} partidos`);
            
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .insert(batch)
                    .select('*');

                console.log(`📦 Respuesta del lote ${Math.floor(i/BATCH_SIZE) + 1}:`, { 
                    dataLength: data?.length || 0,
                    error: error ? error.message : null,
                    errorCode: error?.code || null,
                    errorDetails: error?.details || null,
                    hasData: !!data,
                    hasError: !!error
                });

                if (error) {
                    console.error(`❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
                    console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
                    console.error('❌ Código de error:', error.code);
                    console.error('❌ Mensaje:', error.message);
                    console.error('❌ Detalles:', error.details);
                    console.error('❌ Hint:', error.hint);
                    
                    // Si es un error de permisos RLS, dar un mensaje más claro
                    if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
                        throw new Error('Error de permisos: Verifica que las políticas RLS en Supabase permitan insertar partidos para administradores.');
                    }
                    
                    failedCount += batch.length;
                    throw error;
                }

                // Verificar si se insertaron los datos correctamente
                // A veces Supabase no devuelve data pero sí inserta (dependiendo de RLS)
                // Intentar verificar consultando los partidos insertados
                if (!data || data.length === 0) {
                    console.warn(`⚠️ No se devolvieron datos del lote ${Math.floor(i/BATCH_SIZE) + 1}, verificando inserción...`);
                    
                    // Esperar un poco y verificar si se insertaron
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Intentar contar los partidos insertados verificando por fecha y equipos
                    const firstMatch = batch[0];
                    const { count } = await supabase
                        .from('matches')
                        .select('*', { count: 'exact', head: true })
                        .eq('home_team', firstMatch.home_team)
                        .eq('away_team', firstMatch.away_team)
                        .eq('jornada', firstMatch.jornada);
                    
                    if (count && count > 0) {
                        // Los partidos se insertaron aunque no se devolvieron datos (problema de RLS en select)
                        console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} insertado (verificado por consulta): ${batch.length} partidos`);
                        insertedCount += batch.length;
                    } else {
                        console.error(`❌ No se pudo verificar la inserción del lote ${Math.floor(i/BATCH_SIZE) + 1}`);
                        failedCount += batch.length;
                        // No lanzar error, continuar con el siguiente lote
                    }
                } else {
                    insertedCount += data.length;
                    console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} insertado: ${data.length} partidos`);
                }
                
                // Pequeño delay entre lotes
                if (i + BATCH_SIZE < matchesToInsert.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (batchError) {
                console.error(`❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
                console.error('❌ Tipo de error:', typeof batchError);
                console.error('❌ Stack:', batchError.stack);
                failedCount += batch.length;
                // Continuar con el siguiente lote en lugar de fallar todo
            }
        }

        if (insertedCount === 0) {
            throw new Error('No se pudo insertar ningún partido. Verifica los datos y la conexión.');
        }

        if (failedCount > 0) {
            showNotification(`⚠️ Se insertaron ${insertedCount} partidos, ${failedCount} fallaron`, 'warning');
        } else {
            showNotification(`¡${insertedCount} partidos importados correctamente!`, 'success');
        }
        
        clearExcelData();
        
        // Recargar jornadas y lista de partidos después de un breve delay
        setTimeout(async () => {
            if (typeof loadJornadasSelectors === 'function') {
                await loadJornadasSelectors('admin');
            }
            if (typeof loadAdminMatches === 'function') {
                loadAdminMatches();
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Error importando partidos:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        let errorMessage = 'Error desconocido al importar partidos';
        if (error.message) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error.code) {
            errorMessage = `Error ${error.code}: ${error.message || 'Error en la base de datos'}`;
        } else if (error.details) {
            errorMessage = error.details;
        } else if (error.hint) {
            errorMessage = error.hint;
        }
        
        showNotification('Error al importar partidos: ' + errorMessage, 'error');
        
        // Mostrar más detalles en consola para depuración
        console.error('❌ Detalles completos del error:', {
            error,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
    }
}

// Función auxiliar para parsear líneas CSV con comas dentro de comillas
function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Añadir el último elemento
    if (current || parts.length > 0) {
        parts.push(current.trim());
    }
    
    return parts;
}

function parseSpanishDate(dateStr, timeStr) {
    // Soporta formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM (año actual)
    let day, month, year;
    
    // Si no hay año, usar el año actual
    const currentYear = new Date().getFullYear();
    
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/').map(p => p.trim());
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY/MM/DD
                [year, month, day] = parts;
            } else {
                // DD/MM/YYYY
                [day, month, year] = parts;
            }
        } else if (parts.length === 2) {
            // DD/MM (sin año, usar año actual)
            [day, month] = parts;
            year = currentYear;
        } else {
            return null;
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-').map(p => p.trim());
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                [year, month, day] = parts;
            } else {
                // DD-MM-YYYY
                [day, month, year] = parts;
            }
        } else if (parts.length === 2) {
            // DD-MM (sin año, usar año actual)
            [day, month] = parts;
            year = currentYear;
        } else {
            return null;
        }
    } else {
        return null;
    }

    // Validar y convertir año
    year = parseInt(year);
    // Si el año tiene 2 dígitos, asumir 20XX (2020-2099)
    if (year < 100) {
        year = 2000 + year;
    }
    // Si el año es muy pequeño (menor a 2000), asumir que es 20XX
    if (year < 2000) {
        year = 2000 + (year % 100);
    }

    month = parseInt(month);
    day = parseInt(day);

    // Parsear hora
    const timeParts = (timeStr || '00:00').split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    
    // Crear fecha en zona horaria local (España)
    // Usar UTC para evitar problemas de zona horaria
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // Validar que la fecha es válida
    if (isNaN(date.getTime())) {
        console.error(`❌ Fecha inválida generada: ${year}-${month}-${day} ${hours}:${minutes}`);
        return null;
    }

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
    console.log('📋 loadAdminMatches() llamado');
    
    // Buscar elementos tanto en el modal como en la sección original
    let jornadaSelect = document.getElementById('admin-jornada-select');
    if (!jornadaSelect) {
        jornadaSelect = document.querySelector('#admin-panel-modal #admin-jornada-select');
    }
    
    let compSelect = document.getElementById('admin-partidos-competition-select');
    if (!compSelect) {
        compSelect = document.querySelector('#admin-panel-modal #admin-partidos-competition-select');
    }
    
    let container = document.getElementById('admin-matches-list');
    if (!container) {
        container = document.querySelector('#admin-panel-modal #admin-matches-list');
    }
    
    if (!container) {
        console.error('❌ Contenedor admin-matches-list no encontrado');
        return;
    }
    
    console.log('✅ Elementos encontrados:', {
        jornadaSelect: !!jornadaSelect,
        compSelect: !!compSelect,
        container: !!container
    });

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = '<p style="text-align: center; color: var(--red-500);">Error de conexión</p>';
        return;
    }

    const jornada = jornadaSelect?.value;
    const competitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;

    console.log('📊 Parámetros de búsqueda:', {
        jornada: jornada,
        competitionId: competitionId,
        compSelectValue: compSelect?.value,
        currentCompetitionId: currentCompetitionId
    });

    if (!competitionId) {
        console.warn('⚠️ No hay competición seleccionada');
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Selecciona una competición primero</p>';
        return;
    }

    try {
        console.log(`🔍 Buscando partidos para competición ${competitionId}${jornada ? ` y jornada ${jornada}` : ''}`);
        
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .eq('competition_id', competitionId);

        if (jornada && jornada !== '') {
            matchesQuery = matchesQuery.eq('jornada', parseInt(jornada));
        }

        const { data, error } = await executeQueryWithTimeout(() =>
            matchesQuery.order('match_date', { ascending: true })
        , 8000).catch((err) => {
            console.error('❌ Error en la consulta:', err);
            return { data: [], error: err };
        });

        if (error) {
            console.error('❌ Error al cargar partidos:', error);
            throw error;
        }

        console.log(`✅ Partidos encontrados: ${data?.length || 0}`);

        if (!data || data.length === 0) {
            const message = jornada 
                ? 'No hay partidos en esta jornada.' 
                : 'No hay partidos en esta competición.';
            container.innerHTML = `<p style="text-align: center; color: var(--slate-500);">${message}</p>`;
            return;
        }

        container.innerHTML = data.map(match => `
            <div class="admin-match-item">
                <div>
                    <div class="admin-match-teams">${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)}</div>
                    <div class="admin-match-date">${formatDate(new Date(match.match_date))} - Jornada ${match.jornada}</div>
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
        container.innerHTML = '<p style="text-align: center; color: var(--red-500);">Error al cargar partidos</p>';
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
        await loadJornadasSelectors('admin');
        loadAdminMatches();
    } catch (error) {
        console.error('Error eliminando partido:', error);
        showNotification('Error al eliminar el partido', 'error');
    }
}

async function loadMatchesForResults() {
    const jornadaSelect = document.getElementById('results-jornada-select');
    const compSelect = document.getElementById('admin-resultados-competition-select');
    const container = document.getElementById('results-matches-list');
    
    if (!container) return;

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Error de conexión</p>';
        return;
    }

    const jornada = jornadaSelect?.value;
    const competitionId = compSelect ? parseInt(compSelect.value) : currentCompetitionId;

    if (!competitionId) {
        container.innerHTML = '<p style="text-align: center; color: var(--slate-500);">Selecciona una competición primero</p>';
        return;
    }

    try {
        // Filtrar por competición seleccionada
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .eq('competition_id', competitionId);
        
        // Filtrar por jornada si se seleccionó una
        if (jornada && jornada !== '') {
            matchesQuery = matchesQuery.eq('jornada', parseInt(jornada));
        }
        
        const { data, error } = await executeQueryWithTimeout(() =>
            matchesQuery.order('match_date', { ascending: true })
        , 8000).catch(() => ({ data: [], error: null }));

        if (error) throw error;

        if (!data || data.length === 0) {
            const message = jornada 
                ? 'No hay partidos en esta jornada.' 
                : 'No hay partidos en esta competición.';
            container.innerHTML = `<p style="text-align: center; color: var(--slate-500);">${message}</p>`;
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
    // Buscar el contenedor tanto en el modal como en la sección original
    let container = document.getElementById('users-list');
    if (!container) {
        container = document.querySelector('#admin-panel-modal #users-list');
    }
    if (!container) {
        console.warn('⚠️ Contenedor users-list no encontrado');
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = '<p style="color: var(--red-500);">Error de conexión</p>';
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios...</div>';

    try {
        // Obtener todos los usuarios
        const { data: users, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('users')
                .select('id, name, email, is_admin, total_points, created_at')
                .order('created_at', { ascending: false })
        , 8000).catch(() => ({ data: [], error: null }));

        if (error) {
            console.error('Error cargando usuarios:', error);
            container.innerHTML = '<p style="color: var(--red-500);">Error al cargar usuarios</p>';
            return;
        }

        if (!users || users.length === 0) {
            container.innerHTML = '<p>No hay usuarios registrados.</p>';
            return;
        }

        // Para cada usuario, obtener sus ligas y competiciones
        const usersWithData = await Promise.all(users.map(async (user) => {
            // Obtener ligas del usuario
            const { data: userLigas, error: ligasError } = await executeQueryWithTimeout(() =>
                supabase
                    .from('liga_members')
                    .select(`
                        liga_id,
                        ligas (
                            id,
                            name,
                            competition_id,
                            competitions (
                                id,
                                name
                            )
                        )
                    `)
                    .eq('user_id', user.id)
            , 5000).catch(() => ({ data: [], error: null }));

            const ligas = userLigas || [];
            
            // Agrupar ligas por competición
            const competicionesMap = new Map();
            ligas.forEach(item => {
                if (item.ligas && item.ligas.competition_id) {
                    const compId = item.ligas.competition_id;
                    const compName = item.ligas.competitions?.name || 'Sin nombre';
                    
                    if (!competicionesMap.has(compId)) {
                        competicionesMap.set(compId, {
                            id: compId,
                            name: compName,
                            ligas: []
                        });
                    }
                    
                    competicionesMap.get(compId).ligas.push({
                        id: item.ligas.id,
                        name: item.ligas.name
                    });
                }
            });

            const competiciones = Array.from(competicionesMap.values());

            return {
                ...user,
                competiciones,
                ligas: ligas.map(item => item.ligas).filter(Boolean)
            };
        }));

        // Renderizar usuarios con sus competiciones y ligas
        container.innerHTML = usersWithData.map(user => {
            const competicionesHtml = user.competiciones.length > 0 
                ? user.competiciones.map(comp => `
                    <div style="margin-bottom: 12px; padding: 10px; background: var(--slate-50); border-radius: 6px; border-left: 3px solid var(--blue-500);">
                        <div style="font-weight: 600; color: var(--slate-900); margin-bottom: 6px;">
                            <i class="fas fa-trophy" style="color: var(--amber-500); margin-right: 6px;"></i>
                            ${escapeHtml(comp.name)}
                        </div>
                        <div style="font-size: 13px; color: var(--slate-600); margin-left: 20px;">
                            <strong>Ligas:</strong> ${comp.ligas.map(l => escapeHtml(l.name)).join(', ') || 'Ninguna'}
                        </div>
                    </div>
                `).join('')
                : '<p style="color: var(--slate-500); font-size: 13px; margin: 0;">No participa en ninguna competición</p>';

            return `
                <div class="user-item" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid var(--slate-200);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div class="user-info" style="display: flex; align-items: center; gap: 12px;">
                            <div class="user-avatar">${getInitials(user.name)}</div>
                            <div class="user-details">
                                <h4 style="margin: 0 0 4px 0;">${escapeHtml(user.name)}</h4>
                                <p style="margin: 0; color: var(--slate-600); font-size: 14px;">${escapeHtml(user.email)}</p>
                                <p style="margin: 4px 0 0 0; color: var(--slate-500); font-size: 12px;">
                                    Puntos totales: <strong>${user.total_points || 0}</strong>
                                </p>
                            </div>
                        </div>
                        <span class="user-badge ${user.is_admin ? 'admin' : 'user'}">
                            ${user.is_admin ? 'Admin' : 'Usuario'}
                        </span>
                    </div>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--slate-200);">
                        <div style="font-weight: 600; color: var(--slate-700); margin-bottom: 8px; font-size: 14px;">
                            <i class="fas fa-trophy" style="margin-right: 6px;"></i>Competiciones y Ligas
                        </div>
                        ${competicionesHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        container.innerHTML = '<p style="color: var(--red-500);">Error al cargar usuarios</p>';
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
    // Mostrar información de competición activa en el perfil
    const competitionInfo = currentCompetition ? 
        `<div style="margin-bottom: 16px; padding: 12px; background: var(--slate-100); border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: var(--slate-600);">Competición activa:</p>
            <p style="margin: 0; font-weight: 600; color: var(--slate-900);">${escapeHtml(currentCompetition.name)}</p>
            <button class="btn btn-small" onclick="event.stopPropagation(); changeCompetition();" style="margin-top: 8px;">
                <i class="fas fa-exchange-alt"></i> Cambiar Competición
            </button>
        </div>` : '';
    
    // Guardar referencia temporal para añadir después
    window._competitionInfoForProfile = competitionInfo;
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

        // Actualizar información de competición en el perfil
        const competitionNameEl = document.getElementById('profile-competition-name');
        if (competitionNameEl && currentCompetition) {
            competitionNameEl.textContent = currentCompetition.name;
        } else if (competitionNameEl) {
            competitionNameEl.textContent = 'No seleccionada';
        }
        
        // Actualizar también en el header
        updateNavCompetitionName();

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
    window.handleFileUpload = handleFileUpload;
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
    window.onAdminPartidosCompetitionChange = onAdminPartidosCompetitionChange;
    window.onAdminResultadosCompetitionChange = onAdminResultadosCompetitionChange;
    window.deleteMatch = deleteMatch;
    window.onDashboardStatisticsLigaChange = onDashboardStatisticsLigaChange;
    window.onDashboardClassificationLigaChange = onDashboardClassificationLigaChange;
    window.changeCompetition = changeCompetition;
    window.selectCompetition = selectCompetition;
    window.updateNavCompetitionName = updateNavCompetitionName;
    window.loadCompetitionsList = loadCompetitionsList;
    window.showCreateCompetitionModal = showCreateCompetitionModal;
    window.createCompetitionFromForm = createCompetitionFromForm;
    window.activateCompetition = activateCompetition;
    window.deleteCompetition = deleteCompetition;
    window.showAdminDashboard = showAdminDashboard;
    window.openAdminDashboardFromSelector = openAdminDashboardFromSelector;
    window.closeAdminDashboard = closeAdminDashboard;
    window.openAdminTab = openAdminTab;
    window.closeAdminPanel = closeAdminPanel;
}

// ========================================
// DASHBOARD DE ADMINISTRACIÓN
// ========================================
function showAdminDashboard() {
    const modal = document.getElementById('admin-dashboard-modal');
    if (!modal) return;
    
    // Cerrar cualquier otro modal abierto
    closeAllModals();
    
    modal.classList.add('active');
    modal.style.display = 'flex';
}

// Función para abrir el panel de administración desde el selector de competición
function openAdminDashboardFromSelector() {
    console.log('🔧 Abriendo panel de administración desde selector');
    
    // Cerrar el modal de selección de competición
    const competitionModal = document.getElementById('competition-selector-modal');
    if (competitionModal) {
        competitionModal.classList.remove('active');
        competitionModal.style.display = '';
    }
    
    // Abrir el panel de administración
    showAdminDashboard();
}

function closeAdminDashboard() {
    const modal = document.getElementById('admin-dashboard-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    modal.style.display = 'none';
}

function openAdminTab(tabName) {
    console.log('🔧 openAdminTab llamado con:', tabName);
    
    // Cerrar el dashboard principal
    closeAdminDashboard();
    
    // Abrir el panel detallado
    const panelModal = document.getElementById('admin-panel-modal');
    if (!panelModal) {
        console.error('❌ No se encontró admin-panel-modal');
        return;
    }
    
    // Obtener el contenedor donde están las pestañas originales
    const adminSection = document.getElementById('admin-section');
    const panelContainer = document.getElementById('admin-panel-tabs-container');
    
    if (!adminSection) {
        console.error('❌ No se encontró admin-section');
        return;
    }
    
    if (!panelContainer) {
        console.error('❌ No se encontró admin-panel-tabs-container');
        return;
    }
    
    console.log('📋 Copiando contenido de admin-section...');
    
    // Limpiar el contenedor
    panelContainer.innerHTML = '';
    
    // Copiar todas las pestañas de admin-section
    const tabs = adminSection.querySelectorAll('[id$="-admin-tab"]');
    console.log('📑 Pestañas encontradas:', tabs.length);
    
    if (tabs.length === 0) {
        console.error('❌ No se encontraron pestañas en admin-section');
        panelContainer.innerHTML = '<p style="padding: 20px; color: var(--red-500);">Error: No se encontró el contenido de administración.</p>';
        panelModal.classList.add('active');
        panelModal.style.display = 'flex';
        return;
    }
    
    tabs.forEach(tab => {
        const clonedTab = tab.cloneNode(true);
        // Cambiar el ID para evitar duplicados, pero mantener una referencia
        const originalId = clonedTab.id;
        clonedTab.id = 'modal-' + originalId;
        clonedTab.classList.add('admin-tab-panel');
        clonedTab.style.display = 'none';
        panelContainer.appendChild(clonedTab);
        console.log('✅ Pestaña copiada:', originalId);
    });
    
    // Ocultar todas las pestañas primero
    const allTabs = panelContainer.querySelectorAll('.admin-tab-panel');
    allTabs.forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Mostrar la pestaña seleccionada (usando el nuevo ID)
    const tabPanel = document.getElementById('modal-' + tabName + '-admin-tab');
    if (tabPanel) {
        tabPanel.style.display = 'block';
        console.log('✅ Pestaña mostrada:', tabName);
    } else {
        console.error('❌ No se encontró la pestaña:', 'modal-' + tabName + '-admin-tab');
    }
    
    // Actualizar el título
    const titleMap = {
        'partidos': 'Gestionar Partidos',
        'resultados': 'Introducir Resultados',
        'competiciones': 'Gestionar Competiciones',
        'usuarios': 'Gestionar Usuarios',
        'puntos': 'Editar Puntos',
        'reiniciar': 'Reiniciar Liga'
    };
    const titleEl = document.getElementById('admin-panel-title');
    if (titleEl) {
        const iconMap = {
            'partidos': 'fa-calendar-alt',
            'resultados': 'fa-futbol',
            'competiciones': 'fa-trophy',
            'usuarios': 'fa-users',
            'puntos': 'fa-edit',
            'reiniciar': 'fa-redo'
        };
        titleEl.innerHTML = `<i class="fas ${iconMap[tabName] || 'fa-cog'}"></i> ${titleMap[tabName] || 'Panel de Administración'}`;
    }
    
    // Mostrar el modal
    panelModal.classList.add('active');
    panelModal.style.display = 'flex';
    
    // Cargar los datos según la pestaña
    // Usar un timeout más largo para asegurar que el DOM esté listo
    setTimeout(() => {
        console.log('📊 Cargando datos para la pestaña:', tabName);
        
        // Actualizar los selectores para que busquen en el modal
        if (tabName === 'partidos') {
            // Buscar el selector en el modal y añadir event listener directamente
            let selector = document.querySelector('#admin-panel-modal #admin-partidos-competition-select');
            if (!selector) {
                selector = document.getElementById('admin-partidos-competition-select');
            }
            
            if (selector) {
                console.log('✅ Selector encontrado, configurando event listener');
                // Eliminar listeners anteriores si existen
                const newSelector = selector.cloneNode(true);
                selector.parentNode.replaceChild(newSelector, selector);
                selector = newSelector;
                
                // Añadir event listener directamente
                selector.addEventListener('change', function() {
                    console.log('🔄 Cambio detectado en selector (event listener directo)');
                    onAdminPartidosCompetitionChange();
                });
                console.log('✅ Event listener directo añadido');
            } else {
                console.warn('⚠️ Selector no encontrado en modal, buscando en admin-section');
            }
            
            loadAdminPartidosCompetitionSelector();
        } else if (tabName === 'resultados') {
            loadAdminResultadosCompetitionSelector();
        } else if (tabName === 'competiciones') {
            loadCompetitionsList();
        } else if (tabName === 'usuarios') {
            loadUsersList();
        } else if (tabName === 'puntos') {
            loadLigasForEditPoints();
        } else if (tabName === 'reiniciar') {
            loadLigasForReset();
        }
        
        // Cargar datos generales
        loadAdminData();
    }, 300);
}

function closeAdminPanel() {
    const panelModal = document.getElementById('admin-panel-modal');
    if (!panelModal) return;
    
    panelModal.classList.remove('active');
    panelModal.style.display = 'none';
}

function closeAllModals() {
    // Cerrar todos los modales (excepto el de selección de competición si está esperando selección)
    document.querySelectorAll('.modal').forEach(modal => {
        // No cerrar el modal de selección de competición si hay múltiples competiciones activas
        // y el usuario aún no ha seleccionado una
        if (modal.id === 'competition-selector-modal') {
            return;
        }
        modal.classList.remove('active');
        modal.style.display = 'none';
    });
}

// ========================================
// GESTIÓN DE COMPETICIONES (ADMIN)
// ========================================
/**
 * Cargar lista de competiciones en el panel admin
 */
async function loadCompetitionsList() {
    // Buscar el contenedor tanto en el modal como en la sección original
    let container = document.getElementById('competitions-list');
    if (!container) {
        container = document.querySelector('#admin-panel-modal #competitions-list');
    }
    if (!container) {
        console.warn('⚠️ Contenedor competitions-list no encontrado');
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = '<p style="color: var(--red-500);">Error de conexión</p>';
        return;
    }

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando competiciones...</div>';

    try {
        const { data: competitions, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('*')
                .order('id', { ascending: true })
        , 8000).catch(() => ({ data: [], error: null }));

        if (error) {
            console.error('Error cargando competiciones:', error);
            container.innerHTML = '<p style="color: var(--red-500);">Error al cargar competiciones</p>';
            return;
        }

        if (!competitions || competitions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No hay competiciones</h3>
                    <p>Crea tu primera competición para empezar.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = competitions.map(comp => `
            <div class="competition-card" style="padding: 20px; border: 1px solid var(--slate-700); border-radius: 8px; margin-bottom: 16px; background: var(--slate-800);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h3 style="margin: 0 0 8px 0; color: white;">${escapeHtml(comp.name)}</h3>
                        <p style="margin: 0; color: var(--slate-400); font-size: 14px;">Slug: ${escapeHtml(comp.slug || 'N/A')}</p>
                        ${comp.description ? `<p style="margin: 8px 0 0 0; color: var(--slate-300);">${escapeHtml(comp.description)}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${comp.is_active ? '<span style="padding: 4px 12px; background: var(--green-500); color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">ACTIVA</span>' : '<span style="padding: 4px 12px; background: var(--slate-600); color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">INACTIVA</span>'}
                        ${comp.id === currentCompetitionId ? '<span style="padding: 4px 12px; background: var(--blue-500); color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">ACTUAL</span>' : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="btn ${comp.is_active ? 'btn-secondary' : 'btn-primary'} btn-small" onclick="activateCompetition(${comp.id}, ${!comp.is_active})">
                        <i class="fas ${comp.is_active ? 'fa-times' : 'fa-check'}"></i> ${comp.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteCompetition(${comp.id}, '${escapeHtml(comp.name)}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: var(--red-500);">Error al cargar competiciones</p>';
    }
}

/**
 * Mostrar modal para crear competición
 */
function showCreateCompetitionModal() {
    closeModals();
    const modal = document.getElementById('create-competition-modal');
    if (!modal) {
        showNotification('Error: Modal no encontrado', 'error');
        return;
    }
    
    // Limpiar formulario
    document.getElementById('competition-name').value = '';
    document.getElementById('competition-slug').value = '';
    document.getElementById('competition-description').value = '';
    document.getElementById('competition-active').checked = true;
    
    modal.classList.add('active');
}

/**
 * Crear competición desde formulario
 */
async function createCompetitionFromForm(event) {
    event.preventDefault();
    
    const supabase = getSupabase();
    if (!supabase) {
        showNotification('Error de conexión', 'error');
        return;
    }

    const name = document.getElementById('competition-name').value.trim();
    if (!name) {
        showNotification('El nombre es obligatorio', 'error');
        return;
    }

    let slug = document.getElementById('competition-slug').value.trim();
    if (!slug) {
        // Generar slug automáticamente
        slug = name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    const description = document.getElementById('competition-description').value.trim();
    const isActive = document.getElementById('competition-active').checked;

    try {
        const { data, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .insert({
                    name: name,
                    slug: slug,
                    description: description || null,
                    is_active: isActive
                })
                .select()
                .single()
        , 8000);

        if (error) throw error;

        showNotification(`Competición "${name}" creada correctamente`, 'success');
        loadCompetitionsList();
        closeModals();
        
        // Si se activó y hay más de una activa, mostrar modal de selección
        if (isActive) {
            await loadActiveCompetition();
        }
    } catch (error) {
        console.error('Error creando competición:', error);
        showNotification('Error al crear competición: ' + (error.message || 'Error desconocido'), 'error');
    }
}

/**
 * Activar/desactivar una competición (permitir múltiples activas)
 */
async function activateCompetition(competitionId, activate = true) {
    const supabase = getSupabase();
    if (!supabase) {
        showNotification('Error de conexión', 'error');
        return;
    }

    try {
        // Obtener estado actual de la competición
        const { data: comp, error: fetchError } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .select('id, name, is_active')
                .eq('id', competitionId)
                .single()
        , 5000);

        if (fetchError || !comp) {
            throw new Error('Competición no encontrada');
        }

        // Actualizar estado (permitir múltiples activas)
        const { error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .update({ is_active: activate })
                .eq('id', competitionId)
        , 5000);

        if (error) throw error;

        showNotification(
            `Competición "${comp.name}" ${activate ? 'activada' : 'desactivada'} correctamente`, 
            'success'
        );
        
        // Recargar lista
        await loadCompetitionsList();

        // Si se desactivó la competición actual, recargar competición activa
        if (!activate && competitionId === currentCompetitionId) {
            await loadActiveCompetition();
        }
    } catch (error) {
        console.error('Error cambiando estado de competición:', error);
        showNotification('Error: ' + (error.message || 'Error desconocido'), 'error');
    }
}

/**
 * Eliminar una competición
 */
async function deleteCompetition(competitionId, competitionName) {
    if (!confirm(`¿Estás seguro de eliminar la competición "${competitionName}"?\n\nEsta acción eliminará la competición y no se puede deshacer.`)) {
        return;
    }

    const supabase = getSupabase();
    if (!supabase) {
        showNotification('Error de conexión', 'error');
        return;
    }

    try {
        // Verificar si hay partidos o ligas asociados
        const { data: matches } = await executeQueryWithTimeout(() =>
            supabase
                .from('matches')
                .select('id')
                .eq('competition_id', competitionId)
                .limit(1)
        , 5000).catch(() => ({ data: [] }));

        const { data: ligas } = await executeQueryWithTimeout(() =>
            supabase
                .from('ligas')
                .select('id')
                .eq('competition_id', competitionId)
                .limit(1)
        , 5000).catch(() => ({ data: [] }));

        if (matches && matches.length > 0) {
            if (!confirm(`Esta competición tiene partidos asociados. ¿Eliminar de todas formas?`)) {
                return;
            }
        }

        if (ligas && ligas.length > 0) {
            if (!confirm(`Esta competición tiene ligas asociadas. ¿Eliminar de todas formas?`)) {
                return;
            }
        }

        // Eliminar competición
        const { error } = await executeQueryWithTimeout(() =>
            supabase
                .from('competitions')
                .delete()
                .eq('id', competitionId)
        , 5000);

        if (error) throw error;

        showNotification(`Competición "${competitionName}" eliminada correctamente`, 'success');
        
        // Recargar lista
        await loadCompetitionsList();

        // Si se eliminó la competición actual, recargar competición activa
        if (competitionId === currentCompetitionId) {
            await loadActiveCompetition();
        }
    } catch (error) {
        console.error('Error eliminando competición:', error);
        showNotification('Error al eliminar competición: ' + (error.message || 'Error desconocido'), 'error');
    }
}

// ========================================
// CARGAR LIGAS PARA REINICIAR
// ========================================
async function loadLigasForReset() {
    const selector = document.getElementById('reiniciar-liga-select');
    if (!selector) {
        console.error('❌ Selector reiniciar-liga-select no encontrado');
        return;
    }

    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) {
        console.error('❌ Supabase no disponible');
        return;
    }

    try {
        // Limpiar selector
        selector.innerHTML = '<option value="">Selecciona una liga</option>';

        // Cargar todas las ligas
        const { data: ligas, error } = await executeQueryWithTimeout(() =>
            supabase
                .from('ligas')
                .select('id, name, code')
                .order('name', { ascending: true })
        , 5000);

        if (error) {
            console.error('Error cargando ligas:', error);
            throw error;
        }

        if (ligas && ligas.length > 0) {
            ligas.forEach(liga => {
                const option = document.createElement('option');
                option.value = liga.id;
                option.textContent = `${liga.name} (${liga.code})`;
                selector.appendChild(option);
            });

            console.log(`✅ ${ligas.length} ligas cargadas para reiniciar`);

            // Añadir listener para mostrar info cuando se selecciona una liga
            selector.addEventListener('change', async function() {
                const ligaId = this.value;
                if (ligaId) {
                    await loadResetLigaInfo(ligaId);
                } else {
                    document.getElementById('reiniciar-liga-info').style.display = 'none';
                }
            });
        } else {
            console.warn('No hay ligas disponibles');
            selector.innerHTML = '<option value="">No hay ligas disponibles</option>';
        }
    } catch (error) {
        console.error('Error en loadLigasForReset:', error);
        selector.innerHTML = '<option value="">Error al cargar ligas</option>';
    }
}

async function loadResetLigaInfo(ligaId) {
    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) return;

    try {
        // Obtener número de miembros
        const { data: members, error: membersError } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('user_id')
                .eq('liga_id', ligaId)
        , 5000);

        const membersCount = members?.length || 0;

        // Obtener total de puntos de todos los miembros de la liga
        let totalPoints = 0;
        if (members && members.length > 0) {
            const userIds = members.map(m => m.user_id);
            const { data: users, error: usersError } = await executeQueryWithTimeout(() =>
                supabase
                    .from('users')
                    .select('total_points')
                    .in('id', userIds)
            , 5000);

            if (!usersError && users) {
                totalPoints = users.reduce((sum, u) => sum + (u.total_points || 0), 0);
            }
        }

        // Mostrar info
        const infoBox = document.getElementById('reiniciar-liga-info');
        if (infoBox) {
            document.getElementById('reiniciar-liga-members').textContent = membersCount;
            document.getElementById('reiniciar-liga-total-points').textContent = totalPoints;
            infoBox.style.display = 'block';
        }
    } catch (error) {
        console.error('Error cargando info de liga:', error);
    }
}

async function resetLiga() {
    const selector = document.getElementById('reiniciar-liga-select');
    if (!selector || !selector.value) {
        showNotification('Selecciona una liga primero', 'error');
        return;
    }

    const ligaId = parseInt(selector.value);

    if (!confirm('¿Estás seguro de reiniciar esta liga?\n\nEsta acción eliminará TODOS los puntos de todos los usuarios en esta liga.\n\nEsta acción NO se puede deshacer.')) {
        return;
    }

    if (!confirm('ÚLTIMA CONFIRMACIÓN: ¿Reiniciar la liga definitivamente?')) {
        return;
    }

    const supabase = window.supabase || window.supabaseClient;
    if (!supabase) {
        showNotification('Error: No se pudo conectar con la base de datos', 'error');
        return;
    }

    try {
        showNotification('Reiniciando liga...', 'info');

        // Obtener todos los miembros de la liga
        const { data: members, error: membersError } = await executeQueryWithTimeout(() =>
            supabase
                .from('liga_members')
                .select('user_id')
                .eq('liga_id', ligaId)
        , 5000);

        if (membersError) throw membersError;

        if (!members || members.length === 0) {
            showNotification('No hay miembros en esta liga', 'warning');
            return;
        }

        // Resetear puntos de todos los miembros a 0
        const userIds = members.map(m => m.user_id);
        const { error: updateError } = await executeQueryWithTimeout(() =>
            supabase
                .from('users')
                .update({ total_points: 0 })
                .in('id', userIds)
        , 10000);

        if (updateError) throw updateError;

        showNotification(`✅ Liga reiniciada correctamente. ${members.length} usuarios afectados.`, 'success');

        // Recargar info
        await loadResetLigaInfo(ligaId);

    } catch (error) {
        console.error('Error reiniciando liga:', error);
        showNotification('Error al reiniciar la liga: ' + (error.message || 'Error desconocido'), 'error');
    }
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

