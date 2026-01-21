import { dbActions } from '../db.js';
import { supabase } from '../supabase.js';
import { syncManager } from '../sync.js?v=14'; // Forced refresh

export default async function () {
    let userEmail = 'Usuario Local';
    let profile = { username: '', currency: 'EUR', avatar_url: '' };
    let sessionUser = null;

    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            sessionUser = session.user;
            userEmail = session.user.email;

            // Fetch Profile
            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (data) {
                profile = data;
            } else {
                profile.username = session.user.user_metadata?.username || userEmail.split('@')[0];
            }
        }
    }

    const currentAvatar = profile.avatar_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';

    const template = `
        <div class="profile-view fade-in">
            <h2>Mi Perfil (v9)</h2>
            
            <div class="card" style="text-align: center; padding: 30px;">
                <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 16px;">
                    <img id="profile-avatar" src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: var(--border); border: 2px solid var(--primary);">
                    <button id="edit-avatar-btn" style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">✎</button>
                </div>
                <h3>${profile.username || userEmail}</h3>
                <p style="color: var(--text-muted); margin-bottom: 12px;">${supabase ? 'Sincronización Activa' : 'Modo Offline'}</p>
                <button id="manual-sync-btn" class="btn btn-primary" style="margin-bottom: 12px; width: 100%;">⚡ Sincronizar Ahora</button>
                <button id="logout-btn" class="btn" style="margin-top: 8px; background: var(--bg-body); color: var(--danger); border: 1px solid var(--danger); width: 100%;">Cerrar Sesión</button>
            </div>

            <!-- Avatar Selection Modal (Hidden by default) -->
            <div id="avatar-modal" class="card hidden" style="border: 2px solid var(--primary);">
                <h3 style="margin-bottom: 12px;">Cambiar Avatar</h3>
                
                <div class="tabs" style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <button class="tab-link active" data-tab="presets">Premium</button>
                    <button class="tab-link" data-tab="upload">Subir</button>
                    <button class="tab-link" data-tab="ai">Generar IA</button>
                </div>

                <div id="tab-presets" class="tab-content">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                        <img src="assets/avatars/avatar_cyberpunk.png" class="preset-avatar" style="width: 100%; border-radius: 50%; cursor: pointer; border: 2px solid transparent;">
                        <img src="assets/avatars/avatar_nature.png" class="preset-avatar" style="width: 100%; border-radius: 50%; cursor: pointer; border: 2px solid transparent;">
                        <img src="assets/avatars/avatar_abstract.png" class="preset-avatar" style="width: 100%; border-radius: 50%; cursor: pointer; border: 2px solid transparent;">
                        <img src="assets/avatars/avatar_robot.png" class="preset-avatar" style="width: 100%; border-radius: 50%; cursor: pointer; border: 2px solid transparent;">
                    </div>
                </div>

                <div id="tab-upload" class="tab-content hidden">
                    <input type="file" id="file-upload" accept="image/*">
                </div>

                <div id="tab-ai" class="tab-content hidden">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="ai-seed" placeholder="Escribe algo..." style="flex: 1;">
                        <button id="btn-generate-ai" class="btn btn-primary">Generar</button>
                    </div>
                    <div id="ai-preview" style="margin-top: 12px; text-align: center;"></div>
                </div>

                <div style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="cancel-avatar" class="btn" style="background: transparent;">Cancelar</button>
                    <button id="save-avatar" class="btn btn-primary">Guardar</button>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 16px; font-size: 1rem;">Editar Perfil</h3>
                <form id="profile-form" style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="color: var(--text-muted);">Nombre de Usuario</label>
                        <input type="text" name="username" value="${profile.username || ''}" placeholder="Tu Nombre">
                    </div>
                    <div>
                         <label style="color: var(--text-muted);">Moneda Preferida</label>
                         <select name="currency">
                            <option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>Euro (€)</option>
                            <option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>Dólar ($)</option>
                            <option value="MXN" ${profile.currency === 'MXN' ? 'selected' : ''}>Peso Mexicano ($)</option>
                         </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </form>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 16px; font-size: 1rem;">Ajustes</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                    <span>Modo Oscuro</span>
                    <label class="switch">
                        <input type="checkbox" id="theme-toggle" checked>
                        <span class="slider round"></span>
                    </label>
                </div>
                <a href="#/categories" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--border); text-decoration: none; color: var(--text-main);">
                    <span>Administrar Categorías</span>
                    <span>›</span>
                </a>
                <div style="padding: 12px 0;">
                     <button id="export-btn" class="btn" style="width: 100%;">Exportar Datos (JSON)</button>
                </div>
            </div>
        </div>
    `;

    const init = async () => {
        // ... (Theme, Export, Logout code same as before, see below for new Avatar logic)

        // --- Avatar Logic ---
        const modal = document.getElementById('avatar-modal');
        const imgPreview = document.getElementById('profile-avatar');
        let selectedNewAvatar = null; // Can be string (URL) or File (Upload)

        document.getElementById('edit-avatar-btn').addEventListener('click', () => {
            modal.classList.remove('hidden');
        });

        document.getElementById('cancel-avatar').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Tabs
        const tabs = document.querySelectorAll('.tab-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
            });
        });

        // Presets
        document.querySelectorAll('.preset-avatar').forEach(img => {
            img.addEventListener('click', () => {
                document.querySelectorAll('.preset-avatar').forEach(i => i.style.borderColor = 'transparent');
                img.style.borderColor = 'var(--primary)';
                selectedNewAvatar = img.src; // URL relative
            });
        });

        // Upload
        const fileInput = document.getElementById('file-upload');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // Preview
                    // We store the Base64 for preview, but logic should handle File upload
                    selectedNewAvatar = file;
                };
                reader.readAsDataURL(file);
            }
        });

        // AI Generator
        const aiSeedInput = document.getElementById('ai-seed');
        const aiBtn = document.getElementById('btn-generate-ai');
        const aiPreview = document.getElementById('ai-preview');

        aiBtn.addEventListener('click', () => {
            const seed = aiSeedInput.value || 'random';
            // Using DiceBear API (completely free, no key)
            const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
            aiPreview.innerHTML = `<img src="${url}" style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--primary);">`;
            selectedNewAvatar = url;
            // Note: SVG URL is fine to store as string
        });

        // Save Avatar Logic
        document.getElementById('save-avatar').addEventListener('click', async () => {
            if (!selectedNewAvatar) {
                modal.classList.add('hidden');
                return;
            }

            // If it's a File, we need to upload it (or handle offline)
            // If it's a URL (Preset or DiceBear), we just save the string.

            // For this version: Update local profile object and refresh image src immediate
            if (selectedNewAvatar instanceof File) {
                // Read to dataURL for immediate UI update
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imgPreview.src = ev.target.result;
                    // TODO: The actual upload logic requires converting this File -> Storage -> URL
                    // We will piggyback on the Profile Save form or triggers here.
                    // For simplicity: We will trigger a hidden save or just set internal state
                    profile.avatar_blob = selectedNewAvatar;
                };
                reader.readAsDataURL(selectedNewAvatar);
            } else {
                imgPreview.src = selectedNewAvatar;
                profile.avatar_url = selectedNewAvatar;
            }

            modal.classList.add('hidden');
        });

        // Form Submit (Update Profile)
        const profileForm = document.getElementById('profile-form');
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!sessionUser) return;

            const updates = {
                id: sessionUser.id,
                username: profileForm.username.value,
                currency: profileForm.currency.value,
                avatar_url: profile.avatar_url, // URL string
                updated_at: new Date()
            };

            // Handle Blob if File was uploaded
            if (profile.avatar_blob) {
                // We need to upload this file.
                // If online, upload to Supabase Storage
                // If offline, store blob in IndexedDB pending_sync? Not easy for complex logic in view.
                // Simplified: User must be online to upload new avatar files.
                if (navigator.onLine) {
                    const fileName = `${sessionUser.id}/${Date.now()}.png`;
                    const { data, error } = await supabase.storage.from('receipts').upload(fileName, profile.avatar_blob);
                    // reusing receipts bucket for simplicity or create 'avatars' bucket
                    if (!error) {
                        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
                        updates.avatar_url = publicUrl;
                    }
                } else {
                    alert('Necesitas conexión para subir imágenes propias.');
                    return;
                }
            }

            try {
                if (navigator.onLine) {
                    const { error } = await supabase.from('profiles').upsert(updates);
                    if (error) throw error;
                    alert('Perfil actualizado');
                } else {
                    await dbActions.queueSyncAction({
                        table: 'profiles', type: 'UPDATE', payload: updates
                    });
                    alert('Guardado localmente. Se sincronizará cuando tengas conexión.');
                }
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('Error al actualizar: ' + err.message);
            }
        });

        // Manual Sync
        const syncBtn = document.getElementById('manual-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                if (!navigator.onLine) {
                    alert('No tienes conexión a internet.');
                    return;
                }

                const originalText = syncBtn.innerHTML;
                syncBtn.disabled = true;
                syncBtn.innerHTML = '🔄 Sincronizando...';

                try {
                    let missingFunctions = false;

                    // 1. Sync Pending (Queue)
                    if (typeof syncManager.syncPending === 'function') {
                        await syncManager.syncPending();
                    } else { missingFunctions = true; console.error('Missing syncPending'); }

                    // 2. Force Reconciliation (Local -> Cloud) as requested
                    // "Si hay más datos en local... si son distintos... sobreescribe"
                    if (typeof syncManager.reconcileLocalToCloud === 'function') {
                        await syncManager.reconcileLocalToCloud();
                    } else {
                        missingFunctions = true;
                        console.error('Missing reconcileLocalToCloud');
                        alert('Error: La función de reconciliación no se ha cargado correctamente (Cache antiguo). Recarga la página.');
                    }

                    // 3. Pull newest changes (Cloud -> Local) to ensure complete consistency
                    if (typeof syncManager.pullFromCloud === 'function') {
                        await syncManager.pullFromCloud();
                    } else { missingFunctions = true; console.error('Missing pullFromCloud'); }

                    if (missingFunctions) {
                        syncBtn.innerHTML = '⚠️ Error Versión';
                    } else {
                        syncBtn.innerHTML = '✅ ¡Sincronizado! Limpiando caché...';

                        // CLEAR CACHE & WORKERS (User Request)
                        if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (const registration of registrations) {
                                await registration.unregister();
                            }
                        }
                        if ('caches' in window) {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(key => caches.delete(key)));
                        }
                    }

                    setTimeout(() => {
                        syncBtn.disabled = false;
                        syncBtn.innerHTML = originalText;
                        window.location.reload();
                    }, 1000);

                } catch (err) {
                    console.error('Sync failed:', err);
                    alert('Error al sincronizar: ' + err.message);
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalText;
                }
            });
        }

        // Old Listeners (Logout, Theme, Export)
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                await dbActions.clearUserData();
                window.location.hash = '/login';
                window.location.reload();
            });
        }

        const toggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        toggle.checked = html.getAttribute('data-theme') === 'dark';
        toggle.addEventListener('change', (e) => {
            html.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
        });

        document.getElementById('export-btn').addEventListener('click', async () => {
            const txs = await dbActions.getAll('transactions');
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(txs, null, 2));
            const a = document.createElement('a');
            a.href = dataStr; a.download = "fint_backup.json";
            document.body.appendChild(a); a.click(); a.remove();
        });
    };

    return { template, init };
}
