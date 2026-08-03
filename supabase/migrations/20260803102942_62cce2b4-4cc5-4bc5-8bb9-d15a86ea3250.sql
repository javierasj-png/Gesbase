ALTER TABLE public.tipos_accion_vigilancia ADD COLUMN IF NOT EXISTS categoria_plan text NOT NULL DEFAULT 'ambos';

UPDATE public.tipos_accion_vigilancia SET categoria_plan = 'especifico'
WHERE id IN ('acompanamiento_cabina','registro','alcohol_drogas','acompanamiento_maniobras','presentacion_servicio');

UPDATE public.tipos_accion_vigilancia SET categoria_plan = 'campania'
WHERE id IN ('verificaciones_tabtren','sondeo_documentacion','otros');