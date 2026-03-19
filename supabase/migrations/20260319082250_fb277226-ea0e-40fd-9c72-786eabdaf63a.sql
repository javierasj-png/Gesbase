
-- Update generar_plan_1603 with new acompañamiento intervals
CREATE OR REPLACE FUNCTION public.generar_plan_1603()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expediente_id UUID;
  v_fecha_origen DATE;
  v_fecha_fin DATE;
BEGIN
  IF NEW.bajo_pe_1603 = true AND NEW.fecha_primer_servicio IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM expedientes_1603 WHERE maquinista_id = NEW.id AND estado = 'abierto') THEN
      v_fecha_origen := NEW.fecha_primer_servicio;
      v_fecha_fin := v_fecha_origen + INTERVAL '3 years';
      
      INSERT INTO expedientes_1603 (maquinista_id, fecha_primer_servicio, fecha_inicio, tipo, estado, fecha_fin_prevista)
      VALUES (NEW.id, v_fecha_origen, CURRENT_DATE, 'nuevo_acceso', 'abierto', v_fecha_fin)
      RETURNING id INTO v_expediente_id;
      
      -- ACOMPAÑAMIENTOS: Quincena + Trimestre acumulativos, luego 3 bloques semestrales (18 meses)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'acompanamiento', 'Primera Quincena', 1, 1, v_fecha_origen, v_fecha_origen + INTERVAL '15 days'),
        (v_expediente_id, 'acompanamiento', 'Primer Trimestre', 2, 3, v_fecha_origen, v_fecha_origen + INTERVAL '90 days'),
        (v_expediente_id, 'acompanamiento', 'Mes 4-9', 3, 9, v_fecha_origen + INTERVAL '91 days', v_fecha_origen + INTERVAL '273 days'),
        (v_expediente_id, 'acompanamiento', 'Mes 10-15', 4, 15, v_fecha_origen + INTERVAL '274 days', v_fecha_origen + INTERVAL '456 days'),
        (v_expediente_id, 'acompanamiento', 'Mes 16-21', 5, 21, v_fecha_origen + INTERVAL '457 days', v_fecha_origen + INTERVAL '639 days');
      
      -- REGISTROS - Primer Año
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'registro', 'Primer Trimestre', 1, 3, v_fecha_origen, v_fecha_origen + INTERVAL '90 days'),
        (v_expediente_id, 'registro', 'Segundo Trimestre', 2, 6, v_fecha_origen + INTERVAL '91 days', v_fecha_origen + INTERVAL '182 days'),
        (v_expediente_id, 'registro', 'Tercer Trimestre', 3, 9, v_fecha_origen + INTERVAL '183 days', v_fecha_origen + INTERVAL '273 days'),
        (v_expediente_id, 'registro', 'Cuarto Trimestre', 4, 12, v_fecha_origen + INTERVAL '274 days', v_fecha_origen + INTERVAL '365 days');
      
      -- REGISTROS - Segundo Año
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'registro', 'Primer Semestre (2º Año)', 5, 18, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '547 days'),
        (v_expediente_id, 'registro', 'Segundo Semestre (2º Año)', 6, 24, v_fecha_origen + INTERVAL '548 days', v_fecha_origen + INTERVAL '730 days');
      
      -- REGISTROS - Tercer Año
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'registro', 'Primer Semestre (3er Año)', 7, 30, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '912 days'),
        (v_expediente_id, 'registro', 'Segundo Semestre (3er Año)', 8, 36, v_fecha_origen + INTERVAL '913 days', v_fecha_origen + INTERVAL '1095 days');
      
      -- ALCOHOL
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'alcohol', '1er Año', 1, 12, v_fecha_origen, v_fecha_origen + INTERVAL '365 days'),
        (v_expediente_id, 'alcohol', '2º Año', 2, 24, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '730 days'),
        (v_expediente_id, 'alcohol', '3er Año', 3, 36, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '1095 days');
      
      -- DROGAS
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'drogas', '1er Año', 1, 12, v_fecha_origen, v_fecha_origen + INTERVAL '365 days'),
        (v_expediente_id, 'drogas', '2º Año', 2, 24, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '730 days'),
        (v_expediente_id, 'drogas', '3er Año', 3, 36, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '1095 days');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update recalcular_plan_1603 with new acompañamiento intervals
