import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SuperLiga - Porra LaLiga 2025-2026',
  description: 'Pronostica los resultados de todos los partidos y compite con tus amigos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        {/* Fuente Inter (estilo Tailwind) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        {/* Inyectar variables de entorno para el cliente */}
        {/* Este script debe ejecutarse ANTES que config.js */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.__ENV__ = window.__ENV__ || {};
                // Leer desde process.env (Next.js) o usar valores por defecto si no están configuradas
                window.__ENV__.NEXT_PUBLIC_SUPABASE_URL = ${JSON.stringify(
                  process.env.NEXT_PUBLIC_SUPABASE_URL || 
                  'https://ujcesimljlifirauhlzn.supabase.co'
                )};
                window.__ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY = ${JSON.stringify(
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2VzaW1samxpZmlyYXVobHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwOTYsImV4cCI6MjA3MzU0NjA5Nn0.h4iaFXK3ZtXzUIwMIY7GtUswAQR51zyD_sKCR9sRjaQ'
                )};
                console.log('📦 Variables de entorno inyectadas:', {
                  hasUrl: !!window.__ENV__.NEXT_PUBLIC_SUPABASE_URL,
                  hasKey: !!window.__ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                  fromEnv: ${JSON.stringify(!!process.env.NEXT_PUBLIC_SUPABASE_URL)}
                });
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

