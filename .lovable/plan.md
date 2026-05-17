## Seguimiento Especial — Plan

Nueva funcionalidad por maquinista, ubicada en una pestaña entre **Plan Anual** y **PE 16.03**, dentro de la página de detalle del maquinista.

### 1. Concepto

Un **seguimiento especial** es un expediente abierto a un maquinista cuando se detecta una anomalía relevante (típicamente PREVER alto). Contiene:

- **Apertura**: datos de la anomalía detectada (origen, descripción, índice PREVER, fecha) + evidencia de comunicación por email al maquinista.
- **Plan opcional de acciones de refuerzo**: acompañamientos y/o registros con periodicidad configurable (semanal, quincenal, mensual, trimestral, semestral) durante un período definido.
- **Cierre**: manual, con fecha y observaciones.

Las acciones planificadas alimentan el cuadro de mando como alertas (pendientes / vencidas / próximas).

### 2. Modelo de datos (nuevas tablas)

**`seguimientos_especiales`** (cabecera del expediente)
- `maquinista_id`, `fecha_inicio`, `fecha_fin` (opcional)
- `motivo` (texto), `indice_prever` (numérico opcional), `fecha_anomalia`
- `email_destinatario`, `email_asunto`, `email_cuerpo`, `email_enviado_at`
- `estado` ('abierto' | 'cerrado'), `fecha_cierre`, `cerrado_por`
- `observaciones`, auditoría (created_by/at, updated_by/at)
- RLS por base (vía `can_access_base` sobre maquinista)

**`plan_seguimiento_especial`** (acciones planificadas)
- `seguimiento_id`, `tipo` ('acompanamiento' | 'registro')
- `fecha_objetivo`, `estado` ('pendiente' | 'cumplida' | 'vencida')
- `actuacion_id` (opcional, FK lógica a `actuaciones_plan_anual` o similar)
- `comentario_vencida`

La planificación se genera al crear el seguimiento con `tipo_acciones` ('acompanamiento' | 'registro' | 'ambos') y `periodicidad` (semanal/quincenal/mensual/trimestral/semestral) desde `fecha_inicio` hasta `fecha_fin`.

### 3. UI — Pestaña "Seguimiento Especial"

Nuevo tab en `MaquinistaDetailPage.tsx`, **entre Plan Anual y PE 16.03**.

Componente `MaquinistaSeguimientoEspecialTab.tsx`:
- **Botón "Nuevo seguimiento especial"** → modal en pasos:
  1. Anomalía: motivo, PREVER, fecha
  2. Comunicación email: destinatario (precargado del maquinista), asunto, cuerpo, botón **Enviar email** (registra `email_enviado_at`)
  3. Plan de acciones (opcional): tipo (Acompañamiento / Registro / Ambos), periodicidad, fecha inicio, fecha fin
- **Lista de seguimientos**: cards con resumen (estado, fechas, % cumplimiento)
- **Detalle expandido**: timeline de acciones planificadas con botón "Registrar actuación" y "Marcar vencida con comentario"
- **Cerrar seguimiento** (manual)

### 4. Envío de email

El email se envía mediante Lovable Emails (infraestructura ya existente o a configurar). Si todavía no está configurada, lo propondré antes. El template será "Comunicación anomalía PREVER" con datos dinámicos (nombre maquinista, motivo, PREVER, próximas acciones planificadas).

### 5. Dashboard

En `useDashboardAlertas` añadir nuevo grupo de alertas:
- "Seguimiento Especial — Acciones vencidas"
- "Seguimiento Especial — Acciones próximas (≤15 días)"

Se respetan los filtros de base ya existentes.

### 6. Archivos a tocar

- **Nuevo**: `src/components/maquinista/MaquinistaSeguimientoEspecialTab.tsx`
- **Nuevo**: `src/components/maquinista/SeguimientoEspecialModal.tsx`
- **Nuevo**: `src/hooks/useSeguimientosEspeciales.ts`
- **Modificar**: `src/pages/MaquinistaDetailPage.tsx` (orden de tabs)
- **Modificar**: `src/hooks/useDashboardAlertas.ts` (alertas nuevas)
- **Migración SQL**: 2 tablas + RLS + trigger updated_at
- **Email**: template + invocación a `send-transactional-email` (si confirmas usar Lovable Emails)

### Preguntas antes de codificar

1. **Email**: ¿usamos Lovable Emails (te lo configuro si no está)? ¿O por ahora dejamos solo el registro manual del envío (asunto, cuerpo, fecha) sin envío real?
2. **Periodicidades disponibles**: ¿confirmas semanal / quincenal / mensual / trimestral / semestral?
3. **Duración del seguimiento**: ¿fecha de fin obligatoria al crear, o se puede dejar abierto y cerrar manualmente cuando proceda?
4. **¿El plan opcional puede modificarse después de creado** (añadir/quitar fechas, cambiar periodicidad) o queda fijado?
