-- Actualizar función generar_plan_1201 con las fechas correctas:
-- Día 1 = fecha_primer_servicio (no +1)
-- Días 2-7: bloque "Día 7" (fecha_objetivo = fecha_primer_servicio + 7 días)
-- Días 8-23: bloque "Día 23" (fecha_objetivo = fecha_primer_servicio + 23 días)
-- Días 24-30: bloque "Día 30" (fecha_objetivo = fecha_primer_servicio + 30 días)
-- Días 31-40: bloque "Día 40" (fecha_objetivo = fecha_primer_servicio + 40 días)

CREATE OR REPLACE FUNCTION public.generar_plan_1201()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calcular fecha fin prevista (40 días)
  NEW.fecha_fin_prevista := NEW.fecha_primer_servicio + INTERVAL '40 days';
  
  -- Insertar hitos ACOMPAÑAMIENTOS con fechas correctas:
  -- Día 1: fecha_objetivo = fecha_primer_servicio (día del primer servicio)
  -- Día 7: fecha_objetivo = fecha_primer_servicio + 7 días (para cubrir días 2-7)
  -- Día 23: fecha_objetivo = fecha_primer_servicio + 23 días (para cubrir días 8-23)
  -- Día 30: fecha_objetivo = fecha_primer_servicio + 30 días (para cubrir días 24-30)
  -- Día 40: fecha_objetivo = fecha_primer_servicio + 40 días (para cubrir días 31-40)
  INSERT INTO public.plan_1201 (expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, obligatorio) VALUES
    (NEW.id, 'acompanamiento', 'Día 1', 1, NEW.fecha_primer_servicio, true),
    (NEW.id, 'acompanamiento', 'Día 7', 7, NEW.fecha_primer_servicio + INTERVAL '7 days', true),
    (NEW.id, 'acompanamiento', 'Día 23', 23, NEW.fecha_primer_servicio + INTERVAL '23 days', true),
    (NEW.id, 'acompanamiento', 'Día 30', 30, NEW.fecha_primer_servicio + INTERVAL '30 days', true),
    (NEW.id, 'acompanamiento', 'Día 40', 40, NEW.fecha_primer_servicio + INTERVAL '40 days', true);
  
  -- Insertar hitos REGISTROS con las mismas fechas
  INSERT INTO public.plan_1201 (expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, obligatorio) VALUES
    (NEW.id, 'registro', 'Día 1', 1, NEW.fecha_primer_servicio, true),
    (NEW.id, 'registro', 'Día 7', 7, NEW.fecha_primer_servicio + INTERVAL '7 days', true),
    (NEW.id, 'registro', 'Día 23', 23, NEW.fecha_primer_servicio + INTERVAL '23 days', true),
    (NEW.id, 'registro', 'Día 30', 30, NEW.fecha_primer_servicio + INTERVAL '30 days', true),
    (NEW.id, 'registro', 'Día 40', 40, NEW.fecha_primer_servicio + INTERVAL '40 days', true);
  
  RETURN NEW;
END;
$$;

-- Actualizar función recalcular_plan_1201 para que use las fechas correctas
CREATE OR REPLACE FUNCTION public.recalcular_plan_1201(_expediente_id uuid, _fecha_origen date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar fecha_fin_prevista en el expediente
  UPDATE public.expedientes_1201
  SET fecha_fin_prevista = _fecha_origen + INTERVAL '40 days',
      updated_at = now()
  WHERE id = _expediente_id;
  
  -- Actualizar cada bloque del plan con las fechas correctas
  -- Día 1 = fecha_origen
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 1;
  
  -- Día 7 = fecha_origen + 7 días
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '7 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 7;
  
  -- Día 23 = fecha_origen + 23 días
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '23 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 23;
  
  -- Día 30 = fecha_origen + 30 días
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '30 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 30;
  
  -- Día 40 = fecha_origen + 40 días
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '40 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 40;
END;
$$;