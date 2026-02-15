import { supabase } from '../supabase.js';
import { syncManager } from '../sync.js';

export default async function () {
    const template = `
        <div class="login-view fade-in" style="max-width: 400px; margin: 0 auto; padding-top: 40px;">
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: var(--primary);">Fint.</h1>
                <p style="color: var(--text-muted);">Tus finanzas, sincronizadas.</p>
            </div>

            <div class="card">
                <div style="display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
                    <button id="tab-login" class="tab-btn active" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid var(--primary); color: var(--text-main); font-weight: 500;">Iniciar Sesión</button>
                    <button id="tab-register" class="tab-btn" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 500;">Registrarse</button>
                </div>

                <form id="auth-form">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Email</label>
                        <input type="email" name="email" required placeholder="tu@email.com">
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Contraseña</label>
                        <input type="password" name="password" required placeholder="••••••••" minlength="6">
                    </div>

                    <a href="#" id="forgot-link" style="display: block; text-align: right; font-size: 0.9rem; color: var(--primary); margin-bottom: 16px; text-decoration: none;">¿Olvidaste tu contraseña?</a>

                    <p id="auth-error" style="color: var(--danger); font-size: 0.9rem; margin-bottom: 16px; display: none;"></p>

                    <button type="submit" class="btn btn-primary" style="width: 100%;" id="submit-btn">Entrar</button>
                </form>
                <div style="text-align:center; margin: 20px 0; color: var(--text-muted); font-size: 0.8rem; display: flex; align-items: center; gap: 10px;">
                    <span style="flex:1; height:1px; background:var(--border);"></span>
                    <span>O</span>
                    <span style="flex:1; height:1px; background:var(--border);"></span>
                </div>

                <button type="button" id="google-login-btn" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: white; color: #333; border: 1px solid #ddd; font-weight: 500;">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                    Iniciar con Google
                </button>
            </div>
            
            <p style="text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 0.8rem;">
                Al continuar aceptas nuestros términos y condiciones.
            </p>

            <button id="guest-btn" class="btn" style="width: 100%; margin-top: 10px; background: transparent; color: var(--text-muted); border: 1px solid transparent;">
                Continuar sin cuenta
            </button>
        </div>
    `;

    const init = async () => {
        const form = document.getElementById('auth-form');
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const submitBtn = document.getElementById('submit-btn');
        const errorMsg = document.getElementById('auth-error');
        const guestBtn = document.getElementById('guest-btn');
        const forgotLink = document.getElementById('forgot-link');
        const googleBtn = document.getElementById('google-login-btn');

        // Hide Google button on Android (WebView blocks OAuth)
        const isNative = window.Capacitor?.isNativePlatform();
        if (isNative && googleBtn) {
            // Find and hide the "O" separator div (it's right before the Google button)
            const separator = googleBtn.previousElementSibling;
            if (separator) separator.style.display = 'none';
            googleBtn.style.display = 'none';
        }

        if (guestBtn) {
            if (guestBtn) {
                guestBtn.addEventListener('click', () => {
                    // Direct access, no confirm to avoid issues
                    localStorage.setItem('fint_guest_mode', 'true');
                    // Force reload to ensure App / Auth checks run clean
                    window.location.href = '/';
                    window.location.reload();
                });
            }
        }

        let isLogin = true;

        const toggleMode = (login) => {
            isLogin = login;
            errorMsg.style.display = 'none';
            if (isLogin) {
                tabLogin.classList.add('active');
                tabLogin.style.color = 'var(--text-main)';
                tabLogin.style.borderBottomColor = 'var(--primary)';
                tabRegister.classList.remove('active');
                tabRegister.style.color = 'var(--text-muted)';
                tabRegister.style.borderBottomColor = 'transparent';
                submitBtn.textContent = 'Entrar';
                // Show forgot link for Login
                forgotLink.style.display = 'block';
            } else {
                tabRegister.classList.add('active');
                tabRegister.style.color = 'var(--text-main)';
                tabRegister.style.borderBottomColor = 'var(--secondary)'; // Different color for register
                tabLogin.classList.remove('active');
                tabLogin.style.color = 'var(--text-muted)';
                tabLogin.style.borderBottomColor = 'transparent';
                submitBtn.textContent = 'Crear Cuenta';
                // Hide forgot link for Register
                forgotLink.style.display = 'none';
            }
        };

        tabLogin.addEventListener('click', () => toggleMode(true));
        tabRegister.addEventListener('click', () => toggleMode(false));

        // Google button already retrieved above, just add listener if exists
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    // Detect if running in Capacitor (Android/iOS)
                    const isNative = window.Capacitor?.isNativePlatform();

                    if (isNative && window.Capacitor?.Plugins?.Browser) {
                        // Native: Use Browser plugin to open OAuth in system browser
                        // Supabase will handle the redirect automatically
                        const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: 'com.fint.finanzaspersonales://login-callback'
                            }
                        });

                        if (error) throw error;
                        // Browser will open automatically, and after auth will redirect back to app

                    } else {
                        // Web: Use normal OAuth flow
                        const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: window.location.origin
                            }
                        });
                        if (error) throw error;
                    }
                    // Note: After auth, session will be handled by onAuthStateChange in app.js
                } catch (err) {
                    console.error('Google Auth Error:', err);
                    alert('Error al iniciar con Google: ' + err.message);
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';

            const email = form.email.value;
            const password = form.password.value;

            try {
                if (isLogin) {
                    result = await supabase.auth.signInWithPassword({ email, password });
                } else {
                    // Check if we are in recovery mode
                    if (isRecovery) {
                        // RECOVERY FLOW
                        // RECOVERY FLOW
                        // Send to root with recovery token. App.js handles the routing via PASSWORD_RECOVERY event.
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: window.location.origin
                        });

                        if (error) throw error;

                        alert('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
                        toggleMode(true); // Back to login
                        return;
                    }

                    result = await supabase.auth.signUp({ email, password });
                }

                if (result && result.error) throw result.error;

                // Success
                if (!isLogin && !result.data.session) {
                    alert('Revisa tu email para confirmar la cuenta.');
                } else if (!isRecovery) {
                    // Trigger Pull
                    if (typeof syncManager.pullFromCloud === 'function') {
                        await syncManager.pullFromCloud();
                    }
                    // Redirect to home/dashboard
                    window.location.hash = '/';
                }

            } catch (err) {
                errorMsg.textContent = err.message || 'Error de autenticación';
                errorMsg.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                if (isRecovery) {
                    submitBtn.textContent = 'Enviar enlace';
                } else {
                    submitBtn.textContent = isLogin ? 'Entrar' : 'Crear Cuenta';
                }
            }
        });

        // Link handling logic moved below


        let isRecovery = false;

        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            isRecovery = !isRecovery;

            const passDiv = form.querySelector('div:nth-child(2)');
            const title = document.querySelector('h1').nextElementSibling;

            if (isRecovery) {
                passDiv.style.display = 'none';
                form.password.required = false;  // CRITICAL FIX: Remove required
                forgotLink.textContent = 'Volver al inicio de sesión';
                submitBtn.textContent = 'Enviar enlace';
                title.textContent = 'Recuperar Contraseña';
                tabLogin.parentElement.style.display = 'none';
                errorMsg.style.display = 'none';
                isLogin = false; // Prevent standard login logic
            } else {
                passDiv.style.display = 'block';
                form.password.required = true;   // Restore required
                forgotLink.textContent = '¿Olvidaste tu contraseña?';
                submitBtn.textContent = 'Entrar';
                title.textContent = 'Tus finanzas, sincronizadas.';
                tabLogin.parentElement.style.display = 'flex';
                toggleMode(true);
            }
        });
    };

    return { template, init };
}

