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
        <div class="profile-view fade-in view-profile">
            <h2>Mi Perfil (v9)</h2>
            
            <div class="card" style="text-align: center; padding: 30px;">
                <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 16px;">
                    <img id="profile-avatar" src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: var(--border); border: 2px solid var(--primary);">
                    <button id="edit-avatar-btn" style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">✎</button>
                </div>
                <h3>${profile.username || userEmail}</h3>
                <p style="color: var(--text-muted); margin-bottom: 12px;">${sessionUser ? 'Sincronización Activa' : 'Sincronización Apagada'}</p>
                ${sessionUser ?
            `<button id="manual-sync-btn" class="btn btn-primary" style="margin-bottom: 12px; width: 100%;">⚡ Sincronizar Ahora</button>`
            : ''
        }
                <button id="logout-btn" class="btn" style="margin-top: 8px; background: var(--bg-body); color: ${sessionUser ? 'var(--danger)' : 'var(--primary)'}; border: 1px solid ${sessionUser ? 'var(--danger)' : 'var(--primary)'}; width: 100%;">
                    ${sessionUser ? 'Cerrar Sesión' : 'Iniciar Sesión'}
                </button>
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
                <div style="padding: 16px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin-bottom: 4px; font-weight: 500;">Apariencia</h4>
                        <span id="theme-status-text" style="font-size: 0.85rem; color: var(--text-muted);">Claro</span>
                    </div>
                    
                    <label class="custom-theme-switch">
                        <input type="checkbox" id="theme-toggle">
                        <div class="switch-track">
                            <div class="switch-thumb">
                                <!-- Sun Icon (limit size via CSS) -->
                                <svg class="icon-sun" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                                </svg>
                                <!-- Moon Icon -->
                                <svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
                                </svg>
                            </div>
                        </div>
                    </label>
                </div>
                ${sessionUser ? `
                <div style="padding: 16px 0; border-bottom: 1px solid var(--border);">
                    <h4 style="margin-bottom: 12px; font-weight: 500;">Personalización Avanzada</h4>
                    
                    <!-- Global Settings -->
                    <details class="theme-accordion" open style="margin-bottom: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 8px;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 4px;">🎨 Estilo Global</summary>
                        <div style="padding-top: 12px;">
                            <label style="display:block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">Color Principal</label>
                            <div class="color-picker-global" style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <!-- Generated by JS -->
                            </div>
                            
                            <label style="display:block; font-size: 0.8rem; color: var(--text-muted); margin: 12px 0 8px;">Tamaño de Fuente (x<span id="font-val-global">1</span>)</label>
                            <input type="range" class="font-slider-global" min="0.8" max="1.2" step="0.05" value="1" style="width: 100%;">
                        
                            <!-- Per Section Sub-Accordion -->
                            <details class="theme-accordion" style="margin-top: 16px; border: 1px solid var(--border); border-radius: 8px; padding: 8px; background: var(--bg-surface);">
                                <summary style="cursor: pointer; font-weight: 600; padding: 4px;">🔧 Por Sección</summary>
                                <div style="padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                                    
                                    <!-- Dashboard -->
                                    <details style="background: var(--bg-body); padding: 8px; border-radius: 6px;">
                                        <summary style="cursor: pointer; font-size: 0.9rem;">🏠 Inicio (Dashboard)</summary>
                                        <div class="section-config" data-section="dashboard" style="padding-top: 10px;">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <small class="reset-link" style="color: var(--primary); cursor: pointer;">Restaurar Predeterminado</small>
                                            </div>
                                            <div class="color-picker-section" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
                                        </div>
                                    </details>

                                    <!-- Transactions -->
                                    <details style="background: var(--bg-body); padding: 8px; border-radius: 6px;">
                                        <summary style="cursor: pointer; font-size: 0.9rem;">💳 Movimientos</summary>
                                        <div class="section-config" data-section="transactions" style="padding-top: 10px;">
                                             <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <small class="reset-link" style="color: var(--primary); cursor: pointer;">Restaurar Predeterminado</small>
                                            </div>
                                            <div class="color-picker-section" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
                                        </div>
                                    </details>

                                     <!-- Stats -->
                                    <details style="background: var(--bg-body); padding: 8px; border-radius: 6px;">
                                        <summary style="cursor: pointer; font-size: 0.9rem;">📊 Reportes</summary>
                                        <div class="section-config" data-section="stats" style="padding-top: 10px;">
                                             <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <small class="reset-link" style="color: var(--primary); cursor: pointer;">Restaurar Predeterminado</small>
                                            </div>
                                            <div class="color-picker-section" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
                                        </div>
                                    </details>

                                     <!-- Profile -->
                                    <details style="background: var(--bg-body); padding: 8px; border-radius: 6px;">
                                        <summary style="cursor: pointer; font-size: 0.9rem;">👤 Perfil</summary>
                                        <div class="section-config" data-section="profile" style="padding-top: 10px;">
                                             <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                <small class="reset-link" style="color: var(--primary); cursor: pointer;">Restaurar Predeterminado</small>
                                            </div>
                                            <div class="color-picker-section" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
                                        </div>
                                    </details>
                                </div>
                            </details>
                        </div>
                    </details>
                </div>
                ` : ''}
                <a href="#/categories" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--border); text-decoration: none; color: var(--text-main);">
                    <span>Administrar Categorías</span>
                    <span>›</span>
                </a>
                <div style="padding: 12px 0; ${!sessionUser ? 'display: flex; gap: 10px;' : ''}">
                     <button id="export-btn" class="btn" style="${!sessionUser ? 'flex: 1;' : 'width: 100%;'}">Exportar Datos</button>
                     ${!sessionUser ? `
                     <button id="import-btn" class="btn btn-primary" style="flex: 1;">Importar</button>
                     <input type="file" id="import-input" accept=".json" style="display: none;">
                     ` : ''}
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
                avatar_url: profile.avatar_url,
                avatar_url: profile.avatar_url,
                // Ensure mode is set correctly before saving, falling back to local or DOM if profile is stale
                theme_settings: {
                    ...profile.theme_settings,
                    mode: profile.theme_settings?.mode || localStorage.getItem('fint_theme_mode') || document.documentElement.getAttribute('data-theme') || 'dark'
                },
                updated_at: new Date()
            };

            // Handle Blob if File was uploaded
            if (profile.avatar_blob) {
                // We need to upload this file.
                // If online, upload to Supabase Storage
                // If offline, store blob in IndexedDB pending_sync? Not easy for complex logic in view.
                // Simplified: User must be online to upload new avatar files.
                if (navigator.onLine) {
                    // Use 'avatars' bucket with RLS policies
                    const fileName = `${sessionUser.id}/${Date.now()}.png`; // Path: userId/timestamp.png

                    // 1. Upload
                    const { data, error } = await supabase.storage.from('avatars').upload(fileName, profile.avatar_blob, {
                        cacheControl: '3600',
                        upsert: false
                    });

                    if (error) {
                        console.error('Upload Error:', error);
                        throw new Error('No se pudo subir la imagen. Verifica los permisos del bucket "avatars".');
                    }

                    // 2. Get Public URL
                    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                    updates.avatar_url = publicUrl;
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

                    // Color Picker Logic
                    if (sessionUser) {
                        const colorOptions = document.querySelectorAll('.color-option');

                        // Set initial active
                        const currentHue = getComputedStyle(document.documentElement).getPropertyValue('--primary-hue').trim() || '250';
                        colorOptions.forEach(opt => {
                            if (opt.dataset.hue === currentHue) opt.style.borderColor = 'var(--text-main)';

                            opt.addEventListener('click', () => {
                                const hue = opt.dataset.hue;
                                // 1. Live Preview
                                document.documentElement.style.setProperty('--primary-hue', hue);

                                // Update active state
                                colorOptions.forEach(o => o.style.borderColor = 'transparent');
                                opt.style.borderColor = 'var(--text-main)';

                                // 2. Set internal state for save
                                profile.theme_hue = parseInt(hue);
                            });
                        });

                        // Apply saved preference if exists on load
                        if (profile.theme_hue) {
                            document.documentElement.style.setProperty('--primary-hue', profile.theme_hue);
                            // Reset active border
                            colorOptions.forEach(opt => {
                                opt.style.borderColor = opt.dataset.hue == profile.theme_hue ? 'var(--text-main)' : 'transparent';
                            });
                        }
                    }
                    alert('Guardado localmente. Se sincronizará cuando tengas conexión.');
                }
                window.location.reload();
            } catch (err) {
                console.error(err);
                if (err.message && err.message.includes('Could not find the') && err.message.includes('column')) {
                    alert('Error de Schema: Falta una columna en Supabase. \n\nEjecuta esto en SQL Editor:\nALTER TABLE profiles ADD COLUMN avatar_url text;');
                } else {
                    alert('Error al actualizar: ' + err.message);
                }
            }
        });

        // --- ADVANCED THEME LOGIC ---
        if (sessionUser) {
            const { themeManager } = await import('../theme.js');

            // 1. Initialize State (Load from Profile or Default)
            // Ensure we have a structure. Profile might need migration from old 'theme_hue'.
            if (!profile.theme_settings) {
                profile.theme_settings = JSON.parse(JSON.stringify(themeManager.defaults));
                if (profile.theme_hue) profile.theme_settings.global.hue = profile.theme_hue; // Migrate legacy
            }

            const currentSettings = profile.theme_settings;

            // Helper: Render Color Options
            const renderColors = (container, activeHue, onSelect) => {
                const hues = [250, 210, 160, 25, 330, 0, 50]; // Purple, Blue, Green, Orange, Pink, Red, Gold
                container.innerHTML = '';
                hues.forEach(hue => {
                    const dot = document.createElement('div');
                    dot.style.cssText = `
                        width: 24px; height: 24px; border-radius: 50%; cursor: pointer; 
                        background: hsl(${hue}, 70%, 60%); border: 2px solid transparent;
                        transition: transform 0.2s;
                    `;
                    dot.title = `Hue: ${hue}`; // Tooltip

                    if (String(activeHue) === String(hue)) {
                        dot.style.borderColor = 'var(--text-main)';
                        dot.style.transform = 'scale(1.1)';
                    }

                    dot.addEventListener('click', () => {
                        // UI Update
                        Array.from(container.children).forEach(c => {
                            c.style.borderColor = 'transparent';
                            c.style.transform = 'scale(1)';
                        });
                        dot.style.borderColor = 'var(--text-main)';
                        dot.style.transform = 'scale(1.1)';
                        onSelect(hue);
                    });
                    container.appendChild(dot);
                });
            };

            // Global Controls
            const globalContainer = document.querySelector('.color-picker-global');
            const fontSlider = document.querySelector('.font-slider-global');
            const fontVal = document.getElementById('font-val-global');

            // Init Global UI
            renderColors(globalContainer, currentSettings.global.hue || 250, (hue) => {
                currentSettings.global.hue = hue;
                themeManager.apply(currentSettings); // Live Preview
            });

            if (currentSettings.global.fontSize) fontSlider.value = currentSettings.global.fontSize;
            fontVal.textContent = fontSlider.value;

            fontSlider.addEventListener('input', (e) => {
                fontVal.textContent = e.target.value;
                currentSettings.global.fontSize = e.target.value;
                themeManager.apply(currentSettings);
            });

            // Per-Section Controls
            document.querySelectorAll('.section-config').forEach(el => {
                const section = el.dataset.section;
                const container = el.querySelector('.color-picker-section');
                const resetBtn = el.querySelector('.reset-link');

                // Init Section UI
                renderColors(container, currentSettings[section]?.hue, (hue) => {
                    if (!currentSettings[section]) currentSettings[section] = {};
                    currentSettings[section].hue = hue;
                    themeManager.apply(currentSettings);
                });

                resetBtn.addEventListener('click', () => {
                    if (currentSettings[section]) currentSettings[section].hue = null;
                    themeManager.apply(currentSettings);
                    // Re-render UI (Clear selection)
                    renderColors(container, null, (hue) => {
                        if (!currentSettings[section]) currentSettings[section] = {};
                        currentSettings[section].hue = hue;
                        themeManager.apply(currentSettings);
                    });
                });
            });

            // Apply initially just in case
            themeManager.apply(currentSettings);
        }


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
                if (sessionUser) {
                    // Actual Logout
                    await supabase.auth.signOut();
                    await dbActions.clearUserData();
                    localStorage.removeItem('fint_guest_mode');
                    window.location.hash = '/login';
                } else {
                    // Guest -> Login mode
                    localStorage.removeItem('fint_guest_mode');
                    window.location.hash = '/login';
                }
                window.location.reload();
            });
        }

        // Segmented Theme Logic
        const toggle = document.getElementById('theme-toggle');
        const statusText = document.getElementById('theme-status-text');
        const html = document.documentElement;

        // Initialize from Settings(Cloud) -> LocalStorage -> HTML attribute -> Default
        const currentMode = profile.theme_settings?.mode || localStorage.getItem('fint_theme_mode') || html.getAttribute('data-theme') || 'dark';

        // Sync UI
        toggle.checked = currentMode === 'dark';
        if (statusText) statusText.textContent = currentMode === 'dark' ? 'Oscuro' : 'Claro';
        html.setAttribute('data-theme', currentMode); // Ensure DOM matches

        toggle.addEventListener('change', (e) => {
            const newVal = e.target.checked ? 'dark' : 'light';

            // 1. Live Preview
            html.setAttribute('data-theme', newVal);
            if (statusText) statusText.textContent = e.target.checked ? 'Oscuro' : 'Claro';

            // 2. Persist IMMEDIATELY (Local Storage wins for UI prefs)
            localStorage.setItem('fint_theme_mode', newVal);

            // 3. Update Internal State for Cloud Save (if logged in)
            if (!profile.theme_settings) profile.theme_settings = {};
            profile.theme_settings.mode = newVal;
        });

        document.getElementById('export-btn').addEventListener('click', async () => {
            const txs = await dbActions.getAll('transactions');
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(txs, null, 2));
            const a = document.createElement('a');
            a.href = dataStr; a.download = `fint_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); a.remove();
        });

        // Import Logic
        const importInput = document.getElementById('import-input');
        const importBtn = document.getElementById('import-btn');

        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => {
                if (confirm('IMPORTAR DATOS: Esto fusionará los movimientos del archivo con los actuales. Se recomienda hacer una copia de seguridad antes. ¿Continuar?')) {
                    importInput.click();
                }
            });

            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const importedData = JSON.parse(ev.target.result);
                        if (!Array.isArray(importedData)) throw new Error('Formato inválido: Se esperaba un array');

                        importBtn.disabled = true;
                        importBtn.textContent = 'Importando...';

                        let count = 0;
                        for (const tx of importedData) {
                            // Basic validation
                            if (!tx.id || !tx.amount || !tx.date) continue;

                            // Force sync flag to 0 to ensure it syncs to cloud (if we were online, but this is guest mode mostly)
                            // If Guest -> Local DB. If they login later, it will sync.
                            tx.is_synced = 0;

                            await dbActions.add('transactions', tx);
                            // We don't queue sync action if guest, but it doesn't hurt (it just won't process until login)
                            count++;
                        }

                        alert(`Importación completada: ${count} movimientos procesados.`);
                        window.location.reload();

                    } catch (err) {
                        console.error(err);
                        alert('Error al importar: ' + err.message);
                    } finally {
                        if (importBtn) { // Check again just in case
                            importBtn.disabled = false;
                            importBtn.textContent = 'Importar';
                            importInput.value = '';
                        }
                    }
                };
                reader.readAsText(file);
            });
        }
    };

    return { template, init };
}
