import { NextRequest, NextResponse } from 'next/server';

// Marcar esta ruta como dinámica (requerido porque usa searchParams)
export const dynamic = 'force-dynamic';

// Cache en memoria para almacenar respuestas
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting simple en memoria
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests por minuto

// Tiempo de cache: 120 segundos
const CACHE_DURATION = 120 * 1000;

/**
 * Validar y sanitizar el fixtureId
 */
function validateFixtureId(fixtureId: string | null): number | null {
  if (!fixtureId) return null;
  
  // Eliminar espacios y validar que sea solo números
  const cleaned = fixtureId.trim();
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }
  
  const num = parseInt(cleaned, 10);
  
  // Validar rango razonable (1 a 10 millones)
  if (isNaN(num) || num < 1 || num > 10000000) {
    return null;
  }
  
  return num;
}

/**
 * Verificar rate limiting
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimit.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

/**
 * Obtener IP del cliente
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

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
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.' },
        { status: 429 }
      );
    }

    // Validar y sanitizar input
    const searchParams = request.nextUrl.searchParams;
    const fixtureIdRaw = searchParams.get('fixture') || searchParams.get('fixtureId');
    const fixtureId = validateFixtureId(fixtureIdRaw);

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'ID de partido inválido' },
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
    // Usar parámetros codificados para evitar inyección de URL
    const apiUrl = new URL('https://v3.football.api-sports.io/fixtures');
    apiUrl.searchParams.set('id', fixtureId.toString());
    
    const response = await fetch(apiUrl.toString(), {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      },
      // Timeout de 10 segundos
      signal: AbortSignal.timeout(10000),
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
    // No exponer detalles del error al cliente
    console.error('Error en API /api/live:', error);
    
    // Limpiar rate limit en caso de error
    const clientIP = getClientIP(request);
    rateLimit.delete(clientIP);
    
    return NextResponse.json(
      { error: 'Error al obtener datos del partido. Por favor, intenta más tarde.' },
      { status: 500 }
    );
  }
}

