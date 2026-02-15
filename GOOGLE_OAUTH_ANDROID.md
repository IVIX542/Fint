# Configuración de Google OAuth para Android

## 🔴 PASO OBLIGATORIO: Configurar Redirect URL en Supabase

Para que el login con Google funcione en el APK Android, debes añadir la URL de redirect en tu proyecto de Supabase.

### Pasos en Supabase Dashboard

1. **Ir a tu proyecto de Supabase**: https://app.supabase.com/project/wcpbigmkoyzrtvrpigul

2. **Navegar a Authentication → URL Configuration**

3. **En el campo "Redirect URLs"**, añade la siguiente URL:
   ```
   com.fint.finanzaspersonales://login-callback
   ```

4. **Mantén también las URLs existentes** (para la versión web):
   - `http://localhost:8000`
   - `http://localhost:8000/`
   - Cualquier otra URL de tu dominio web

5. **Guarda los cambios**

### Verificación

Después de configurar en Supabase:

1. **Rebuild el APK** en Android Studio (Run ▶️)
2. **Prueba el Login con Google** en el dispositivo/emulador
3. Deberías ser redirigido a Google → Autorizar → Volver a la app automáticamente

## ⚠️ Errores Comunes

### Error: "redirect_uri_mismatch"
**Causa**: La URL `com.fint.finanzaspersonales://login-callback` no está añadida en Supabase Dashboard

**Solución**: Verifica que has añadido exactamente esa URL en Supabase → Authentication → URL Configuration

### El navegador se abre pero no regresa a la app
**Causa**: El intent filter en AndroidManifest.xml no está configurado correctamente

**Solución**: Ya está configurado automáticamente. Si persiste, verifica que el esquema sea exactamente `com.fint.finanzaspersonales`

## ℹ️ Cambios Realizados

### 1. AndroidManifest.xml
Se añadió un intent filter para manejar el deep link de OAuth:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <data android:scheme="com.fint.finanzaspersonales" />
    <data android:host="login-callback" />
</intent-filter>
```

### 2. login.js
Se modificó el botón de Google para detectar si estás en Android/iOS y usar el redirect correcto:

```javascript
// Detect if running in Capacitor (Android/iOS)
const isNative = window.Capacitor?.isNativePlatform();

const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
        redirectTo: isNative 
            ? 'com.fint.finanzaspersonales://login-callback'  // Android/iOS
            : window.location.origin                          // Web
    }
});
```

## 📱 Cómo Funciona

1. Usuario hace clic en "Iniciar con Google"
2. Se abre el navegador del sistema con la página de login de Google
3. Usuario autoriza la aplicación
4. Google redirige a `com.fint.finanzaspersonales://login-callback`
5. Android reconoce el esquema y abre la app Fint
6. Supabase procesa el token de autenticación
7. Usuario queda logueado automáticamente

---

**Recuerda**: Este cambio ya está aplicado en el código. Solo falta que configures la URL en Supabase Dashboard para que funcione.
