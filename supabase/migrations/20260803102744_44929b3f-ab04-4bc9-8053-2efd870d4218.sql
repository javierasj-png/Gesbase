INSERT INTO public.tipos_accion_vigilancia (id, nombre, tipo_plan_anual, orden, activo)
VALUES ('verificaciones_tabtren','Verificaciones en TabTren',NULL,6,true)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, activo = true;

UPDATE public.tipos_accion_vigilancia SET nombre = 'Documentación reglamentaria', orden = 7 WHERE id = 'sondeo_documentacion';
UPDATE public.tipos_accion_vigilancia SET nombre = 'Otro', orden = 8 WHERE id = 'otros';
UPDATE public.tipos_accion_vigilancia SET orden = 5 WHERE id = 'presentacion_servicio';