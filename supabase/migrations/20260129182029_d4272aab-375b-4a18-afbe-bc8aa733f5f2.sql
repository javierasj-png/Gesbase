-- Crear función para recalcular plan_1201 cuando cambia fecha_primer_servicio
CREATE OR REPLACE FUNCTION recalcular_plan_1201(_expediente_id uuid, _fecha_origen date)
RETURNS void AS $$
BEGIN
  -- Actualizar las fechas objetivo de todos los hitos del expediente
  UPDATE plan_1201
  SET fecha_objetivo = _fecha_origen + (dia_desde_origen * INTERVAL '1 day')
  WHERE expediente_id = _expediente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear trigger para recalcular automáticamente cuando cambia fecha_primer_servicio
CREATE OR REPLACE FUNCTION trigger_recalcular_plan_1201()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo recalcular si cambió la fecha de primer servicio
  IF OLD.fecha_primer_servicio IS DISTINCT FROM NEW.fecha_primer_servicio THEN
    PERFORM recalcular_plan_1201(NEW.id, NEW.fecha_primer_servicio);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS trg_recalcular_plan_1201 ON expedientes_1201;

CREATE TRIGGER trg_recalcular_plan_1201
  AFTER UPDATE ON expedientes_1201
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalcular_plan_1201();