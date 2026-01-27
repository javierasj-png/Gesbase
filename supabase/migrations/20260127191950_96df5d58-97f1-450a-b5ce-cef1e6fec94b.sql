-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create function to auto-close expired PE 16.03 expedientes
CREATE OR REPLACE FUNCTION public.cerrar_expedientes_1603_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.expedientes_1603
  SET 
    estado = 'Cerrado',
    observaciones = COALESCE(observaciones || E'\n', '') || 'Cerrado automáticamente al finalizar el período de vigilancia (' || to_char(now(), 'DD/MM/YYYY') || ')',
    updated_at = now()
  WHERE 
    estado = 'Activo'
    AND fecha_fin_prevista < CURRENT_DATE;
END;
$$;

-- Schedule the function to run daily at 00:05
SELECT cron.schedule(
  'cerrar-expedientes-1603-expirados',
  '5 0 * * *', -- Every day at 00:05
  $$SELECT public.cerrar_expedientes_1603_expirados()$$
);