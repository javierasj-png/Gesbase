-- Añadir columnas para PE 16.03 en maquinistas
ALTER TABLE public.maquinistas 
ADD COLUMN IF NOT EXISTS bajo_pe_1603 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fecha_primer_servicio DATE;

-- Añadir columnas adicionales en expedientes_1603 para el trigger
ALTER TABLE public.expedientes_1603
ADD COLUMN IF NOT EXISTS fecha_fin_prevista DATE,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Añadir columnas en plan_1603 para ventanas de tiempo
ALTER TABLE public.plan_1603
ADD COLUMN IF NOT EXISTS etiqueta TEXT,
ADD COLUMN IF NOT EXISTS orden INTEGER,
ADD COLUMN IF NOT EXISTS inicio_ventana DATE,
ADD COLUMN IF NOT EXISTS fin_ventana DATE;

-- Función para generar plan PE 16.03 automáticamente
CREATE OR REPLACE FUNCTION public.generar_plan_1603()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expediente_id UUID;
  v_fecha_origen DATE;
  v_fecha_fin DATE;
BEGIN
  -- Solo procesar si bajo_pe_1603 es true y hay fecha de primer servicio
  IF NEW.bajo_pe_1603 = true AND NEW.fecha_primer_servicio IS NOT NULL THEN
    -- Verificar si ya existe expediente abierto para este maquinista
    IF NOT EXISTS (SELECT 1 FROM expedientes_1603 WHERE maquinista_id = NEW.id AND estado = 'abierto') THEN
      v_fecha_origen := NEW.fecha_primer_servicio;
      v_fecha_fin := v_fecha_origen + INTERVAL '3 years';
      
      -- Crear expediente
      INSERT INTO expedientes_1603 (maquinista_id, fecha_primer_servicio, fecha_inicio, tipo, estado, fecha_fin_prevista)
      VALUES (NEW.id, v_fecha_origen, CURRENT_DATE, 'pe1603', 'abierto', v_fecha_fin)
      RETURNING id INTO v_expediente_id;
      
      -- Generar plan de vigilancia - ACOMPAÑAMIENTOS (5 bloques)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Acompañamiento', 'Primera Quincena', 1, 1, v_fecha_origen, v_fecha_origen + INTERVAL '15 days'),
        (v_expediente_id, 'Acompañamiento', 'Primer Trimestre', 2, 3, v_fecha_origen + INTERVAL '16 days', v_fecha_origen + INTERVAL '90 days'),
        (v_expediente_id, 'Acompañamiento', 'Primer Semestre', 3, 6, v_fecha_origen + INTERVAL '91 days', v_fecha_origen + INTERVAL '182 days'),
        (v_expediente_id, 'Acompañamiento', 'Segundo Semestre', 4, 12, v_fecha_origen + INTERVAL '183 days', v_fecha_origen + INTERVAL '365 days'),
        (v_expediente_id, 'Acompañamiento', 'Tercer Semestre', 5, 18, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '547 days');
      
      -- REGISTROS - Primer Año (4 trimestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Trimestre', 1, 3, v_fecha_origen, v_fecha_origen + INTERVAL '90 days'),
        (v_expediente_id, 'Registro', 'Segundo Trimestre', 2, 6, v_fecha_origen + INTERVAL '91 days', v_fecha_origen + INTERVAL '182 days'),
        (v_expediente_id, 'Registro', 'Tercer Trimestre', 3, 9, v_fecha_origen + INTERVAL '183 days', v_fecha_origen + INTERVAL '273 days'),
        (v_expediente_id, 'Registro', 'Cuarto Trimestre', 4, 12, v_fecha_origen + INTERVAL '274 days', v_fecha_origen + INTERVAL '365 days');
      
      -- REGISTROS - Segundo Año (2 semestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Semestre (2º Año)', 5, 18, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '547 days'),
        (v_expediente_id, 'Registro', 'Segundo Semestre (2º Año)', 6, 24, v_fecha_origen + INTERVAL '548 days', v_fecha_origen + INTERVAL '730 days');
      
      -- REGISTROS - Tercer Año (2 semestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Semestre (3er Año)', 7, 30, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '912 days'),
        (v_expediente_id, 'Registro', 'Segundo Semestre (3er Año)', 8, 36, v_fecha_origen + INTERVAL '913 days', v_fecha_origen + INTERVAL '1095 days');
      
      -- ALCOHOL (1 por año)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Alcohol', '1er Año', 1, 12, v_fecha_origen, v_fecha_origen + INTERVAL '365 days'),
        (v_expediente_id, 'Alcohol', '2º Año', 2, 24, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '730 days'),
        (v_expediente_id, 'Alcohol', '3er Año', 3, 36, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '1095 days');
      
      -- DROGAS (1 por año)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, mes, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Drogas', '1er Año', 1, 12, v_fecha_origen, v_fecha_origen + INTERVAL '365 days'),
        (v_expediente_id, 'Drogas', '2º Año', 2, 24, v_fecha_origen + INTERVAL '366 days', v_fecha_origen + INTERVAL '730 days'),
        (v_expediente_id, 'Drogas', '3er Año', 3, 36, v_fecha_origen + INTERVAL '731 days', v_fecha_origen + INTERVAL '1095 days');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS trigger_generar_plan_1603 ON public.maquinistas;

CREATE TRIGGER trigger_generar_plan_1603
AFTER INSERT OR UPDATE OF bajo_pe_1603, fecha_primer_servicio ON public.maquinistas
FOR EACH ROW
EXECUTE FUNCTION public.generar_plan_1603();