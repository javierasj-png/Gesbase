-- Cambiar el tipo de certificacion_id de UUID a TEXT para compatibilidad con base_certificaciones
ALTER TABLE public.maquinista_certificaciones 
  DROP CONSTRAINT IF EXISTS maquinista_certificaciones_certificacion_id_fkey;

ALTER TABLE public.maquinista_certificaciones 
  ALTER COLUMN certificacion_id TYPE text USING certificacion_id::text;