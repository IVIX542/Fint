// ⚠️ IMPORTANTE: REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO DE SUPABASE
// Ver GUIA_NUBE.md para instrucciones de cómo obtenerlos.

const SUPABASE_URL = 'https://wcpbigmkoyzrtvrpigul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcGJpZ21rb3l6cnR2cnBpZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzA2MTAsImV4cCI6MjA4NDUwNjYxMH0.PVz_h81nVBOXz1xkLzk8vicD_kfQFc1osAPRHOAnR04';

// Check if window.supabase is available (loaded via CDN in index.html)
let client = null;

if (window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error('Supabase library not loaded. Check index.html');
}

export const supabase = client;
