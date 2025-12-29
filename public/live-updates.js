// ========================================
// ACTUALIZACIONES EN VIVO - PARTIDOS
// ========================================
// Este script actualiza los datos de partidos en vivo cada 30 segundos
// utilizando la API interna /api/live

let liveUpdateInterval = null;
const LIVE_UPDATE_INTERVAL = 30000; // 30 segundos

/**
 * Obtiene datos en vivo de un partido desde la API interna
 * @param {number} fixtureId - ID del fixture (de API-Football)
 * @returns {Promise<Object>} Datos del partido en vivo
 */
async function fetchLiveMatchData(fixtureId) {
    try {
        const response = await fetch(`/api/live?fixture=${fixtureId}`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Error obteniendo datos en vivo para fixture ${fixtureId}:`, error);
        return null;
    }
}

/**
 * Actualiza un partido en la interfaz con datos en vivo
 * @param {number} matchId - ID del partido en la base de datos
 * @param {Object} liveData - Datos en vivo del partido
 */
function updateMatchWithLiveData(matchId, liveData) {
    // Buscar la fila del partido
    const matchRow = document.querySelector(`[data-match-id="${matchId}"]`);
    if (!matchRow) return;
    
    // Actualizar el marcador en la columna de resultado
    const resultCol = matchRow.querySelector('.col-resultado');
    if (resultCol && liveData.score) {
        const currentResult = `${liveData.score.home} - ${liveData.score.away}`;
        const minuteText = liveData.minute ? ` (${liveData.minute}')` : '';
        const statusText = liveData.status === 'LIVE' ? '⚽ EN VIVO' : '';
        
        resultCol.innerHTML = `
            <span class="result-final">${currentResult}</span>
            ${liveData.minute ? `<span style="font-size: 11px; color: var(--slate-500);">${liveData.minute}'</span>` : ''}
            ${statusText ? `<span style="font-size: 10px; color: var(--emerald-600); font-weight: 600;">${statusText}</span>` : ''}
        `;
    }
}

/**
 * Inicia las actualizaciones en vivo para los partidos visibles
 * Solo actualiza partidos que están en curso (status: LIVE o HT)
 */
function startLiveUpdates() {
    // Limpiar intervalo anterior si existe
    if (liveUpdateInterval) {
        clearInterval(liveUpdateInterval);
    }
    
    // Función que se ejecuta cada 30 segundos
    liveUpdateInterval = setInterval(async () => {
        // Obtener todos los partidos visibles
        const matchRows = document.querySelectorAll('.match-row[data-match-id]');
        
        if (matchRows.length === 0) return;
        
        // Por cada partido, intentar obtener datos en vivo
        // Nota: Necesitamos el fixture_id de API-Football para cada partido
        // Esto debería almacenarse en un atributo data-fixture-id en cada fila
        for (const row of matchRows) {
            const matchId = row.dataset.matchId;
            const fixtureId = row.dataset.fixtureId; // Debe agregarse en createMatchCard
            
            if (fixtureId) {
                const liveData = await fetchLiveMatchData(fixtureId);
                if (liveData && (liveData.status === 'LIVE' || liveData.status === 'HT' || liveData.status === '2H')) {
                    updateMatchWithLiveData(matchId, liveData);
                }
            }
        }
    }, LIVE_UPDATE_INTERVAL);
    
    console.log('✅ Actualizaciones en vivo iniciadas (cada 30 segundos)');
}

/**
 * Detiene las actualizaciones en vivo
 */
function stopLiveUpdates() {
    if (liveUpdateInterval) {
        clearInterval(liveUpdateInterval);
        liveUpdateInterval = null;
        console.log('⏹️ Actualizaciones en vivo detenidas');
    }
}

// Iniciar actualizaciones cuando se carguen los partidos
// Se puede llamar desde loadMatches después de renderizar
if (typeof window !== 'undefined') {
    window.startLiveUpdates = startLiveUpdates;
    window.stopLiveUpdates = stopLiveUpdates;
    window.fetchLiveMatchData = fetchLiveMatchData;
}




