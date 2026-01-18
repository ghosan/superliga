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

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    if (!notification || !messageEl) {
        console.warn('⚠️ Elemento de notificación no encontrado');
        return;
    }
    
    messageEl.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
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
        
        // Actualizar usuario actual inmediatamente
        if (data.user) {
            currentUser = data.user;
        }
        
        // Llamar a showDashboard directamente como respaldo
        // El evento onAuthStateChange también lo hará, pero esto asegura que funcione
        try {
            await loadUserProfile();
            await showDashboard();
            // Esperar un momento antes de cargar la competición
            await new Promise(resolve => setTimeout(resolve, 300));
            await loadActiveCompetition();
        } catch (error) {
            console.error('❌ Error mostrando dashboard después de login:', error);
            // El evento onAuthStateChange debería manejarlo como respaldo
        }
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

function updateNavAvatar(name, avatarUrl) {
    const navAvatarInitials = document.getElementById('nav-avatar-initials');
    const navAvatarImage = document.getElementById('nav-avatar-image');
    
    if (!navAvatarInitials) {
        console.warn('⚠️ Elemento nav-avatar-initials no encontrado');
        return;
    }
    
    const initials = getInitials(name);
    navAvatarInitials.textContent = initials;
    
    if (navAvatarImage) {
        if (avatarUrl) {
            navAvatarImage.src = avatarUrl;
            navAvatarImage.style.display = 'block';
            navAvatarInitials.style.display = 'none';
        } else {
            navAvatarImage.style.display = 'none';
            navAvatarInitials.style.display = 'flex';
        }
    }
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(n => n.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showProfileModal() {
    closeModals();
    // TODO: Implementar carga de datos del perfil
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        profileModal.classList.add('active');
    } else {
        console.warn('⚠️ Modal de perfil no encontrado');
    }
}

// ========================================
// ADMINISTRACIÓN
// ========================================
function showAdminDashboard() {
    if (!isAdmin) {
        showNotification('No tienes permisos de administrador', 'error');
        return;
    }
    
    closeModals();
    const adminDashboardModal = document.getElementById('admin-dashboard-modal');
    if (adminDashboardModal) {
        adminDashboardModal.classList.add('active');
        adminDashboardModal.style.display = 'flex';
    } else {
        console.warn('⚠️ Modal de admin dashboard no encontrado');
    }
}

function closeAdminDashboard() {
    const adminDashboardModal = document.getElementById('admin-dashboard-modal');
    if (adminDashboardModal) {
        adminDashboardModal.classList.remove('active');
        adminDashboardModal.style.display = 'none';
    }
}

function showAdminPanel(tab = 'partidos') {
    if (!isAdmin) {
        showNotification('No tienes permisos de administrador', 'error');
        return;
    }
    
    closeModals();
    const adminPanelModal = document.getElementById('admin-panel-modal');
    if (adminPanelModal) {
        adminPanelModal.classList.add('active');
        adminPanelModal.style.display = 'flex';
        
        // Activar el tab específico
        if (tab) {
            openAdminTab(tab);
        }
    } else {
        console.warn('⚠️ Modal de admin panel no encontrado');
    }
}

function closeAdminPanel() {
    const adminPanelModal = document.getElementById('admin-panel-modal');
    if (adminPanelModal) {
        adminPanelModal.classList.remove('active');
        adminPanelModal.style.display = 'none';
    }
}

function openAdminTab(tab) {
    // Actualizar botones de tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.adminTab === tab) {
            btn.classList.add('active');
        }
    });
    
    // Actualizar contenido de tabs
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(`${tab}-admin-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Cargar datos según el tab
    if (tab === 'resultados') {
        // loadMatchesForResults();
    } else if (tab === 'usuarios') {
        // loadUsersList();
    }
}

function setupAdminTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.adminTab;
            openAdminTab(tab);
        });
    });
}

function loadAdminData() {
    if (!isAdmin) {
        showNotification('No tienes permisos de administrador', 'error');
        return;
    }
    
    console.log('⚙️ Cargando datos de administración...');
    // Aquí se cargarían los datos necesarios para el panel de admin
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
        // Filtrar por competición activa
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .eq('jornada', currentJornada);
        
        // Filtrar por competition_id si existe
        try {
            if (currentCompetitionId) {
                matchesQuery = matchesQuery.eq('competition_id', currentCompetitionId);
            }
        } catch (e) {
            console.warn('⚠️ Columna competition_id no existe en matches');
        }
        
        const { data: matches, error } = await matchesQuery
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
}

// ========================================
// MENÚ MÓVIL
// ========================================

// Toggle menú móvil
function toggleMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    const overlay = document.getElementById('mobile-menu-overlay');
    const hamburger = document.getElementById('nav-hamburger');
    
    const isActive = drawer.classList.contains('active');
    
    if (isActive) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

// Abrir menú móvil
function openMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    const overlay = document.getElementById('mobile-menu-overlay');
    const hamburger = document.getElementById('nav-hamburger');
    
    drawer.classList.add('active');
    overlay.classList.add('active');
    hamburger.classList.add('active');
    
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
    
    // Sincronizar datos del usuario
    syncMobileMenuUserData();
}

// Cerrar menú móvil
function closeMobileMenu() {
    const drawer = document.getElementById('mobile-menu-drawer');
    const overlay = document.getElementById('mobile-menu-overlay');
    const hamburger = document.getElementById('nav-hamburger');
    
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    hamburger.classList.remove('active');
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
}

// Sincronizar datos del usuario en el menú móvil
function syncMobileMenuUserData() {
    // Nombre del usuario
    const userName = document.getElementById('user-name')?.textContent || 'Usuario';
    const mobileUserName = document.getElementById('mobile-user-name');
    if (mobileUserName) {
        mobileUserName.textContent = userName;
    }
    
    // Email del usuario (si está disponible)
    if (window.currentUser?.email) {
        const mobileUserEmail = document.getElementById('mobile-user-email');
        if (mobileUserEmail) {
            mobileUserEmail.textContent = window.currentUser.email;
        }
    }
    
    // Avatar del usuario
    const navAvatarInitials = document.getElementById('nav-avatar-initials')?.textContent || 'US';
    const mobileAvatarInitials = document.getElementById('mobile-avatar-initials');
    if (mobileAvatarInitials) {
        mobileAvatarInitials.textContent = navAvatarInitials;
    }
    
    // Nombre de la competición
    const competitionName = document.getElementById('nav-competition-name')?.textContent || 'La Liga';
    const mobileCompetitionName = document.getElementById('mobile-competition-name');
    if (mobileCompetitionName) {
        mobileCompetitionName.textContent = competitionName;
    }
    
    // Progreso de pronósticos
    const progressPercentage = document.getElementById('progress-percentage')?.textContent || '0%';
    const mobileProgressPercentage = document.getElementById('mobile-progress-percentage');
    const mobileProgressFill = document.getElementById('mobile-progress-fill');
    if (mobileProgressPercentage) {
        mobileProgressPercentage.textContent = progressPercentage;
    }
    if (mobileProgressFill) {
        const percentage = parseInt(progressPercentage) || 0;
        mobileProgressFill.style.width = percentage + '%';
    }
    
    // Mostrar/ocultar sección de admin
    const adminBtn = document.getElementById('admin-header-btn');
    const mobileAdminSection = document.getElementById('mobile-admin-section');
    if (mobileAdminSection) {
        if (adminBtn && adminBtn.style.display !== 'none') {
            mobileAdminSection.style.display = 'block';
        } else {
            mobileAdminSection.style.display = 'none';
        }
    }
}

// Manejar navegación desde el menú móvil
function setupMobileMenuNavigation() {
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link[data-page]');
    
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const page = this.getAttribute('data-page');
            
            // Actualizar clase active en los links del menú móvil
            mobileNavLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // También actualizar la navegación desktop
            const desktopNavLinks = document.querySelectorAll('.nav-link[data-page]');
            desktopNavLinks.forEach(l => l.classList.remove('active'));
            const desktopLink = document.querySelector(`.nav-link[data-page="${page}"]`);
            if (desktopLink) {
                desktopLink.classList.add('active');
            }
            
            // Cerrar el menú móvil
            closeMobileMenu();
            
            // Navegar a la página
            const functionName = 'show' + page.charAt(0).toUpperCase() + page.slice(1) + 'Section';
            if (typeof window[functionName] === 'function') {
                window[functionName]();
            }
        });
    });
}

// Exponer funciones globalmente
window.toggleMobileMenu = toggleMobileMenu;
window.openMobileMenu = openMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.syncMobileMenuUserData = syncMobileMenuUserData;

// Inicializar navegación del menú móvil cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileMenuNavigation);
} else {
    setupMobileMenuNavigation();
}

// ========================================
// EXPORTAR FUNCIONES GLOBALES
// ========================================

// Autenticación
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.showForgotPasswordModal = showForgotPasswordModal;
window.showRulesModal = showRulesModal;
window.closeModals = closeModals;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.handleLogout = handleLogout;

// Navegación
window.showLandingPage = showLandingPage;
window.showDashboard = showDashboard;

// Dashboard
window.showDashboardLigaDetail = showDashboardLigaDetail;
window.closeDashboardDetail = closeDashboardDetail;

// Perfil
window.showProfileModal = showProfileModal;
window.updateProfile = updateProfile;

// Ligas
window.showCreateLigaModal = showCreateLigaModal;
window.showJoinLigaModal = showJoinLigaModal;
window.showLigaDetailModal = showLigaDetailModal;
window.createLiga = createLiga;
window.joinLiga = joinLiga;
window.leaveLiga = leaveLiga;
window.copyToClipboard = copyToClipboard;
window.shareOnFacebook = shareOnFacebook;
window.shareOnTwitter = shareOnTwitter;
window.shareOnWhatsapp = shareOnWhatsapp;

// Competiciones
window.changeCompetition = changeCompetition;
window.showCompetitionsListModal = showCompetitionsListModal;
window.selectCompetition = selectCompetition;
window.showCreateCompetitionModal = showCreateCompetitionModal;
window.createCompetition = createCompetition;

// Admin
window.showAdminDashboard = showAdminDashboard;
window.showAdminPanel = showAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.closeAdminDashboard = closeAdminDashboard;
window.openAdminTab = openAdminTab;

// Pronósticos
window.savePredictions = savePredictions;
window.changeJornada = changeJornada;
window.resetPredictions = resetPredictions;

// Utilidades
window.showNotification = showNotification;

console.log('✅ Todas las funciones exportadas a window');

