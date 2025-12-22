// ========================================
// CONFIGURACIÓN DE SUPABASE
// ========================================
// IMPORTANTE: Las variables de entorno se leen desde window.__ENV__
// Next.js las inyectará automáticamente desde NEXT_PUBLIC_*

// Leer variables desde window.__ENV__ (inyectado por Next.js)
// IMPORTANTE: No usar valores por defecto hardcodeados en producción
// Las variables deben estar configuradas en .env.local y Vercel
const SUPABASE_URL = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';

// Validar que las variables estén configuradas
if (typeof window !== 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
    console.error('❌ ERROR: Variables de entorno de Supabase no configuradas. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Inicializar cliente de Supabase
// El CDN de Supabase expone la librería de forma que podemos acceder a createClient
(function initSupabase() {
    function tryInit() {
        if (typeof window === 'undefined') return;
        
        try {
            // El CDN de Supabase expone supabase.createClient
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                window.supabase = supabaseClient;
                window.supabaseClient = supabaseClient;
                console.log('✅ Supabase inicializado correctamente');
                window.supabaseReady = true;
                return true;
            }
        } catch (error) {
            console.error('Error inicializando Supabase:', error);
        }
        
        return false;
    }
    
    // Intentar inmediatamente
    if (!tryInit()) {
        // Si no funciona, reintentar cada 100ms hasta 5 segundos
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
            attempts++;
            if (tryInit() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts && !window.supabaseReady) {
                    console.error('❌ No se pudo inicializar Supabase después de', maxAttempts, 'intentos');
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
