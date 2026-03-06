
-- 1. Update recalcular_plan_1603 to re-match actuaciones after recalculating windows
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

  SELECT m.base
  INTO v_base
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

  -- Clear all actuacion_id references before recalculating
  UPDATE public.plan_1603 SET actuacion_id = NULL, estado = 'pendiente' WHERE expediente_id = _expediente_id AND justificado_traslado = false;

  -- ACOMPAÑAMIENTOS
  UPDATE public.plan_1603 SET etiqueta = 'Primera Quincena', orden = 1, mes = 1, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '15 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 1;
  UPDATE public.plan_1603 SET etiqueta = 'Primer Trimestre', orden = 2, mes = 3, inicio_ventana = v_fecha_origen + INTERVAL '16 days', fin_ventana = v_fecha_origen + INTERVAL '90 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 2;
  UPDATE public.plan_1603 SET etiqueta = 'Primer Semestre', orden = 3, mes = 6, inicio_ventana = v_fecha_origen + INTERVAL '91 days', fin_ventana = v_fecha_origen + INTERVAL '182 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 3;
  UPDATE public.plan_1603 SET etiqueta = 'Segundo Semestre', orden = 4, mes = 12, inicio_ventana = v_fecha_origen + INTERVAL '183 days', fin_ventana = v_fecha_origen + INTERVAL '365 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 4;
  UPDATE public.plan_1603 SET etiqueta = 'Tercer Semestre', orden = 5, mes = 18, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '547 days' WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 5;

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

  -- RE-MATCH: Re-assign actuaciones to correct plan blocks based on fecha_real within new windows
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

-- 2. Install triggers
DROP TRIGGER IF EXISTS trg_maquinista_fecha_primer_servicio_change ON public.maquinistas;
CREATE TRIGGER trg_maquinista_fecha_primer_servicio_change
  AFTER UPDATE OF fecha_primer_servicio ON public.maquinistas
  FOR EACH ROW
  WHEN (OLD.fecha_primer_servicio IS DISTINCT FROM NEW.fecha_primer_servicio)
  EXECUTE FUNCTION public.on_maquinista_fecha_primer_servicio_change();

DROP TRIGGER IF EXISTS trg_generar_plan_1603 ON public.maquinistas;
CREATE TRIGGER trg_generar_plan_1603
  AFTER INSERT OR UPDATE OF bajo_pe_1603, fecha_primer_servicio ON public.maquinistas
  FOR EACH ROW
  WHEN (NEW.bajo_pe_1603 = true AND NEW.fecha_primer_servicio IS NOT NULL)
  EXECUTE FUNCTION public.generar_plan_1603();
