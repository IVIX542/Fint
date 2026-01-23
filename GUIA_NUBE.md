# Guía de Integración en la Nube (Supabase)

Esta guía te llevará paso a paso para conectar **Fint** con Supabase, habilitando la autenticación, base de datos en la nube y sincronización.

## Paso 1: Configuración en Supabase

1.  Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto ("New Project").
2.  Ponle nombre (ej: `fint-app`) y contraseña segura.
3.  Espera a que se aprovisione la base de datos.

### 1.1. Obtener Credenciales
Una vez creado, ve a **Settings (Engranaje) -> API**. Copia:
-   **URL** del proyecto.
-   **anon / public** Key.

Necesitarás estos datos para el código.

### 1.2. Crear Tablas (SQL)
Ve al **SQL Editor** en el menú lateral y ejecuta el siguiente script para crear la estructura idéntica a nuestra app local:

```sql
-- 1. Tabla de Perfiles (Usuarios)
-- Se vincula automáticamente con auth.users al registrarse
create table profiles (
  id uuid references auth.users not null primary key,
  username text,
  currency text default 'EUR',
  avatar_url text,
  updated_at timestamp with time zone
);

-- 2. Tabla de Transacciones
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  description text,
  category text,
  type text check (type in ('income', 'expense')),
  date timestamp with time zone default now(),
  file_path text, -- Ruta en Storage
  created_at timestamp with time zone default now()
);

-- 3. Habilitar Row Level Security (RLS)
-- Esto es CRUCIAL: hace que cada usuario solo vea SUS datos.
alter table profiles enable row level security;
alter table transactions enable row level security;

-- 4. Políticas de Seguridad (Policies)
-- Profiles: Ver y editar el propio perfil
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Transactions: CRUD completo solo para el dueño
create policy "Users can CRUD own transactions" on transactions
  for all using (auth.uid() = user_id);

-- 5. Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
  for each row execute procedure public.handle_new_user();

-- 6. Tabla de Categorías (NUEVO)
create table categories (
  id text primary key, -- Usamos IDs como 'cat_food' o UUIDs generados
  user_id uuid references auth.users not null,
  name text not null,
  icon text not null,
  type text check (type in ('income', 'expense')),
  created_at timestamp with time zone default now()
);

alter table categories enable row level security;

create policy "Users can CRUD own categories" on categories
  for all using (auth.uid() = user_id);
```

### 1.3. Configurar Storage (Archivos)
1.  Ve a **Storage** -> **New Bucket**.
2.  Nombre: `receipts` (comprobantes).
3.  Marca "Public bucket": **No** (queremos privacidad).
4.  Agrega una política RLS para que el usuario solo suba/vea sus archivos:
    -   SELECT: `auth.uid() = owner` (o similar, depende de cómo guardes la metadata, lo más fácil es usar carpetas con el UUID del usuario).

---

## Paso 2: Conectar el Frontend

### 2.1. Instalar SDK
Como no usamos NPM/Bundlers complejos, usaremos el CDN en `index.html`.

Añade esto en el `<head>` de `index.html` antes de tus scripts:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 2.2. Crear Cliente (`js/supabase.js`)
Crea un archivo nuevo `js/supabase.js`:

```javascript
// Reemplaza con tus claves REALES
const SNAP_URL = 'https://tu-proyecto.supabase.co';
const SNAP_KEY = 'tu-anon-key';

export const supabase = window.supabase.createClient(SNAP_URL, SNAP_KEY);
```

## Paso 3: Implementar Autenticación

En `js/views/login.js` (tendrás que crearlo), usa:

```javascript
import { supabase } from '../supabase.js';

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@email.com',
  password: 'password123',
});

// Registro
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@email.com',
  password: 'password123',
});
```

Al hacer login, guarda el `access_token` en `localStorage` o deja que el cliente de Supabase lo maneje (lo hace automáticamente).

## Paso 4: Sincronización (Sync Manager)

Este es el paso más avanzado. Necesitas modificar `js/db.js` o crear `js/sync.js`.

**Lógica sugerida:**

1.  **Al cargar la app (Online):**
    -   Pedir todas las transacciones de Supabase.
    -   `supabase.from('transactions').select('*')`
    -   Guardarlas en IndexedDB (sobrescribiendo o fusionando).

2.  **Al guardar una transacción (Offline/Online):**
    -   Ya lo estamos guardando en IndexedDB (`transactions`).
    -   También lo guardamos en la tabla `pending_sync` de IndexedDB con la acción `INSERT` y el payload.
    -   Si estamos **Online**, intentamos enviarlo a Supabase inmediatamente. Si tiene éxito, borramos de `pending_sync`.
    -   Si estamos **Offline**, se queda en `pending_sync`.

3.  **Recuperando conexión:**
    -   Escuchar evento: `window.addEventListener('online', syncPendingData);`
    -   La función `syncPendingData` lee todo `pending_sync` y lo envía a Supabase uno por uno (o en lote).

### Ejemplo de Sync Manager (`js/sync.js`)

```javascript
import { supabase } from './supabase.js';
import { dbActions } from './db.js';

export async function syncPendingData() {
    if (!navigator.onLine) return;

    const pending = await dbActions.getAll('pending_sync');
    
    for (const item of pending) {
        try {
            if (item.type === 'INSERT') {
                // Eliminar campos locales antes de enviar
                const { id, is_synced, ...payload } = item.payload;
                
                // User ID debe venir del auth session
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return; // No logueado

                await supabase.from('transactions').insert({
                    ...payload,
                    user_id: user.id
                });
            }
            // ... implementar UPDATE y DELETE similar

            // Si éxito, borrar de cola
            await dbActions.delete('pending_sync', item.id);
        
        } catch (err) {
            console.error('Error syncing item', item, err);
        }
    }
}
```

## Resumen
1. Clona el esquema de BBDD en Supabase (SQL).
2. Añade la librería JS en el HTML.
3. Crea la vista de Login.
4. Implementa el "Sync Manager" para subir los datos pendientes cuando haya internet.
