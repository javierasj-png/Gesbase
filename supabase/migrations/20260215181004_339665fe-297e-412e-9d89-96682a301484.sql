
ALTER TABLE public.maquinistas
ADD COLUMN fecha_licencia_conduccion date DEFAULT NULL;

COMMENT ON COLUMN public.maquinistas.fecha_licencia_conduccion IS 'Fecha de obtención/renovación de la licencia de conducción. Caduca a los 10 años.';
