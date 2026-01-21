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

                    <p id="auth-error" style="color: var(--danger); font-size: 0.9rem; margin-bottom: 16px; display: none;"></p>

                    <button type="submit" class="btn btn-primary" style="width: 100%;" id="submit-btn">Entrar</button>
                </form>
            </div>
            
            <p style="text-align: center; margin-top: 20px; color: var(--text-muted); font-size: 0.8rem;">
                Al continuar aceptas nuestros términos y condiciones.
            </p>
        </div>
    `;

    const init = async () => {
        const form = document.getElementById('auth-form');
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const submitBtn = document.getElementById('submit-btn');
        const errorMsg = document.getElementById('auth-error');

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
            } else {
                tabRegister.classList.add('active');
                tabRegister.style.color = 'var(--text-main)';
                tabRegister.style.borderBottomColor = 'var(--secondary)'; // Different color for register
                tabLogin.classList.remove('active');
                tabLogin.style.color = 'var(--text-muted)';
                tabLogin.style.borderBottomColor = 'transparent';
                submitBtn.textContent = 'Crear Cuenta';
            }
        };

        tabLogin.addEventListener('click', () => toggleMode(true));
        tabRegister.addEventListener('click', () => toggleMode(false));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';

            const email = form.email.value;
            const password = form.password.value;

            try {
                let result;
                if (isLogin) {
                    result = await supabase.auth.signInWithPassword({ email, password });
                } else {
                    result = await supabase.auth.signUp({ email, password });
                }

                if (result.error) throw result.error;

                // Success
                if (!isLogin && !result.data.session) {
                    alert('Revisa tu email para confirmar la cuenta.');
                } else {
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
                submitBtn.textContent = isLogin ? 'Entrar' : 'Crear Cuenta';
            }
        });
    };

    return { template, init };
}
