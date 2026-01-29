-- Añadir nuevos campos para gestión de cierre manual/automático en expedientes_1603
ALTER TABLE public.expedientes_1603 
ADD COLUMN IF NOT EXISTS cierre_manual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_cierre timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cerrado_por uuid DEFAULT NULL;

-- Crear función para actualizar cierre automático con los nuevos campos
CREATE OR REPLACE FUNCTION public.cerrar_expedientes_1603_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.expedientes_1603
  SET 
    estado = 'Cerrado',
    cierre_manual = false,
    fecha_cierre = now(),
    observaciones = COALESCE(observaciones || E'\n', '') || 'Cerrado automáticamente al finalizar el período de vigilancia (' || to_char(now(), 'DD/MM/YYYY') || ')',
    updated_at = now()
  WHERE 
    estado = 'Activo'
    AND fecha_fin_prevista < CURRENT_DATE;
END;
$function$;