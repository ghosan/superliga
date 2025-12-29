# Configurar URL de Redirección en Supabase

## Problema
Si al hacer clic en el enlace de recuperación de contraseña te redirige a `localhost:3000` en lugar de tu URL de producción, es porque Supabase tiene configurada esa URL en su dashboard.

## Solución

### Paso 1: Ir a Supabase Dashboard

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto: `ujcesimljlifirauhlzn`
3. Ve a: **Authentication** (menú izquierdo)
4. Haz clic en: **URL Configuration** (o busca "Redirect URLs" en Settings)

### Paso 2: Configurar Site URL

En la sección **Site URL**, debe estar:
```
https://superliga-two.vercel.app
```

### Paso 3: Añadir Redirect URLs

En la sección **Redirect URLs** (o "Redirect URL Whitelist"), añade estas URLs (una por línea):

```
https://superliga-two.vercel.app/reset-password
https://superliga-two.vercel.app/auth/callback
https://superliga-two.vercel.app/*
```

**IMPORTANTE:** 
- Asegúrate de que **NO** esté `http://localhost:3000` en la lista
- Si está, puedes eliminarla o dejarla (no afectará si está en último lugar)
- El orden importa: Supabase usará la primera URL que coincida

### Paso 4: Guardar

1. Haz clic en **Save**
2. Espera unos segundos a que se actualice

### Paso 5: Probar

1. Ve a tu aplicación en producción: https://superliga-two.vercel.app
2. Haz clic en "¿Olvidaste tu contraseña?"
3. Ingresa tu email
4. Verifica que el email llegue con un enlace que apunte a `https://superliga-two.vercel.app/reset-password`

## Verificar que funciona

Cuando recibas el email de recuperación, el enlace debería ser algo como:
```
https://superliga-two.vercel.app/reset-password#access_token=...
```

**NO** debería ser:
```
http://localhost:3000#access_token=...
```

## Si sigue sin funcionar

1. Verifica que hayas guardado los cambios en Supabase
2. Espera 1-2 minutos (puede tomar un poco en propagarse)
3. Intenta solicitar un nuevo email de recuperación
4. Verifica en la consola del navegador que el código esté usando la URL correcta


