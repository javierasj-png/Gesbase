-- Actualizar el trigger generar_plan_1201 para crear bloques de Acompañamientos Y Registros
-- con días 1, 7, 23, 30, 40 para cada tipo
CREATE OR REPLACE FUNCTION public.generar_plan_1201()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calcular fecha fin prevista (40 días)
  NEW.fecha_fin_prevista := NEW.fecha_primer_servicio + INTERVAL '40 days';
  
  -- Insertar hitos ACOMPAÑAMIENTOS (días 1, 7, 23, 30, 40)
  INSERT INTO public.plan_1201 (expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, obligatorio) VALUES
    (NEW.id, 'acompanamiento', 'Día 1', 1, NEW.fecha_primer_servicio + INTERVAL '1 day', true),
    (NEW.id, 'acompanamiento', 'Día 7', 7, NEW.fecha_primer_servicio + INTERVAL '7 days', true),
    (NEW.id, 'acompanamiento', 'Día 23', 23, NEW.fecha_primer_servicio + INTERVAL '23 days', true),
    (NEW.id, 'acompanamiento', 'Día 30', 30, NEW.fecha_primer_servicio + INTERVAL '30 days', true),
    (NEW.id, 'acompanamiento', 'Día 40', 40, NEW.fecha_primer_servicio + INTERVAL '40 days', true);
  
  -- Insertar hitos REGISTROS (días 1, 7, 23, 30, 40)
  INSERT INTO public.plan_1201 (expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, obligatorio) VALUES
    (NEW.id, 'registro', 'Día 1', 1, NEW.fecha_primer_servicio + INTERVAL '1 day', true),
    (NEW.id, 'registro', 'Día 7', 7, NEW.fecha_primer_servicio + INTERVAL '7 days', true),
    (NEW.id, 'registro', 'Día 23', 23, NEW.fecha_primer_servicio + INTERVAL '23 days', true),
    (NEW.id, 'registro', 'Día 30', 30, NEW.fecha_primer_servicio + INTERVAL '30 days', true),
    (NEW.id, 'registro', 'Día 40', 40, NEW.fecha_primer_servicio + INTERVAL '40 days', true);
  
  RETURN NEW;
END;
$$;