import { NextRequest, NextResponse } from 'next/server';

// Cache en memoria para almacenar respuestas
const cache = new Map<string, { data: any; timestamp: number }>();

// Tiempo de cache: 120 segundos
const CACHE_DURATION = 120 * 1000;

/**
 * API Route para obtener datos de partidos en vivo desde API-Football
 * 
 * Esta API:
 * - Consume API-Football (API key desde variables de entorno)
 * - Cachea las respuestas durante 120 segundos
 * - Devuelve solo los datos necesarios: equipos, marcador, minuto, estado
 * 
 * Parámetros de consulta:
 * - fixture: ID del partido (fixture_id de API-Football)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fixtureId = searchParams.get('fixture');

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro fixture' },
        { status: 400 }
      );
    }

    // Verificar cache
    const cacheKey = `fixture_${fixtureId}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Retornar datos del cache
      return NextResponse.json(cached.data);
    }

    // Obtener API key desde variables de entorno
    const apiKey = process.env.API_FOOTBALL_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API_FOOTBALL_KEY no configurada' },
        { status: 500 }
      );
    }

    // Llamar a API-Football
    const apiUrl = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      },
      // Cache en el navegador (opcional, pero útil)
      next: { revalidate: 120 }
    });

    if (!response.ok) {
      throw new Error(`API-Football error: ${response.status}`);
    }

    const apiData = await response.json();

    // Extraer solo los datos necesarios
    if (!apiData.response || apiData.response.length === 0) {
      return NextResponse.json(
        { error: 'Partido no encontrado' },
        { status: 404 }
      );
    }

    const fixture = apiData.response[0];
    const { teams, goals, fixture: fixtureInfo } = fixture;

    // Formatear respuesta con solo los datos necesarios
    const formattedData = {
      teams: {
        home: teams.home.name,
        away: teams.away.name
      },
      score: {
        home: goals.home !== null ? goals.home : 0,
        away: goals.away !== null ? goals.away : 0
      },
      minute: fixtureInfo.status?.elapsed || null,
      status: fixtureInfo.status?.short || 'NS' // NS = Not Started
    };

    // Guardar en cache
    cache.set(cacheKey, {
      data: formattedData,
      timestamp: Date.now()
    });

    // Limpiar cache antiguo (opcional, para evitar memoria excesiva)
    if (cache.size > 100) {
      const now = Date.now();
      const entries = Array.from(cache.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > CACHE_DURATION) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error('Error en API /api/live:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener datos del partido' },
      { status: 500 }
    );
  }
}

