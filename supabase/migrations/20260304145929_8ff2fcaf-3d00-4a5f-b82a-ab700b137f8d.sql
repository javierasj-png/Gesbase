-- 1) Tighten duplicated read policies on certificaciones to a single authenticated-only policy
DROP POLICY IF EXISTS "Read certificaciones" ON public.certificaciones;
DROP POLICY IF EXISTS "Authenticated users can view certifications" ON public.certificaciones;

CREATE POLICY "Authenticated users can view certifications"
ON public.certificaciones
FOR SELECT
TO authenticated
USING (true);

-- 2) Harden SECURITY DEFINER RPC: recalcular_plan_1201 with explicit auth + base access checks
CREATE OR REPLACE FUNCTION public.recalcular_plan_1201(_expediente_id uuid, _fecha_origen date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_base text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT m.base
  INTO v_base
  FROM public.expedientes_1201 e
  JOIN public.maquinistas m ON m.id = e.maquinista_id
  WHERE e.id = _expediente_id;

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Expediente not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_base(v_caller_id, v_base) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Actualizar fecha_fin_prevista en el expediente
  UPDATE public.expedientes_1201
  SET fecha_fin_prevista = _fecha_origen + INTERVAL '40 days',
      updated_at = now(),
      updated_by = v_caller_id
  WHERE id = _expediente_id;

  -- Actualizar cada bloque del plan con las fechas correctas
  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 1;

  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '7 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 7;

  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '23 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 23;

  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '30 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 30;

  UPDATE public.plan_1201
  SET fecha_objetivo = _fecha_origen + INTERVAL '40 days'
  WHERE expediente_id = _expediente_id AND dia_desde_origen = 40;
END;
$function$;

-- 3) Harden SECURITY DEFINER RPC: recalcular_plan_1603 with explicit auth + base access checks
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

  -- Actualizar expediente
  UPDATE public.expedientes_1603
  SET
    fecha_primer_servicio = v_fecha_origen,
    fecha_fin_prevista = v_fecha_origen + INTERVAL '3 years',
    updated_at = now(),
    updated_by = v_caller_id
  WHERE id = _expediente_id;

  -- ACOMPAÑAMIENTOS
  UPDATE public.plan_1603
  SET etiqueta = 'Primera Quincena', orden = 1, mes = 1, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '15 days'
  WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 1;

  UPDATE public.plan_1603
  SET etiqueta = 'Primer Trimestre', orden = 2, mes = 3, inicio_ventana = v_fecha_origen + INTERVAL '16 days', fin_ventana = v_fecha_origen + INTERVAL '90 days'
  WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 2;

  UPDATE public.plan_1603
  SET etiqueta = 'Primer Semestre', orden = 3, mes = 6, inicio_ventana = v_fecha_origen + INTERVAL '91 days', fin_ventana = v_fecha_origen + INTERVAL '182 days'
  WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 3;

  UPDATE public.plan_1603
  SET etiqueta = 'Segundo Semestre', orden = 4, mes = 12, inicio_ventana = v_fecha_origen + INTERVAL '183 days', fin_ventana = v_fecha_origen + INTERVAL '365 days'
  WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 4;

  UPDATE public.plan_1603
  SET etiqueta = 'Tercer Semestre', orden = 5, mes = 18, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '547 days'
  WHERE expediente_id = _expediente_id AND tipo = 'acompanamiento' AND orden = 5;

  -- REGISTROS (1er año)
  UPDATE public.plan_1603
  SET etiqueta = 'Primer Trimestre', orden = 1, mes = 3, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '90 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 1;

  UPDATE public.plan_1603
  SET etiqueta = 'Segundo Trimestre', orden = 2, mes = 6, inicio_ventana = v_fecha_origen + INTERVAL '91 days', fin_ventana = v_fecha_origen + INTERVAL '182 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 2;

  UPDATE public.plan_1603
  SET etiqueta = 'Tercer Trimestre', orden = 3, mes = 9, inicio_ventana = v_fecha_origen + INTERVAL '183 days', fin_ventana = v_fecha_origen + INTERVAL '273 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 3;

  UPDATE public.plan_1603
  SET etiqueta = 'Cuarto Trimestre', orden = 4, mes = 12, inicio_ventana = v_fecha_origen + INTERVAL '274 days', fin_ventana = v_fecha_origen + INTERVAL '365 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 4;

  -- REGISTROS (2º año)
  UPDATE public.plan_1603
  SET etiqueta = 'Primer Semestre (2º Año)', orden = 5, mes = 18, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '547 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 5;

  UPDATE public.plan_1603
  SET etiqueta = 'Segundo Semestre (2º Año)', orden = 6, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '548 days', fin_ventana = v_fecha_origen + INTERVAL '730 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 6;

  -- REGISTROS (3er año)
  UPDATE public.plan_1603
  SET etiqueta = 'Primer Semestre (3er Año)', orden = 7, mes = 30, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '912 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 7;

  UPDATE public.plan_1603
  SET etiqueta = 'Segundo Semestre (3er Año)', orden = 8, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '913 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days'
  WHERE expediente_id = _expediente_id AND tipo = 'registro' AND orden = 8;

  -- ALCOHOL
  UPDATE public.plan_1603
  SET etiqueta = '1er Año', orden = 1, mes = 12, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '365 days'
  WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 1;

  UPDATE public.plan_1603
  SET etiqueta = '2º Año', orden = 2, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '730 days'
  WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 2;

  UPDATE public.plan_1603
  SET etiqueta = '3er Año', orden = 3, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days'
  WHERE expediente_id = _expediente_id AND tipo = 'alcohol' AND orden = 3;

  -- DROGAS
  UPDATE public.plan_1603
  SET etiqueta = '1er Año', orden = 1, mes = 12, inicio_ventana = v_fecha_origen, fin_ventana = v_fecha_origen + INTERVAL '365 days'
  WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 1;

  UPDATE public.plan_1603
  SET etiqueta = '2º Año', orden = 2, mes = 24, inicio_ventana = v_fecha_origen + INTERVAL '366 days', fin_ventana = v_fecha_origen + INTERVAL '730 days'
  WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 2;

  UPDATE public.plan_1603
  SET etiqueta = '3er Año', orden = 3, mes = 36, inicio_ventana = v_fecha_origen + INTERVAL '731 days', fin_ventana = v_fecha_origen + INTERVAL '1095 days'
  WHERE expediente_id = _expediente_id AND tipo = 'drogas' AND orden = 3;
END;
$function$;

-- 4) Restrict execute grants for the hardened RPC functions
REVOKE ALL ON FUNCTION public.recalcular_plan_1201(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.recalcular_plan_1603(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) TO authenticated;