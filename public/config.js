// ========================================
// CONFIGURACIÓN DE SUPABASE
// ========================================
// IMPORTANTE: Las variables de entorno se leen desde window.__ENV__
// Next.js las inyectará automáticamente desde NEXT_PUBLIC_*

// Función para obtener variables de entorno (se llama dinámicamente)
function getSupabaseConfig() {
    if (typeof window === 'undefined') return { url: '', key: '' };
    
    // Intentar leer desde window.__ENV__ (inyectado por Next.js)
    const env = window.__ENV__ || {};
    const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    return { url, key };
}

// Inicializar cliente de Supabase
// El CDN de Supabase expone la librería de forma que podemos acceder a createClient
(function initSupabase() {
    function tryInit() {
        if (typeof window === 'undefined') return false;
        
        try {
            // 1. Verificar que Supabase JS esté cargado
            // El CDN puede exponer supabase de diferentes formas
            let supabaseLib = null;
            
            // Intentar diferentes formas de acceso
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                // Caso 1: window.supabase ya tiene createClient
                supabaseLib = window.supabase;
            } else if (window.supabase && typeof window.supabase.default === 'function' && typeof window.supabase.default.createClient === 'function') {
                // Caso 2: window.supabase es un módulo con default
                supabaseLib = window.supabase.default;
            } else if (window.supabasejs && typeof window.supabasejs.createClient === 'function') {
                // Caso 3: Se expone como supabasejs
                supabaseLib = window.supabasejs;
            } else if (window.Supabase && typeof window.Supabase.createClient === 'function') {
                // Caso 4: Se expone como Supabase (mayúscula)
                supabaseLib = window.Supabase;
            }
            
            if (!supabaseLib) {
                return false;
            }
            
            // 2. Leer variables de entorno dinámicamente
            const config = getSupabaseConfig();
            
            if (!config.url || !config.key) {
                return false; // Variables aún no disponibles
            }
            
            // 3. Crear cliente de Supabase
            const supabaseClient = supabaseLib.createClient(config.url, config.key);
            window.supabase = supabaseClient;
            window.supabaseClient = supabaseClient;
            window.supabaseReady = true;
            console.log('✅ Supabase inicializado correctamente');
            return true;
        } catch (error) {
            console.error('Error inicializando Supabase:', error);
            return false;
        }
    }
    
    // Intentar inmediatamente
    if (!tryInit()) {
        // Si no funciona, reintentar cada 100ms hasta 10 segundos (100 intentos)
        let attempts = 0;
        const maxAttempts = 100;
        const interval = setInterval(() => {
            attempts++;
            const success = tryInit();
            
            if (success || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts && !window.supabaseReady) {
                    const config = getSupabaseConfig();
                    if (!config.url || !config.key) {
                        console.error('❌ ERROR: Variables de entorno de Supabase no configuradas. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel o .env.local');
                    } else {
                        console.error('❌ No se pudo inicializar Supabase después de', maxAttempts, 'intentos');
                    }
                }
            }
        }, 100);
    }
})();

// Equipos de LaLiga 2025-2026
const EQUIPOS_LALIGA = [
    'Athletic Club',
    'Atlético de Madrid',
    'FC Barcelona',
    'Real Betis',
    'Celta de Vigo',
    'Deportivo Alavés',
    'Espanyol',
    'Getafe CF',
    'Girona FC',
    'Las Palmas',
    'CD Leganés',
    'RCD Mallorca',
    'CA Osasuna',
    'Rayo Vallecano',
    'Real Madrid',
    'Real Sociedad',
    'Sevilla FC',
    'Valencia CF',
    'Real Valladolid',
    'Villarreal CF'
];

// Sistema de puntuación
const PUNTUACION = {
    RESULTADO_1X2: 48,      // Acertar si gana local (1), empate (X) o visitante (2)
    GOLES_LOCAL: 15,        // Acertar goles exactos del equipo local
    GOLES_VISITANTE: 15,    // Acertar goles exactos del equipo visitante
    DIFERENCIA_GOLES: 12    // Acertar diferencia de goles
};

// Máximo de puntos por partido
const MAX_PUNTOS_PARTIDO = PUNTUACION.RESULTADO_1X2 + PUNTUACION.GOLES_LOCAL + PUNTUACION.GOLES_VISITANTE + PUNTUACION.DIFERENCIA_GOLES;

// Configuración de la temporada
const CONFIG_TEMPORADA = {
    TOTAL_JORNADAS: 38,
    PARTIDOS_POR_JORNADA: 10,
    TOTAL_PARTIDOS: 380,
    MAX_PUNTOS_TEMPORADA: 34200
};
