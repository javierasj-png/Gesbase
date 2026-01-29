
# Plan: Resolver Error de Acceso al Sistema

## Diagnóstico

El sistema no permite iniciar sesión porque **las tablas de la base de datos no existen**. Las migraciones están definidas en el código pero no se han aplicado correctamente.

### Causa raíz
La última migración intenta modificar la tabla `expedientes_1603` añadiendo columnas (`cierre_manual`, `fecha_cierre`, `cerrado_por`), pero esta tabla no existe porque las migraciones anteriores nunca se ejecutaron.

### Error visible
- "Invalid login credentials" (400) al intentar acceder
- Los errores de TypeScript (`never` type) ocurren porque el archivo de tipos no tiene definiciones de tablas

---

## Solución

Crear una **migración consolidada** que:
1. Cree todas las tablas necesarias en el orden correcto
2. Sea idempotente (use `IF NOT EXISTS` para evitar errores)
3. Incluya los campos nuevos de cierre manual/automático

### Estructura de tablas a crear

```text
+-------------------+     +-------------------+     +-------------------+
|   auth.users      |<----|    profiles       |     |   user_roles      |
| (Supabase nativo) |     | id, email, nombre |     | user_id, role     |
+-------------------+     +-------------------+     +-------------------+
                                    |
                                    v
+-------------------+     +-------------------+     +-------------------+
| base_assignments  |     | bases_conduccion  |<----| base_certificac.  |
| user_id, base     |     | nombre, codigo    |     | base_id, config   |
+-------------------+     +-------------------+     +-------------------+
                                    |
                                    v
+-------------------+     +-------------------+     +-------------------+
|   maquinistas     |<----|  expedientes_1603 |<----|    plan_1603      |
| matricula, base   |     | maquinista_id     |     | expediente_id     |
+-------------------+     +-------------------+     +-------------------+
                                    |
                                    v
                          +-------------------+
                          | actuaciones_1603  |
                          | expediente_id     |
                          +-------------------+
```

---

## Pasos de implementación

### 1. Reemplazar la migración problemática

Sustituir el archivo `20260129094241_63ffd8ca-a120-431f-9866-a0dd5f83b8ca.sql` con una versión que:
- Use `IF NOT EXISTS` para todas las operaciones
- Solo añada columnas si la tabla ya existe
- Sea compatible tanto si es la primera ejecución como si es una re-ejecución

### 2. Verificar configuración de autenticación

Asegurar que la confirmación automática de email esté habilitada para que los nuevos usuarios puedan acceder inmediatamente.

### 3. Crear usuario administrador inicial

Una vez las tablas existan, se necesitará:
- Registrar un usuario desde la interfaz
- Asignarle el rol `admin` en la tabla `user_roles`

---

## Detalles técnicos

### Archivo a modificar
`supabase/migrations/20260129094241_63ffd8ca-a120-431f-9866-a0dd5f83b8ca.sql`

### SQL corregido
La migración usará:
- `CREATE TABLE IF NOT EXISTS` para evitar errores si la tabla ya existe
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para añadir columnas de forma segura
- `CREATE OR REPLACE FUNCTION` para funciones

### Flujo post-implementación

1. El sistema aplicará la migración consolidada
2. Se crearán todas las tablas con RLS habilitado
3. El trigger `on_auth_user_created` creará perfiles automáticamente
4. Los usuarios podrán registrarse y acceder
5. Un administrador deberá asignar roles manualmente

### Configuración requerida
- Habilitar auto-confirmación de email en la configuración de autenticación

---

## Resultado esperado

- Los usuarios podrán registrarse creando su cuenta
- El sistema creará automáticamente su perfil
- Un administrador asignará roles desde el panel de administración
- Los errores de TypeScript se resolverán automáticamente cuando se regeneren los tipos tras la migración