CREATE OR REPLACE FUNCTION public.recalcular_plan_1603(_expediente_id uuid, _fecha_origen date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_origen date := _fecha_origen;
  v_caller_id uuid := auth.uid();
  v_base text;
  v_act RECORD;
  v_plan_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT m.base INTO v_base
  FROM public.expedientes_1603 e
  JOIN public.maquinistas m ON m.id = e.maquinista_id
  WHERE e.id = _expediente_id;

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Expediente not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_base(v_caller_id, v_base) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  UPDATE public.expedientes_1603
  SET fecha_primer_servicio = v_fecha_origen, fecha_fin_prevista = v_fecha_origen + INTERVAL '3 years', updated_at = now(), updated_by = v_caller_id
  WHERE id = _expediente_id;

  -- Clear actuacion_id references (only non-justified blocks)
  UPDATE public.plan_1603 SET actuacion_id = NULL, estado = 'pendiente' WHERE expediente_id = _expediente_id AND justificado_traslado = false;

  -- ACOMPAÑAMIENTOS: Quincena + Trimestre acumulativos, luego 3 bloques semestrales (18 meses)
  UPDATE public.plan_1603 SET etiqueta = 'Primera Quincena', orden = 1, mes = 1, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '15 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 1;
  UPDATE public.plan_1603 SET etiqueta = 'Primer Trimestre', orden = 2, mes = 3, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '90 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 2;
  UPDATE public.plan_1603 SET etiqueta = 'Mes 4-9', orden = 3, mes = 9, inicio_ventana = v_fecha_origen + INTERVAL '91 days', fin_ventana = v_fecha_origen + INTERVAL '273 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 3;
  UPDATE public.plan_1603 SET etiqueta = 'Mes 10-15', orden = 4, mes = 15, inicio_ventana = v_fecha_origen + INTERVAL '274 days', fin_ventana = v_fecha_origen + INTERVAL '456 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 4;
  UPDATE public.plan_1603 SET etiqueta = 'Mes 16-21', orden = 5, mes = 21, inicio_ventana = v_fecha_origen + INTERVAL '457 days', fin_ventana = v_fecha_origen + INTERVAL '639 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 5;

  -- REGISTROS
  UPDATE public.plan_1603 SET etiqueta = 'Primer Trimestre', orden = 1, mes = 3, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '90 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 1;
  UPDATE public.plan_1603 SET etiqueta = 'Segundo Trimestre', orden = 2, mes = 6, inicio_ventana = v_fecha_origen + INTERVAL '91 days', fin_ventana = v_fecha_origen + INTERVAL '182 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 2;
  UPDATE public.plan_1603 SET etiqueta = 'Tercer Trimestre', orden = 3, mes = 9, inicio_ventana = v_fecha_origen + INTERVAL '183 days', fin_ventana = v_fecha_origen + INTERVAL '273 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 3;
  UPDATE public.plan_1603 SET etiqueta = 'Cuarto Trimestre', orden = 4, mes = 12, inicio_ventana = v_fecha_origen + INTERVAL '274 days', fin_ventana = v_fecha_origen + INTERVAL '365 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 4;
  UPDATE public.plan_1603 SET etiqueta = 'Primer Semestre (2º Año)', orden = 5, mes = 18, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '547 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 5;
  UPDATE public.plan_1603 SET etiqueta = 'Segundo Semestre (2º Año)', orden = 6, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '548 days', fin_ventana = v_fecha_origen + INTERVAL '730 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 6;
  UPDATE public.plan_1603 SET etiqueta = 'Primer Semestre (3er Año)', orden = 7, mes = 30, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '912 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 7;
  UPDATE public.plan_1603 SET etiqueta = 'Segundo Semestre (3er Año)', orden = 8, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '913 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days' WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 8;

  -- ALCOHOL
  UPDATE public.plan_1603 SET etiqueta = '1er Año', orden = 1, mes = 12, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '365 days' WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 1;
  UPDATE public.plan_1603 SET etiqueta = '2º Año', orden = 2, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '730 days' WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 2;
  UPDATE public.plan_1603 SET etiqueta = '3er Año', orden = 3, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days' WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 3;

  -- DROGAS
  UPDATE public.plan_1603 SET etiqueta = '1er Año', orden = 1, mes = 12, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '365 days' WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 1;
  UPDATE public.plan_1603 SET etiqueta = '2º Año', orden = 2, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '730 days' WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 2;
  UPDATE public.plan_1603 SET etiqueta = '3er Año', orden = 3, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days' WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 3;

  -- RE-MATCH actuaciones
  FOR v_act IN
    SELECT id, tipo, fecha_real
    FROM public.actuaciones_1603
    WHERE expediente_id = _expediente_id AND fecha_real IS NOT NULL
    ORDER BY fecha_real ASC
  LOOP
    SELECT p.id INTO v_plan_id
    FROM public.plan_1603 p
    WHERE p.expediente_id = _expediente_id
      AND p.tipo = v_act.tipo
      AND p.actuacion_id IS NULL
      AND (p.justificado_traslado = false OR p.justificado_traslado IS NULL)
      AND v_act.fecha_real >= p.inicio_ventana
      AND v_act.fecha_real <= p.fin_ventana
    ORDER BY p.orden ASC
    LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      UPDATE public.plan_1603 SET actuacion_id = v_act.id, estado = 'realizado' WHERE id = v_plan_id;
    END IF;
  END LOOP;
END;
$function$;
