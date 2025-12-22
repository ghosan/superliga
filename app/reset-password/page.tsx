'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [supabaseReady, setSupabaseReady] = useState(false)

  useEffect(() => {
    // El token viene en el hash (#) de la URL, no en query params
    // Ejemplo: #access_token=...&type=recovery
    
    // Esperar a que Supabase esté listo
    const checkSupabase = setInterval(() => {
      const supabase = (window as any).supabase || (window as any).supabaseClient
      if (supabase && supabase.auth && (window as any).supabaseReady) {
        setSupabaseReady(true)
        clearInterval(checkSupabase)
        
        // Verificar si hay un token en el hash
        const hash = window.location.hash
        if (hash.includes('access_token') && hash.includes('type=recovery')) {
          console.log('Token de recuperación detectado en la URL')
          // El token ya está en la sesión de Supabase, no necesitamos extraerlo manualmente
        } else {
          // Si no hay token, puede que el usuario haya llegado aquí directamente
          console.warn('No se detectó token de recuperación en la URL')
        }
      }
    }, 100)

    // Timeout después de 10 segundos
    setTimeout(() => {
      clearInterval(checkSupabase)
      if (!supabaseReady) {
        setError('Error: No se pudo conectar con el servidor. Por favor, recarga la página.')
      }
    }, 10000)

    return () => clearInterval(checkSupabase)
  }, [supabaseReady])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (!supabaseReady) {
      setError('Esperando a que el servidor esté listo...')
      return
    }

    setLoading(true)

    try {
      const supabase = (window as any).supabase || (window as any).supabaseClient
      
      if (!supabase || !supabase.auth) {
        setError('Error: Supabase no está disponible. Por favor, recarga la página.')
        setLoading(false)
        return
      }

      // Verificar que hay una sesión activa (del token de recuperación)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('El enlace de recuperación ha expirado o no es válido. Por favor, solicita uno nuevo.')
        setLoading(false)
        return
      }

      // Actualizar la contraseña
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error('Error actualizando contraseña:', updateError)
        setError(updateError.message || 'Error al actualizar la contraseña')
        setLoading(false)
        return
      }

      setSuccess(true)
      
      // Cerrar sesión y redirigir al login después de 2 segundos
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/')
      }, 2000)

    } catch (err: any) {
      console.error('Error en reset password:', err)
      setError('Error inesperado. Por favor, intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" strategy="beforeInteractive" />
      <Script src="/config.js" strategy="beforeInteractive" />
      
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        backgroundImage: 'url(/stadium-bg-all.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '8px',
            color: '#0f172a'
          }}>
            <i className="fas fa-key" style={{ marginRight: '12px', color: '#0f172a' }}></i>
            Restablecer Contraseña
          </h1>
          
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#10b981', marginBottom: '16px' }}></i>
              <p style={{ fontSize: '1rem', color: '#334155', marginBottom: '20px' }}>
                ¡Contraseña actualizada correctamente!
              </p>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Redirigiendo al inicio de sesión...
              </p>
            </div>
          ) : !supabaseReady ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#64748b', marginBottom: '16px' }}></i>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Cargando...
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '24px' }}>
                Ingresa tu nueva contraseña
              </p>

              {error && (
                <div style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}>
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}>
                    Confirmar Contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repite la contraseña"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px 28px',
                    background: loading ? '#94a3b8' : '#0f172a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </form>

              <p style={{
                textAlign: 'center',
                marginTop: '20px',
                fontSize: '14px',
                color: '#64748b'
              }}>
                <a href="/" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 700 }}>
                  Volver al inicio
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

