'use client'

import Script from 'next/script'
import { useEffect } from 'react'

// Componente principal de la aplicación
export default function Home() {
  useEffect(() => {
    // Asegurar que las funciones globales están disponibles en window
    if (typeof window !== 'undefined') {
      // Las funciones se cargarán desde los scripts externos
    }
  }, [])

  return (
    <>
      {/* Página de Inicio / Login */}
      <div id="landing-page" className="page active">
        <div className="hero-section">
          <div className="hero-content">
            <div className="logo-container">
              <i className="fas fa-futbol logo-icon"></i>
              <h1>SuperLiga</h1>
            </div>
            <p className="tagline">Porra LaLiga 2025-2026</p>
            <p className="description">Pronostica los resultados de todos los partidos y compite con tus amigos</p>
            
            <div className="auth-buttons">
              <button className="btn btn-white" onClick={() => {
                if (typeof window !== 'undefined' && (window as any).showLoginModal) {
                  (window as any).showLoginModal()
                }
              }}>
                <i className="fas fa-sign-in-alt"></i> Iniciar Sesión
              </button>
              <button className="btn btn-ghost" onClick={() => {
                if (typeof window !== 'undefined' && (window as any).showRegisterModal) {
                  (window as any).showRegisterModal()
                }
              }}>
                <i className="fas fa-user-plus"></i> Registrarse
              </button>
            </div>

            <div className="features">
              <div className="feature">
                <i className="fas fa-trophy"></i>
                <h3>Compite</h3>
                <p>Demuestra que eres el mejor pronosticador</p>
              </div>
              <div className="feature">
                <i className="fas fa-users"></i>
                <h3>Crea Ligas</h3>
                <p>Invita a amigos y familiares</p>
              </div>
              <div className="feature">
                <i className="fas fa-chart-line"></i>
                <h3>Puntuaciones</h3>
                <p>Hasta 90 puntos por partido</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Login */}
      <div id="login-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-sign-in-alt"></i> Iniciar Sesión</h2>
          <form id="login-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).handleLogin) {
              (window as any).handleLogin(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input type="email" id="login-email" required placeholder="tu@email.com" />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Contraseña</label>
              <input type="password" id="login-password" required placeholder="Tu contraseña" />
              <a href="#" className="forgot-password-link" onClick={(e) => {
                e.preventDefault()
                if (typeof window !== 'undefined' && (window as any).showForgotPasswordModal) {
                  (window as any).showForgotPasswordModal()
                }
              }}>¿Olvidaste tu contraseña?</a>
            </div>
            <button type="submit" className="btn btn-primary btn-full">Entrar</button>
          </form>
          <p className="modal-link">¿No tienes cuenta? <a href="#" onClick={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).showRegisterModal) {
              (window as any).showRegisterModal()
            }
          }}>Regístrate</a></p>
        </div>
      </div>

      {/* Modal de Recuperar Contraseña */}
      <div id="forgot-password-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-key"></i> Recuperar Contraseña</h2>
          <p className="modal-info">Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
          <form id="forgot-password-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).handleForgotPassword) {
              (window as any).handleForgotPassword(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="forgot-password-email">Email</label>
              <input type="email" id="forgot-password-email" required placeholder="tu@email.com" />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              <i className="fas fa-paper-plane"></i> Enviar enlace de recuperación
            </button>
          </form>
          <p className="modal-link">
            <a href="#" onClick={(e) => {
              e.preventDefault()
              if (typeof window !== 'undefined' && (window as any).showLoginModal) {
                (window as any).showLoginModal()
              }
            }}>Volver a iniciar sesión</a>
          </p>
        </div>
      </div>

      {/* Modal de Registro */}
      <div id="register-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-user-plus"></i> Registrarse</h2>
          <form id="register-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).handleRegister) {
              (window as any).handleRegister(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="register-liga-code"><i className="fas fa-key"></i> Código de Liga (opcional)</label>
              <input type="text" id="register-liga-code" placeholder="Ej: ABC123" maxLength={10} style={{textTransform: 'uppercase'}} />
              <small className="field-hint">Si tienes un código de liga, introdúcelo. Si no, podrás unirte después desde tu perfil.</small>
            </div>
            <div className="form-group">
              <label htmlFor="register-name">Nombre completo</label>
              <input type="text" id="register-name" required placeholder="Tu nombre" />
            </div>
            <div className="form-group">
              <label htmlFor="register-email">Email</label>
              <input type="email" id="register-email" required placeholder="tu@email.com" />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Contraseña</label>
              <input type="password" id="register-password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="form-group checkbox-group">
              <input type="checkbox" id="accept-rules" required />
              <label htmlFor="accept-rules">Acepto las <a href="#" onClick={(e) => {
                e.preventDefault()
                if (typeof window !== 'undefined' && (window as any).showRulesModal) {
                  (window as any).showRulesModal()
                }
              }}>reglas del juego</a></label>
            </div>
            <button type="submit" className="btn btn-primary btn-full">Crear cuenta</button>
          </form>
          <p className="modal-link">¿Ya tienes cuenta? <a href="#" onClick={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).showLoginModal) {
              (window as any).showLoginModal()
            }
          }}>Inicia sesión</a></p>
          <p className="modal-link">¿Quieres crear una liga? <a href="#" onClick={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).showCreateFirstLigaModal) {
              (window as any).showCreateFirstLigaModal()
            }
          }}>Crear liga</a></p>
        </div>
      </div>
      
      {/* Modal Crear Primera Liga (para admins) */}
      <div id="create-first-liga-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-plus-circle"></i> Crear Nueva Liga</h2>
          <p className="modal-info">Crea una liga y obtén un código para invitar a tus amigos.</p>
          <form id="create-first-liga-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).handleCreateFirstLiga) {
              (window as any).handleCreateFirstLiga(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="first-liga-name">Nombre de la Liga</label>
              <input type="text" id="first-liga-name" required placeholder="Ej: Liga de Amigos" />
            </div>
            <div className="form-group">
              <label htmlFor="first-liga-description">Descripción (opcional)</label>
              <textarea id="first-liga-description" placeholder="Descripción de tu liga..."></textarea>
            </div>
            <hr style={{margin: '15px 0', border: 'none', borderTop: '1px solid #ddd'}} />
            <p className="modal-info"><strong>Tus datos de administrador:</strong></p>
            <div className="form-group">
              <label htmlFor="admin-name">Tu nombre</label>
              <input type="text" id="admin-name" required placeholder="Tu nombre" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-email">Tu email</label>
              <input type="email" id="admin-email" required placeholder="tu@email.com" />
            </div>
            <div className="form-group">
              <label htmlFor="admin-password">Contraseña</label>
              <input type="password" id="admin-password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="form-group checkbox-group">
              <input type="checkbox" id="accept-rules-admin" required />
              <label htmlFor="accept-rules-admin">Acepto las <a href="#" onClick={(e) => {
                e.preventDefault()
                if (typeof window !== 'undefined' && (window as any).showRulesModal) {
                  (window as any).showRulesModal()
                }
              }}>reglas del juego</a></label>
            </div>
            <button type="submit" className="btn btn-primary btn-full">Crear Liga y Cuenta</button>
          </form>
          <p className="modal-link">¿Ya tienes código? <a href="#" onClick={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).showRegisterModal) {
              (window as any).showRegisterModal()
            }
          }}>Registrarse</a></p>
        </div>
      </div>

      {/* Modal de Reglas */}
      <div id="rules-modal" className="modal">
        <div className="modal-content modal-large">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-book"></i> Reglas del Juego</h2>
          <div className="rules-content">
            <h3>El Juego</h3>
            <p>Con SuperLiga podrás pronosticar el resultado de todos los partidos de LaLiga 2025-2026. Puedes crear o unirte a ligas para competir con amigos, familiares o compañeros de trabajo.</p>
            
            <h3>Cómo Jugar</h3>
            <p>Al crear una cuenta, participas automáticamente en el juego. Podrás hacer cambios en tus pronósticos hasta que comience cada partido.</p>
            
            <h3>Sistema de Puntuación</h3>
            <p>El resultado considerado es el marcador al final de los 90 minutos (prórroga y penaltis no cuentan).</p>
            <ul>
              <li><strong>Acertar 1X2:</strong> 48 puntos</li>
              <li><strong>Goles local exactos:</strong> 15 puntos</li>
              <li><strong>Goles visitante exactos:</strong> 15 puntos</li>
              <li><strong>Diferencia de goles:</strong> 12 puntos</li>
              <li><strong>Máximo por partido:</strong> 90 puntos</li>
            </ul>
            
            <h3>Clasificaciones</h3>
            <p>Compites individualmente contra todos los miembros de tu liga. Para competir en la clasificación de liga, esta debe tener al menos 3 miembros.</p>
            
            <h3>Máximo de Puntos por Temporada</h3>
            <p>380 partidos × 90 puntos = <strong>34.200 puntos</strong></p>
          </div>
        </div>
      </div>

      {/* Dashboard Principal (después de login) */}
      <div id="dashboard-page" className="page">
        {/* Navegación */}
        <nav className="main-nav">
          <div className="nav-brand">
            <i className="fas fa-futbol"></i>
            <span>SuperLiga</span>
          </div>
          <div className="nav-competition-selector">
            <select id="competition-selector" className="competition-select" onChange={() => {
              if (typeof window !== 'undefined' && (window as any).onCompetitionChange) {
                (window as any).onCompetitionChange();
              }
            }}>
              <option value="">Cargando competiciones...</option>
            </select>
          </div>
          <div className="nav-progress">
            <span id="progress-percentage">0%</span>
            <span className="progress-label">Pronósticos</span>
          </div>
          <div className="nav-links">
            <a href="#" className="nav-link active" data-page="dashboard">
              <i className="fas fa-home"></i> Dashboard
            </a>
            <a href="#" className="nav-link" data-page="pronosticos">
              <i className="fas fa-edit"></i> Mis Pronósticos
            </a>
            <a href="#" className="nav-link" data-page="clasificaciones">
              <i className="fas fa-medal"></i> Clasificaciones
            </a>
            <a href="#" className="nav-link" data-page="ligas">
              <i className="fas fa-users"></i> Mis Ligas
            </a>
            <a href="#" className="nav-link" data-page="reglas">
              <i className="fas fa-book"></i> Reglas
            </a>
            <a href="#" className="nav-link" data-page="noticias">
              <i className="fas fa-newspaper"></i> Noticias
            </a>
            <a href="#" className="nav-link" data-page="estadisticas">
              <i className="fas fa-chart-bar"></i> Estadísticas
            </a>
            <a href="#" className="nav-link admin-link" data-page="admin" id="admin-nav-link" style={{display: 'none'}}>
              <i className="fas fa-cog"></i> Admin
            </a>
          </div>
          <div className="nav-user">
            <button className="user-profile-btn" onClick={() => {
              if (typeof window !== 'undefined' && (window as any).showProfileModal) {
                (window as any).showProfileModal()
              }
            }}>
              <div className="user-avatar-small" id="nav-avatar">
                <span id="nav-avatar-initials">US</span>
                <img id="nav-avatar-image" src="" alt="" style={{display: 'none'}} />
              </div>
              <span id="user-name">Usuario</span>
            </button>
            <button className="btn btn-small" onClick={() => {
              if (typeof window !== 'undefined' && (window as any).handleLogout) {
                (window as any).handleLogout()
              }
            }} title="Cerrar sesión">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </nav>

        {/* Contenido del Dashboard */}
        <main className="dashboard-content">
          {/* Sección Dashboard Principal */}
          <section id="dashboard-section" className="section active">
            {/* Header con Resumen */}
            <div className="dashboard-header">
              <div className="dashboard-welcome-main">
                <h1>¡Hola, <span id="dashboard-user-name">Usuario</span>!</h1>
                <div className="dashboard-badge" id="dashboard-badge">
                  <i className="fas fa-trophy"></i>
                  <span>Bienvenido</span>
                </div>
              </div>
              <div className="dashboard-summary-card">
                <div className="summary-main">
                  <span className="summary-label">Puntos Totales</span>
                  <span className="summary-value" id="dashboard-total-points">0</span>
                </div>
                <div className="summary-secondary">
                  <div className="summary-item">
                    <i className="fas fa-chart-line"></i>
                    <span id="dashboard-position">-</span>
                  </div>
                  <div className="summary-item">
                    <i className="fas fa-calendar-check"></i>
                    <span id="dashboard-jornada-info">Jornada 0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de 3 Columnas */}
            <div className="dashboard-grid">
              {/* Columna 1: Estadísticas */}
              <div className="dashboard-column">
                <div className="dashboard-card">
                  <div className="dashboard-card-header">
                    <h3><i className="fas fa-chart-bar"></i> Estadísticas totales de la liga</h3>
                    <select id="dashboard-statistics-liga-select" className="liga-selector-small" onChange={() => {
                      if (typeof window !== 'undefined' && (window as any).onDashboardStatisticsLigaChange) {
                        (window as any).onDashboardStatisticsLigaChange();
                      }
                    }}>
                      <option value="">Cargando ligas...</option>
                    </select>
                  </div>
                  <div className="dashboard-card-content">
                    <div className="stat-item">
                      <div className="stat-icon"><i className="fas fa-futbol"></i></div>
                      <div className="stat-info">
                        <span className="stat-label">Partidos Pronosticados</span>
                        <span className="stat-value" id="dashboard-predicted-matches">0</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon"><i className="fas fa-percentage"></i></div>
                      <div className="stat-info">
                        <span className="stat-label">Promedio por Partido</span>
                        <span className="stat-value" id="dashboard-avg-points">0</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-icon"><i className="fas fa-calendar-alt"></i></div>
                      <div className="stat-info">
                        <span className="stat-label">Puntos Promedio/Jornada</span>
                        <span className="stat-value" id="dashboard-avg-jornada">0</span>
                      </div>
                    </div>
                    <div className="stat-chart" id="dashboard-jornada-chart">
                      {/* Gráfico se cargará aquí */}
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna 2: Jornada Actual */}
              <div className="dashboard-column">
                <div className="dashboard-card">
                  <div className="dashboard-card-header">
                    <h3><i className="fas fa-clock"></i> Jornada Actual</h3>
                  </div>
                  <div className="dashboard-card-content">
                    <div className="jornada-status" id="dashboard-jornada-status">
                      {/* Estado se cargará aquí */}
                    </div>
                    <div className="next-matches" id="dashboard-next-matches">
                      {/* Próximos partidos se cargarán aquí */}
                    </div>
                    <button className="btn btn-primary btn-full" onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).goToPronosticos) {
                        (window as any).goToPronosticos()
                      }
                    }}>
                      <i className="fas fa-edit"></i> Hacer Pronósticos
                    </button>
                  </div>
                </div>
              </div>

              {/* Columna 3: Clasificación de Ligas */}
              <div className="dashboard-column">
                <div className="dashboard-card">
                  <div className="dashboard-card-header">
                    <h3><i className="fas fa-medal"></i> Clasificación</h3>
                    <select id="dashboard-classification-liga-select" className="liga-selector-small" onChange={() => {
                      if (typeof window !== 'undefined' && (window as any).onDashboardClassificationLigaChange) {
                        (window as any).onDashboardClassificationLigaChange();
                      }
                    }}>
                      <option value="">Cargando ligas...</option>
                    </select>
                  </div>
                  <div className="dashboard-card-content">
                    <div id="dashboard-top-ligas" className="dashboard-classification-list">
                      {/* Clasificación se cargará aquí */}
                    </div>
                    <a href="#" className="dashboard-link" onClick={(e) => {
                      e.preventDefault()
                      if (typeof window !== 'undefined' && (window as any).goToClasificaciones) {
                        (window as any).goToClasificaciones()
                      }
                    }}>
                      Ver clasificación completa <i className="fas fa-arrow-right"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección Inferior: Últimas Noticias */}
            <div className="dashboard-activity">
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3><i className="fas fa-newspaper"></i> Últimas Noticias</h3>
                  <a href="#" className="view-all-link" data-page="noticias" onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== 'undefined' && (window as any).goToNoticias) {
                      (window as any).goToNoticias();
                    }
                  }}>
                    Ver todas
                  </a>
                </div>
                <div className="dashboard-card-content">
                  <div id="dashboard-recent-activity">
                    {/* Últimas noticias se cargarán aquí */}
                  </div>
                </div>
              </div>
            </div>

            {/* Vista de Clasificación (se muestra al hacer clic en una tarjeta) */}
            <div id="dashboard-liga-detail" className="dashboard-liga-detail" style={{display: 'none'}}>
              <div className="dashboard-detail-header">
                <button className="btn btn-secondary btn-small" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).closeDashboardDetail) {
                    (window as any).closeDashboardDetail()
                  }
                }}>
                  <i className="fas fa-arrow-left"></i> Volver
                </button>
                <h2 id="dashboard-detail-title">Clasificación</h2>
              </div>
              <div id="dashboard-detail-content" className="dashboard-detail-content">
                {/* Se carga dinámicamente */}
              </div>
            </div>
          </section>

          {/* Sección Mis Pronósticos */}
          <section id="pronosticos-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-edit"></i> Mis Pronósticos</h2>
              <div className="pronosticos-selectors">
                <div className="liga-selector-pronosticos">
                  <label htmlFor="pronosticos-liga-select">
                    <i className="fas fa-users"></i> Liga:
                  </label>
                  <select id="pronosticos-liga-select" onChange={() => {
                    if (typeof window !== 'undefined' && (window as any).loadMatches) {
                      (window as any).loadMatches()
                    }
                  }}>
                    <option value="">Selecciona una liga</option>
                    {/* Se cargan dinámicamente */}
                  </select>
                </div>
                <div className="pronosticos-actions">
                  <button className="btn btn-secondary" onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).showJoinLigaModal) {
                      (window as any).showJoinLigaModal()
                    }
                  }}>
                    <i className="fas fa-sign-in-alt"></i> Unirse a Liga
                  </button>
                  <div className="jornada-selector">
                    <button className="btn btn-small" onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).changeJornada) {
                        (window as any).changeJornada(-1)
                      }
                    }}>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span id="current-jornada">Jornada 1</span>
                    <button className="btn btn-small" onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).changeJornada) {
                        (window as any).changeJornada(1)
                      }
                    }}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="matches-container" id="matches-container">
              {/* Los partidos se cargan dinámicamente */}
              <div className="loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Cargando partidos...</p>
              </div>
            </div>
            
            <div className="save-predictions">
              <button className="btn btn-primary btn-large" onClick={() => {
                if (typeof window !== 'undefined' && (window as any).savePredictions) {
                  (window as any).savePredictions()
                }
              }}>
                Guardar todos los pronósticos
              </button>
              <a href="#" className="reset-link" onClick={(e) => {
                e.preventDefault()
                if (typeof window !== 'undefined' && (window as any).resetPredictions) {
                  (window as any).resetPredictions()
                }
              }}>Comenzar de nuevo</a>
            </div>
          </section>

          {/* Sección Clasificaciones */}
          <section id="clasificaciones-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-medal"></i> Clasificaciones</h2>
            </div>
            
            <div className="classification-content">
              <div className="liga-selector">
                <select id="liga-select" onChange={() => {
                  if (typeof window !== 'undefined' && (window as any).loadLigaClassification) {
                    (window as any).loadLigaClassification()
                  }
                }}>
                  <option value="">Selecciona una liga</option>
                </select>
              </div>
              <div className="leaderboard" id="liga-leaderboard">
                {/* Se carga dinámicamente */}
              </div>
            </div>
          </section>

          {/* Sección Mis Ligas */}
          <section id="ligas-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-users"></i> Mis Ligas</h2>
              <div className="liga-actions">
                <button className="btn btn-primary" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).showCreateLigaModal) {
                    (window as any).showCreateLigaModal()
                  }
                }}>
                  <i className="fas fa-plus"></i> Crear Liga
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).showJoinLigaModal) {
                    (window as any).showJoinLigaModal()
                  }
                }}>
                  <i className="fas fa-sign-in-alt"></i> Unirse a Liga
                </button>
              </div>
            </div>
            
            <div className="ligas-container" id="ligas-container">
              {/* Las ligas se cargan dinámicamente */}
            </div>
          </section>

          {/* Sección Reglas */}
          <section id="reglas-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-book"></i> Reglas del Juego</h2>
            </div>
            
            <div className="rules-content-page">
              <div className="rules-card">
                <h3><i className="fas fa-info-circle"></i> El Juego</h3>
                <p>Con SuperLiga podrás pronosticar el resultado de todos los partidos de LaLiga 2025-2026. Puedes crear o unirte a ligas para competir con amigos, familiares o compañeros de trabajo.</p>
              </div>
              
              <div className="rules-card">
                <h3><i className="fas fa-play-circle"></i> Cómo Jugar</h3>
                <p>Al crear una cuenta, participas automáticamente en el juego. Podrás hacer cambios en tus pronósticos hasta que comience cada partido.</p>
                <ul>
                  <li>Selecciona una liga en la que participes</li>
                  <li>Elige la jornada que quieres pronosticar</li>
                  <li>Introduce el resultado que crees que tendrá cada partido</li>
                  <li>Guarda tus pronósticos antes de que comiencen los partidos</li>
                </ul>
              </div>
              
              <div className="rules-card">
                <h3><i className="fas fa-trophy"></i> Sistema de Puntuación</h3>
                <p>El resultado considerado es el marcador al final de los 90 minutos (prórroga y penaltis no cuentan).</p>
                <div className="scoring-table">
                  <div className="scoring-item">
                    <span className="scoring-label">Acertar 1X2</span>
                    <span className="scoring-points">48 puntos</span>
                  </div>
                  <div className="scoring-item">
                    <span className="scoring-label">Goles local exactos</span>
                    <span className="scoring-points">15 puntos</span>
                  </div>
                  <div className="scoring-item">
                    <span className="scoring-label">Goles visitante exactos</span>
                    <span className="scoring-points">15 puntos</span>
                  </div>
                  <div className="scoring-item">
                    <span className="scoring-label">Diferencia de goles</span>
                    <span className="scoring-points">12 puntos</span>
                  </div>
                  <div className="scoring-item highlighted">
                    <span className="scoring-label">Máximo por partido</span>
                    <span className="scoring-points">90 puntos</span>
                  </div>
                </div>
              </div>
              
              <div className="rules-card">
                <h3><i className="fas fa-medal"></i> Clasificaciones</h3>
                <p>Compites individualmente contra todos los miembros de tu liga. Para competir en la clasificación de liga, esta debe tener al menos 3 miembros.</p>
              </div>
              
              <div className="rules-card">
                <h3><i className="fas fa-calculator"></i> Máximo de Puntos por Temporada</h3>
                <p className="max-points">380 partidos × 90 puntos = <strong>34.200 puntos</strong></p>
              </div>
            </div>
          </section>

          {/* Sección Noticias */}
          <section id="noticias-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-newspaper"></i> Noticias</h2>
            </div>
            
            <div className="noticias-container">
              <div className="empty-state">
                <i className="fas fa-newspaper"></i>
                <h3>Próximamente</h3>
                <p>Las noticias estarán disponibles próximamente.</p>
              </div>
            </div>
          </section>

          {/* Sección Estadísticas */}
          <section id="estadisticas-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-chart-bar"></i> Estadísticas</h2>
            </div>
            
            <div className="estadisticas-container">
              <div className="empty-state">
                <i className="fas fa-chart-bar"></i>
                <h3>Próximamente</h3>
                <p>Las estadísticas estarán disponibles próximamente.</p>
              </div>
            </div>
          </section>

          {/* Sección Admin */}
          <section id="admin-section" className="section">
            <div className="section-header">
              <h2><i className="fas fa-cog"></i> Panel de Administración</h2>
            </div>
            
            <div className="admin-tabs">
              <button className="admin-tab-btn active" data-admin-tab="partidos">Gestionar Partidos</button>
              <button className="admin-tab-btn" data-admin-tab="resultados">Introducir Resultados</button>
              <button className="admin-tab-btn" data-admin-tab="competiciones">Competiciones</button>
              <button className="admin-tab-btn" data-admin-tab="usuarios">Usuarios</button>
              <button className="admin-tab-btn" data-admin-tab="jornadas">Jornadas</button>
              <button className="admin-tab-btn" data-admin-tab="puntos">Editar Puntos</button>
              <button className="admin-tab-btn" data-admin-tab="reiniciar">Reiniciar Liga</button>
            </div>

            {/* Gestionar Partidos */}
            <div id="partidos-admin-tab" className="admin-tab-content active">
              {/* IMPORTAR DESDE EXCEL */}
              <div className="admin-card">
                <h3><i className="fas fa-file-excel"></i> Importar Partidos</h3>
                <p className="help-text">Puedes importar partidos copiando y pegando datos o subiendo un archivo CSV/XLSX</p>
                <div className="excel-format-example">
                  <code>Formato: Jornada | Fecha (DD/MM/AAAA) | Hora (HH:MM) | Equipo Local | Equipo Visitante</code>
                  <br />
                  <small style={{color: 'var(--slate-600)'}}>Separado por tabulaciones, comas (CSV) o múltiples espacios</small>
                </div>

                {/* Opción 1: Subir archivo */}
                <div className="form-group" style={{marginTop: '20px'}}>
                  <label htmlFor="file-upload">
                    <i className="fas fa-file"></i> Subir archivo CSV o XLSX:
                  </label>
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      if (typeof window !== 'undefined' && (window as any).handleFileUpload) {
                        (window as any).handleFileUpload(e)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '2px solid var(--slate-300)',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{textAlign: 'center', margin: '16px 0', color: 'var(--slate-500)'}}>
                  <strong>O</strong>
                </div>

                {/* Opción 2: Pegar datos */}
                <div className="form-group">
                  <label htmlFor="excel-data">Pegar datos directamente:</label>
                  <textarea id="excel-data" rows={8} placeholder={`Ejemplo:
1	15/08/2025	21:00	Real Madrid	FC Barcelona
1	16/08/2025	18:30	Atlético de Madrid	Sevilla FC
1	16/08/2025	21:00	Valencia CF	Villarreal CF

O formato CSV:
1,15/08/2025,21:00,Real Madrid,FC Barcelona
1,16/08/2025,18:30,Atlético de Madrid,Sevilla FC`}></textarea>
                </div>
                <div className="excel-actions">
                  <button className="btn btn-primary" onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).importFromExcel) {
                      (window as any).importFromExcel()
                    }
                  }}>
                    <i className="fas fa-upload"></i> Importar Partidos
                  </button>
                  <button className="btn btn-secondary" onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).clearExcelData) {
                      (window as any).clearExcelData()
                    }
                  }}>
                    <i className="fas fa-trash"></i> Limpiar
                  </button>
                </div>
                <div id="import-preview" className="import-preview"></div>
              </div>

              {/* AÑADIR PARTIDO INDIVIDUAL */}
              <div className="admin-card">
                <h3><i className="fas fa-plus-circle"></i> Añadir Partido Individual</h3>
                <form id="add-match-form" onSubmit={(e) => {
                  e.preventDefault()
                  if (typeof window !== 'undefined' && (window as any).addMatch) {
                    (window as any).addMatch(e)
                  }
                }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Jornada</label>
                      <input type="number" id="match-jornada" min={1} max={38} required />
                    </div>
                    <div className="form-group">
                      <label>Fecha y Hora</label>
                      <input type="datetime-local" id="match-datetime" required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Equipo Local</label>
                      <select id="match-home" required>
                        <option value="">Seleccionar...</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Equipo Visitante</label>
                      <select id="match-away" required>
                        <option value="">Seleccionar...</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="fas fa-plus"></i> Añadir Partido
                  </button>
                </form>
              </div>
              
              <div className="admin-card">
                <h3><i className="fas fa-list"></i> Partidos por Jornada</h3>
                <div className="admin-jornada-selector">
                  <select id="admin-jornada-select" onChange={() => {
                    if (typeof window !== 'undefined' && (window as any).loadAdminMatches) {
                      (window as any).loadAdminMatches()
                    }
                  }}>
                    {/* Opciones cargadas dinámicamente */}
                  </select>
                </div>
                <div id="admin-matches-list" className="admin-matches-list">
                  {/* Lista de partidos */}
                </div>
              </div>
            </div>

            {/* Introducir Resultados */}
            <div id="resultados-admin-tab" className="admin-tab-content">
              <div className="admin-card">
                <h3><i className="fas fa-futbol"></i> Introducir Resultados</h3>
                <div className="admin-jornada-selector">
                  <select id="results-jornada-select" onChange={() => {
                    if (typeof window !== 'undefined' && (window as any).loadMatchesForResults) {
                      (window as any).loadMatchesForResults()
                    }
                  }}>
                    {/* Opciones cargadas dinámicamente */}
                  </select>
                </div>
                <div id="results-matches-list" className="results-matches-list">
                  {/* Lista de partidos para introducir resultados */}
                </div>
              </div>
            </div>

            {/* Competiciones */}
            <div id="competiciones-admin-tab" className="admin-tab-content">
              <div className="admin-card">
                <h3><i className="fas fa-trophy"></i> Gestionar Competiciones</h3>
                <p className="help-text">Crea y gestiona competiciones (La Liga, Mundial, Eurocopa, etc.). Cada competición tiene sus propios partidos, ligas y datos completamente aislados.</p>
                
                <div className="form-group" style={{marginTop: '20px'}}>
                  <button className="btn btn-primary" onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).showCreateCompetitionModal) {
                      (window as any).showCreateCompetitionModal()
                    }
                  }}>
                    <i className="fas fa-plus"></i> Crear Nueva Competición
                  </button>
                </div>
                
                <div id="competitions-list" className="competitions-list" style={{marginTop: '24px'}}>
                  {/* Lista de competiciones */}
                </div>
              </div>
            </div>

            {/* Usuarios */}
            <div id="usuarios-admin-tab" className="admin-tab-content">
              <div className="admin-card">
                <h3><i className="fas fa-users"></i> Lista de Usuarios</h3>
                <div id="users-list" className="users-list">
                  {/* Lista de usuarios */}
                </div>
              </div>
            </div>

            {/* Jornadas */}
            <div id="jornadas-admin-tab" className="admin-tab-content">
              <div className="admin-card">
                <h3><i className="fas fa-calendar"></i> Gestionar Jornadas</h3>
                <form id="set-active-jornada-form" onSubmit={(e) => {
                  e.preventDefault()
                  if (typeof window !== 'undefined' && (window as any).setActiveJornada) {
                    (window as any).setActiveJornada(e)
                  }
                }}>
                  <div className="form-group">
                    <label>Jornada Activa</label>
                    <input type="number" id="active-jornada" min={1} max={38} required />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="fas fa-check"></i> Establecer como Activa
                  </button>
                </form>
              </div>
            </div>

            {/* Editar Puntos de Usuario */}
            <div id="puntos-admin-tab" className="admin-tab-content">
              <div className="admin-card">
                <h3><i className="fas fa-edit"></i> Editar Puntos de Usuario</h3>
                <p className="help-text">Selecciona una liga y un usuario para editar sus puntos en esa liga.</p>
                
                <div className="form-group">
                  <label htmlFor="edit-puntos-liga-select">Liga</label>
                  <select id="edit-puntos-liga-select" onChange={() => {
                    if (typeof window !== 'undefined' && (window as any).loadUsersForLiga) {
                      (window as any).loadUsersForLiga()
                    }
                  }}>
                    <option value="">Selecciona una liga</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-puntos-user-select">Usuario</label>
                  <select id="edit-puntos-user-select">
                    <option value="">Primero selecciona una liga</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-puntos-value">Nuevos Puntos</label>
                  <input type="number" id="edit-puntos-value" min="0" placeholder="0" />
                  <p className="help-text-small">Los puntos actuales del usuario se mostrarán al seleccionarlo</p>
                </div>

                <div id="edit-puntos-current" className="info-box" style={{display: 'none'}}>
                  <strong>Puntos actuales:</strong> <span id="edit-puntos-current-value">0</span>
                </div>

                <button className="btn btn-primary" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).updateUserPoints) {
                    (window as any).updateUserPoints()
                  }
                }}>
                  <i className="fas fa-save"></i> Actualizar Puntos
                </button>
              </div>
            </div>

            {/* Reiniciar Liga */}
            <div id="reiniciar-admin-tab" className="admin-tab-content">
              <div className="admin-card warning-card">
                <h3><i className="fas fa-exclamation-triangle"></i> Reiniciar Liga</h3>
                <p className="help-text warning-text">
                  Esta acción eliminará <strong>TODOS</strong> los puntos de todos los usuarios en la liga seleccionada. 
                  Esta acción NO se puede deshacer.
                </p>
                
                <div className="form-group">
                  <label htmlFor="reiniciar-liga-select">Liga a Reiniciar</label>
                  <select id="reiniciar-liga-select">
                    <option value="">Selecciona una liga</option>
                  </select>
                </div>

                <div id="reiniciar-liga-info" className="info-box" style={{display: 'none'}}>
                  <p><strong>Miembros:</strong> <span id="reiniciar-liga-members">0</span></p>
                  <p><strong>Puntos totales a eliminar:</strong> <span id="reiniciar-liga-total-points">0</span></p>
                </div>

                <div className="form-group checkbox-group">
                  <input type="checkbox" id="reiniciar-liga-confirm" />
                  <label htmlFor="reiniciar-liga-confirm">Confirmo que quiero eliminar todos los puntos de esta liga</label>
                </div>

                <button className="btn btn-danger" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).resetLiga) {
                    (window as any).resetLiga()
                  }
                }}>
                  <i className="fas fa-trash"></i> Reiniciar Liga
                </button>
              </div>

              <div className="admin-card">
                <h3><i className="fas fa-broom"></i> Reiniciar Web (Eliminar Partidos)</h3>
                <p className="help-text warning-text">
                  Esta acción eliminará <strong>TODOS</strong> los partidos y pronósticos de la base de datos. 
                  Los usuarios y ligas se mantendrán, pero todos los puntos se reiniciarán a 0.
                </p>

                <div className="form-group checkbox-group">
                  <input type="checkbox" id="reiniciar-web-confirm" />
                  <label htmlFor="reiniciar-web-confirm">Confirmo que quiero eliminar todos los partidos</label>
                </div>

                <button className="btn btn-danger" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).resetWeb) {
                    (window as any).resetWeb()
                  }
                }}>
                  <i className="fas fa-trash-alt"></i> Eliminar Todos los Partidos
                </button>
              </div>

              <div className="admin-card">
                <h3><i className="fas fa-user-times"></i> Reiniciar Puntos de Todos los Usuarios</h3>
                <p className="help-text warning-text">
                  Esta acción establecerá los puntos de <strong>TODOS</strong> los usuarios a 0, 
                  sin eliminar partidos ni pronósticos.
                </p>

                <button className="btn btn-danger" onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).resetAllUserPoints) {
                    (window as any).resetAllUserPoints()
                  }
                }}>
                  <i className="fas fa-sync-alt"></i> Reiniciar Todos los Puntos
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modal Crear Liga */}
      <div id="create-liga-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-plus-circle"></i> Crear Nueva Liga</h2>
          <form id="create-liga-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).createLiga) {
              (window as any).createLiga(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="liga-name">Nombre de la Liga</label>
              <input type="text" id="liga-name" required placeholder="Mi Liga de Amigos" />
            </div>
            <div className="form-group">
              <label htmlFor="liga-description">Descripción (opcional)</label>
              <textarea id="liga-description" placeholder="Descripción de tu liga..."></textarea>
            </div>
            <button type="submit" className="btn btn-primary btn-full">Crear Liga</button>
          </form>
        </div>
      </div>

      {/* Modal Unirse a Liga */}
      <div id="join-liga-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-sign-in-alt"></i> Unirse a Liga</h2>
          <form id="join-liga-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).joinLiga) {
              (window as any).joinLiga(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="liga-code">Código de la Liga</label>
              <input type="text" id="liga-code" required placeholder="Introduce el código" />
            </div>
            <button type="submit" className="btn btn-primary btn-full">Unirse</button>
          </form>
        </div>
      </div>

      {/* Modal Detalle Liga */}
      <div id="liga-detail-modal" className="modal">
        <div className="modal-content modal-large">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <div id="liga-detail-content">
            {/* Contenido cargado dinámicamente */}
          </div>
        </div>
      </div>

      {/* Modal Perfil de Usuario */}
      <div id="profile-modal" className="modal">
        <div className="modal-content">
          <span className="close-modal" onClick={() => {
            if (typeof window !== 'undefined' && (window as any).closeModals) {
              (window as any).closeModals()
            }
          }}>&times;</span>
          <h2><i className="fas fa-user-circle"></i> Mi Perfil</h2>
          
          <div className="profile-avatar-section">
            <div className="profile-avatar-preview" id="avatar-preview">
              <span id="avatar-initials">US</span>
              <img id="avatar-image" src="" alt="" style={{display: 'none'}} />
            </div>
            <div className="profile-avatar-actions">
              <input type="file" id="avatar-input" accept="image/*" style={{display: 'none'}} onChange={(e) => {
                if (typeof window !== 'undefined' && (window as any).previewAvatar) {
                  (window as any).previewAvatar(e)
                }
              }} />
              <button className="btn btn-secondary btn-small" onClick={() => {
                const input = document.getElementById('avatar-input')
                if (input) input.click()
              }}>
                <i className="fas fa-camera"></i> Cambiar foto
              </button>
              <button className="btn btn-small" onClick={() => {
                if (typeof window !== 'undefined' && (window as any).removeAvatar) {
                  (window as any).removeAvatar()
                }
              }} id="remove-avatar-btn" style={{display: 'none'}}>
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <form id="profile-form" onSubmit={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && (window as any).saveProfile) {
              (window as any).saveProfile(e)
            }
          }}>
            <div className="form-group">
              <label htmlFor="profile-name">Nombre</label>
              <input type="text" id="profile-name" required placeholder="Tu nombre" />
            </div>
            <div className="form-group">
              <label htmlFor="profile-email">Email</label>
              <input type="email" id="profile-email" disabled placeholder="tu@email.com" />
              <small className="field-hint">El email no se puede cambiar</small>
            </div>
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value" id="profile-points">0</span>
                <span className="stat-label">Puntos totales</span>
              </div>
              <div className="stat-item">
                <span className="stat-value" id="profile-ligas">0</span>
                <span className="stat-label">Ligas</span>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              <i className="fas fa-save"></i> Guardar cambios
            </button>
          </form>
          
          <div className="profile-join-liga-section">
            <hr style={{margin: '24px 0', border: 'none', borderTop: '1px solid var(--slate-200)'}} />
            <h3 style={{fontSize: '14px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '12px'}}>
              <i className="fas fa-users"></i> Unirse a una Liga
            </h3>
            <form id="profile-join-liga-form" onSubmit={(e) => {
              e.preventDefault()
              if (typeof window !== 'undefined' && (window as any).joinLigaFromProfile) {
                (window as any).joinLigaFromProfile(e)
              }
            }}>
              <div className="form-group">
                <label htmlFor="profile-liga-code">Código de Liga</label>
                <input type="text" id="profile-liga-code" placeholder="Ej: ABC123" maxLength={10} style={{textTransform: 'uppercase'}} />
                <small className="field-hint">Introduce el código que te proporcionó el creador de la liga</small>
              </div>
              <button type="submit" className="btn btn-secondary btn-full">
                <i className="fas fa-sign-in-alt"></i> Unirse a Liga
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-section">
            <div className="footer-brand">
              <div className="footer-logo">
                <i className="fas fa-futbol"></i>
                <span>SuperLiga</span>
              </div>
              <p className="footer-copyright">© 2025 SuperLiga. Todos los derechos reservados.</p>
            </div>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">Aplicación</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Cómo se juega</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Reglas</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Puntuación</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>FAQ</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">Ligas</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Crear Liga</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Unirse a Liga</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Mis Ligas</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Clasificación</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">Ayuda</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Contacto</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Soporte</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Privacidad</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Términos</a></li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Notificaciones */}
      <div id="notification" className="notification">
        <span id="notification-message"></span>
      </div>

      {/* Scripts - Cargar en orden: Supabase -> config -> app */}
      <Script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" strategy="afterInteractive" />
      <Script src="/config.js" strategy="afterInteractive" />
      <Script src="/app.js" strategy="afterInteractive" />
      <Script src="/live-updates.js" strategy="lazyOnload" />
    </>
  )
}

