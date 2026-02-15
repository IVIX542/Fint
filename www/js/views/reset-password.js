import { supabase } from '../supabase.js';

export default async function () {
    const template = `
        <div class="reset-password-view fade-in" style="max-width: 400px; margin: 0 auto; padding: 20px 0 80px 0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: var(--primary);">Fint.</h1>
                <p style="color: var(--text-muted);">Restablecer Contraseña</p>
            </div>

            <div class="card">
                <form id="reset-form">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Nueva Contraseña</label>
                        <input type="password" name="password" required placeholder="mínimo 6 caracteres" minlength="6">
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Confirmar Contraseña</label>
                        <input type="password" name="confirm_password" required placeholder="Repite la contraseña" minlength="6">
                    </div>

                    <p id="reset-error" style="color: var(--danger); font-size: 0.9rem; margin-bottom: 16px; display: none;"></p>
                    <p id="reset-success" style="color: var(--secondary); font-size: 0.9rem; margin-bottom: 16px; display: none;">Contraseña actualizada correctamente. Redirigiendo...</p>

                    <button type="submit" class="btn btn-primary" style="width: 100%;" id="submit-btn">Guardar Contraseña</button>
                </form>
            </div>
        </div>
    `;

    const init = async () => {
        const form = document.getElementById('reset-form');
        const submitBtn = document.getElementById('submit-btn');
        const errorMsg = document.getElementById('reset-error');
        const successMsg = document.getElementById('reset-success');

        // Check for session immediately
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            // Try to wait for auto-refresh (Supabase processing the hash)
            console.log('No session in reset-view, waiting for recovery...');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verificando enlace...';

            // Allow a moment for onAuthStateChange to fire if it hasn't yet
            setTimeout(async () => {
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (!newSession) {
                    errorMsg.textContent = 'Enlace inválido o expirado. Por favor solicita uno nuevo.';
                    errorMsg.style.display = 'block';
                    submitBtn.textContent = 'Enlace Inválido';
                } else {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Guardar Contraseña';
                }
            }, 2000);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';

            const password = form.password.value;
            const confirmPassword = form.confirm_password.value;

            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!currentSession) {
                errorMsg.textContent = 'La sesión ha expirado. Recarga la página.';
                errorMsg.style.display = 'block';
                return;
            }

            if (password !== confirmPassword) {
                errorMsg.textContent = 'Las contraseñas no coinciden';
                errorMsg.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            try {
                const { error } = await supabase.auth.updateUser({ password: password });

                if (error) throw error;

                successMsg.style.display = 'block';
                setTimeout(() => {
                    window.location.hash = '/';
                }, 2000);

            } catch (err) {
                console.error('Reset Password Error:', err);
                errorMsg.textContent = err.message || 'Error al actualizar contraseña';
                errorMsg.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Contraseña';
            }
        });
    };

    return { template, init };
}
