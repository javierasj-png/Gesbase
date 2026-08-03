ALTER TABLE public.planes_vigilancia DROP CONSTRAINT IF EXISTS planes_vigilancia_estado_check;
UPDATE public.planes_vigilancia SET estado = 'propuesta' WHERE estado = 'borrador';
ALTER TABLE public.planes_vigilancia ALTER COLUMN estado SET DEFAULT 'propuesta';
ALTER TABLE public.planes_vigilancia ADD CONSTRAINT planes_vigilancia_estado_check CHECK (estado IN ('propuesta','validado','completado','archivado'));