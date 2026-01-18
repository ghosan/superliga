# ✅ Checklist de Pruebas - SuperLiga

## 🧹 Paso 1: Limpiar Caché del Navegador
- [ ] Abrir navegador en modo Incógnito/Privado (RECOMENDADO)
  - Chrome: Ctrl+Shift+N
  - Firefox: Ctrl+Shift+P
  - Edge: Ctrl+Shift+N
- [ ] O limpiar caché manualmente:
  - F12 → Network → Marcar "Disable cache"
  - Ctrl+Shift+R para forzar recarga

---

## 🔍 Paso 2: Verificar que los `data-action` están en el HTML

1. Abre las DevTools (F12)
2. Ve a la pestaña **Elements/Inspeccionar**
3. Busca el botón "Crear Liga" en Mis Ligas
4. Verifica que el HTML muestre: `<button data-action="crear-liga">`

**Si NO ves `data-action="crear-liga"`**, los cambios aún no se aplicaron. Espera 1-2 minutos más o fuerza recarga.

---

## 🧪 Paso 3: Pruebas por Sección

### ✅ **3.1 Autenticación**
- [ ] **Iniciar Sesión**: Usuario y contraseña → Debe redirigir al Dashboard
- [ ] **Registrarse**: Crear nueva cuenta → Debe funcionar
- [ ] **Cerrar Sesión**: Botón logout → Debe volver a landing page

### ✅ **3.2 Dashboard**
- [ ] **Navegación**: Click en "Dashboard" → Debe mostrar resumen
- [ ] **Avatar de Usuario**: Click en avatar (arriba derecha) → **DEBE ABRIR MODAL DE PERFIL**
  - Si NO abre, revisa consola (F12) para ver errores

### ✅ **3.3 Mis Ligas**
1. Navega a **"Mis Ligas"** desde el menú
2. Verifica que aparece la liga "Prueba"
3. Prueba los botones:
   - [ ] **"Crear Liga"** → **DEBE ABRIR MODAL**
   - [ ] **"Unirse a Liga"** → **DEBE ABRIR MODAL**
   - [ ] Código de liga visible: `217203`

### ✅ **3.4 Mis Pronósticos**
1. Navega a **"Mis Pronósticos"**
2. Verifica:
   - [ ] **Selector de ligas**: Muestra "Prueba" como opción
   - [ ] **Seleccionar liga "Prueba"**: **DEBE CARGAR PARTIDOS**
   - [ ] **"Unirse a Liga"** (arriba): **DEBE ABRIR MODAL**
   - [ ] Hacer un pronóstico (ej: 2-1)
   - [ ] **"Guardar pronósticos"**: **DEBE GUARDAR Y MOSTRAR NOTIFICACIÓN**

### ✅ **3.5 Crear Liga (Modal)**
1. Click en **"Crear Liga"** en Mis Ligas
2. Si se abre el modal:
   - [ ] Introducir nombre: "Liga de Prueba 2"
   - [ ] (Opcional) Descripción
   - [ ] Click en "Crear Liga"
   - [ ] **DEBE**: Mostrar código generado (6 caracteres)
   - [ ] **DEBE**: Aparecer nueva liga en "Mis Ligas"

### ✅ **3.6 Unirse a Liga (Modal)**
1. Click en **"Unirse a Liga"** en Mis Ligas
2. Si se abre el modal:
   - [ ] Introducir código: `217203`
   - [ ] Click en "Unirse"
   - [ ] **DEBE**: Mostrar mensaje de éxito "Te has unido a la liga..."

---

## 🐛 Paso 4: Si algo NO funciona

### **Revisar Consola (F12 → Console)**
- [ ] Buscar mensajes rojos (errores)
- [ ] Buscar warnings amarillos:
  - Si ves: `⚠️ showCreateLigaModal no está disponible` → El script `app.js` no se cargó
  - Si ves: `QuerySelector returned null` → El botón no tiene `data-action`

### **Verificar HTML**
1. Inspeccionar el botón que NO funciona
2. Verificar que tenga `data-action="..."` en el HTML
3. Si NO tiene `data-action`, el despliegue no se aplicó correctamente

### **Verificar Funciones en Window**
1. Abre Console (F12)
2. Escribe: `window.showCreateLigaModal`
3. **Si devuelve `undefined`**: El script `app.js` no se cargó
4. **Si devuelve una función**: El script está cargado correctamente

---

## 📊 Resultado Esperado

### **✅ Todo Funciona**
- Todos los modales se abren
- Los pronósticos se guardan
- Las ligas se crean y unen correctamente

### **❌ Problemas Comunes**

| Problema | Causa | Solución |
|----------|-------|----------|
| Botones no hacen nada | `data-action` no está en HTML | Esperar re-despliegue o limpiar caché |
| "Función no está disponible" en consola | `app.js` no cargado | Verificar que `/app.js` se carga (Network tab) |
| Modales no se abren | Funciones no en `window` | Verificar exportaciones en `app.js` |

---

## 🎯 Orden Recomendado de Pruebas

1. **Login** → Verificar que funciona
2. **Avatar** → Verificar que abre perfil
3. **Mis Ligas** → Verificar que muestra "Prueba"
4. **Crear Liga** → Probar crear nueva liga
5. **Mis Pronósticos** → Probar selector y guardar pronóstico

---

**📝 Nota**: Si algún botón NO funciona después de seguir estos pasos, anota:
- Qué botón
- Qué mensaje aparece en consola (si hay)
- Si el `data-action` está en el HTML
