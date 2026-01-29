
# Plan: Corregir migración y eliminar botón "Nuevo Maquinista"

## Resumen

Este plan aborda dos cambios:
1. **Corregir el error de migración** causado por conflictos con políticas RLS
2. **Eliminar el botón "+ Nuevo Maquinista"** de la página de Maquinistas

---

## 1. Corregir la migración de base de datos

El error actual se produce porque el sistema de migraciones está intentando recrear la función `can_access_base` que tiene políticas RLS dependientes. 

### Solución

Reescribir la migración para que sea más simple y no interfiera con funciones existentes:

- Añadir solo las columnas nuevas a `expedientes_1603`:
  - `cierre_manual` (boolean)
  - `fecha_cierre` (timestamp)
  - `cerrado_por` (uuid)

- Usar `CREATE OR REPLACE FUNCTION` para actualizar la función de cierre automático sin afectar otras funciones

**Archivo a modificar:** `supabase/migrations/20260129094241_63ffd8ca-a120-431f-9866-a0dd5f83b8ca.sql`

La migración corregida incluirá:
```sql
-- Solo añade columnas nuevas
ALTER TABLE public.expedientes_1603 
ADD COLUMN IF NOT EXISTS cierre_manual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_cierre timestamp with time zone,
ADD COLUMN IF NOT EXISTS cerrado_por uuid;

-- Actualiza la función existente
CREATE OR REPLACE FUNCTION public.cerrar_expedientes_1603_expirados()
...
```

---

## 2. Eliminar botón "Nuevo Maquinista"

Según lo solicitado, se eliminará el botón de la página de Maquinistas ya que la creación de maquinistas se gestiona desde el panel de Administración.

**Archivo a modificar:** `src/pages/MaquinistasPage.tsx`

### Cambios:
- Eliminar el import de `Plus` de lucide-react
- Eliminar el `<Button>` que redirige a `/admin`
- El header quedará solo con el título y descripción

### Código actual (a eliminar):
```tsx
<Button onClick={() => navigate('/admin')}>
  <Plus className="w-4 h-4 mr-2" />
  Nuevo Maquinista
</Button>
```

### Resultado visual:
```
+--------------------------------------------------+
| Maquinistas                                      |
| Censo de maquinistas y acceso a fichas           |
+--------------------------------------------------+
```

---

## Detalles técnicos

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/...sql` | Simplificar migración, eliminar posibles conflictos |
| `src/pages/MaquinistasPage.tsx` | Eliminar botón y import no usado |

### Impacto

- **Sin impacto en funcionalidad existente**: Los usuarios pueden seguir creando maquinistas desde Administración
- **Mejor UX**: Se elimina confusión sobre dónde crear maquinistas
- **Base de datos**: Se añaden campos para gestión de cierre manual/automático de expedientes PE 16.03
