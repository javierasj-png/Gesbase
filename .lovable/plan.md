
# Plan: Añadir selector de "Obligatoria" para certificaciones

## Resumen

Se añadirá la posibilidad de que el administrador pueda marcar/desmarcar una certificación como obligatoria directamente en la tabla de certificaciones del maquinista. Esta funcionalidad estará disponible solo para usuarios con rol de administrador.

## Cambios a implementar

### 1. Actualizar el componente MaquinistaCertificacionesTab

**Archivo:** `src/components/maquinista/MaquinistaCertificacionesTab.tsx`

- Importar el hook `useAuth` para verificar si el usuario actual es administrador
- Añadir una nueva columna "Obligatoria" en la tabla con un `Checkbox`
- El checkbox solo será interactivo si:
  - El usuario es administrador
  - La certificación está marcada como "obtenida" por el maquinista
- Para usuarios no administradores, se mostrará solo un indicador visual (badge o texto)

### 2. Actualizar el hook useMaquinistaCertificaciones

**Archivo:** `src/hooks/useMaquinistaCertificaciones.ts`

- Añadir nueva función `toggleObligatoria(certificacionId: string, obligatoria: boolean)`
- Esta función actualizará el campo `obligatoria` en la tabla `maquinista_certificaciones`
- Si la certificación aún no está asignada al maquinista (no obtenida), no se permitirá el cambio

## Diseño de la interfaz

```text
+----------+--------+---------------+--------------+--------+----------------+----------+------+--------+
| Obtenida |  Tipo  | Certificación | Obligatoria  | Vigilar| Último Servicio| Venc.Est.| Días | Estado |
+----------+--------+---------------+--------------+--------+----------------+----------+------+--------+
|   [x]    | línea  | AVE Madrid    |    [x]       |  ...   |   01/05/2025   | 01/05/26 |  95  | Vigente|
|   [ ]    | vehíc. | Serie 103     |    [ ]  *    |  ...   |       -        |    -     |  -   | Pend.  |
+----------+--------+---------------+--------------+--------+----------------+----------+------+--------+

* El checkbox de "Obligatoria" estará deshabilitado si la certificación no está obtenida
  o si el usuario no es administrador
```

## Detalles técnicos

### Cambios en MaquinistaCertificacionesTab.tsx

1. Nueva columna en el header de la tabla:
   - Posición: Entre "Certificación" y "Vigilar"
   - Título: "Obligatoria"
   - Alineación: Centro

2. Nueva celda en cada fila:
   - Checkbox controlado por `item.obligatoria`
   - `disabled` si `!isAdmin` o `!item.obtenida`
   - Al cambiar: llamar a `toggleObligatoria(item.certificacion_id, !item.obligatoria)`

### Nueva función en useMaquinistaCertificaciones.ts

```typescript
const toggleObligatoria = async (
  certificacionId: string, 
  obligatoria: boolean
): Promise<boolean> => {
  // 1. Verificar que la certificación esté asignada (obtenida)
  // 2. Actualizar en maquinista_certificaciones
  // 3. Refrescar datos
  // 4. Mostrar toast de confirmación
}
```

## Flujo de usuario

1. El administrador entra a la ficha de un maquinista
2. Navega a la pestaña "Certificaciones"
3. En la tabla, ve la nueva columna "Obligatoria"
4. Para certificaciones ya obtenidas, puede hacer clic en el checkbox para cambiar si es obligatoria
5. El sistema actualiza la base de datos y muestra un mensaje de confirmación
6. Los KPIs de "Obligatorias sin obtener" se recalculan automáticamente

## Seguridad

- Solo usuarios con rol `admin` podrán modificar el campo
- Las políticas RLS existentes en `maquinista_certificaciones` ya permiten que los mandos actualicen certificaciones de maquinistas de sus bases, pero la UI solo habilitará el control para administradores
