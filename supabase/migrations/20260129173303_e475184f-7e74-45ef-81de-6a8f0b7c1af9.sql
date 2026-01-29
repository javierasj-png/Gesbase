-- Recalcular plan PE 16.03 cuando cambie la fecha de primer servicio

-- 1) Función: recalcula ventanas del plan en base a una nueva fecha_origen
CREATE OR REPLACE FUNCTION public.recalcular_plan_1603(_expediente_id uuid, _fecha_origen date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fecha_origen date := _fecha_origen;
BEGIN
  -- Actualizar expediente
  UPDATE public.expedientes_1603
  SET
    fecha_primer_servicio = v_fecha_origen,
    fecha_fin_prevista = v_fecha_origen + INTERVAL '3 years',
    updated_at = now(),
    updated_by = auth.uid()
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
$$;

-- 2) Trigger: si cambia fecha_primer_servicio de un maquinista bajo PE 16.03, recalcular su expediente/plan abierto
CREATE OR REPLACE FUNCTION public.on_maquinista_fecha_primer_servicio_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expediente_id uuid;
BEGIN
  -- Solo si bajo_pe_1603 y hay fecha
  IF NEW.bajo_pe_1603 = true AND NEW.fecha_primer_servicio IS NOT NULL THEN
    -- Si hay expediente abierto, recalcular; si no, dejar que lo cree la función existente generar_plan_1603 (si hay trigger de creación)
    SELECT e.id INTO v_expediente_id
    FROM public.expedientes_1603 e
    WHERE e.maquinista_id = NEW.id AND e.estado = 'abierto'
    ORDER BY e.created_at DESC
    LIMIT 1;

    IF v_expediente_id IS NOT NULL THEN
      PERFORM public.recalcular_plan_1603(v_expediente_id, NEW.fecha_primer_servicio);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maquinista_recalcula_plan_1603 ON public.maquinistas;
CREATE TRIGGER trg_maquinista_recalcula_plan_1603
AFTER UPDATE OF fecha_primer_servicio, bajo_pe_1603 ON public.maquinistas
FOR EACH ROW
WHEN (OLD.fecha_primer_servicio IS DISTINCT FROM NEW.fecha_primer_servicio OR OLD.bajo_pe_1603 IS DISTINCT FROM NEW.bajo_pe_1603)
EXECUTE FUNCTION public.on_maquinista_fecha_primer_servicio_change();
