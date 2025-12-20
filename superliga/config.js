// ========================================
// CONFIGURACIÓN DE SUPABASE
// ========================================
// IMPORTANTE: Debes reemplazar estos valores con los de tu proyecto de Supabase
// Sigue la guía GUIA_CONFIGURACION.md para obtener estos datos

const SUPABASE_URL = 'https://ujcesimljlifirauhlzn.supabase.co';  // Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2VzaW1samxpZmlyYXVobHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwOTYsImV4cCI6MjA3MzU0NjA5Nn0.h4iaFXK3ZtXzUIwMIY7GtUswAQR51zyD_sKCR9sRjaQ';  // Reemplaza con tu Anon Key

// Inicializar cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

