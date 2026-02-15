// ⚠️ IMPORTANTE: REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO DE SUPABASE
// Ver GUIA_NUBE.md para instrucciones de cómo obtenerlos.

const SUPABASE_URL = 'https://wcpbigmkoyzrtvrpigul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcGJpZ21rb3l6cnR2cnBpZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzA2MTAsImV4cCI6MjA4NDUwNjYxMH0.PVz_h81nVBOXz1xkLzk8vicD_kfQFc1osAPRHOAnR04';

// Check if window.supabase is available (loaded via CDN in index.html)
let client = null;

if (typeof window !== 'undefined' && window.supabase) {
    try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase client initialized');
    } catch (error) {
        console.error('❌ Error creating Supabase client:', error);
    }
} else {
    console.warn('⚠️ Supabase SDK not loaded from CDN');
    console.warn('📡 App will work offline-only. Check your internet connection or firewall settings.');
}

export const supabase = client;
