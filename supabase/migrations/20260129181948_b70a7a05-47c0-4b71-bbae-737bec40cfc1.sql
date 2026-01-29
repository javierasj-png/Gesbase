-- Migrar plan_1201 con tipo 'hito_obligatorio' a los tipos correctos
-- Primero, borramos los hitos con tipo incorrecto y regeneramos

-- Recrear la función para generar el plan 12.01 con tipos correctos
CREATE OR REPLACE FUNCTION generar_plan_1201()
RETURNS TRIGGER AS $$
DECLARE
  hitos_acompanamiento int[] := ARRAY[1, 7, 23, 30, 40];
  hitos_registro int[] := ARRAY[1, 7, 23, 30, 40];
  dia int;
BEGIN
  -- Generar hitos de Acompañamiento
  FOREACH dia IN ARRAY hitos_acompanamiento LOOP
    INSERT INTO plan_1201 (
      expediente_id,
      tipo,
      etiqueta,
      dia_desde_origen,
      fecha_objetivo,
      estado,
      obligatorio
    ) VALUES (
      NEW.id,
      'acompanamiento',
      'Día ' || dia,
      dia,
      NEW.fecha_primer_servicio + (dia * INTERVAL '1 day'),
      'pendiente',
      true
    );
  END LOOP;
  
  -- Generar hitos de Registro
  FOREACH dia IN ARRAY hitos_registro LOOP
    INSERT INTO plan_1201 (
      expediente_id,
      tipo,
      etiqueta,
      dia_desde_origen,
      fecha_objetivo,
      estado,
      obligatorio
    ) VALUES (
      NEW.id,
      'registro',
      'Día ' || dia,
      dia,
      NEW.fecha_primer_servicio + (dia * INTERVAL '1 day'),
      'pendiente',
      true
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Regenerar planes para expedientes que tienen tipo 'hito_obligatorio'
DO $$
DECLARE
  exp RECORD;
  hitos_dias int[] := ARRAY[1, 7, 23, 30, 40];
  dia int;
BEGIN
  -- Para cada expediente que tenga hitos con tipo incorrecto
  FOR exp IN 
    SELECT DISTINCT e.id, e.fecha_primer_servicio
    FROM expedientes_1201 e
    INNER JOIN plan_1201 p ON p.expediente_id = e.id
    WHERE p.tipo = 'hito_obligatorio'
  LOOP
    -- Eliminar los hitos con tipo incorrecto (solo los que no tienen actuación)
    DELETE FROM plan_1201 
    WHERE expediente_id = exp.id 
    AND tipo = 'hito_obligatorio'
    AND actuacion_id IS NULL;
    
    -- Verificar si ya tiene hitos de acompanamiento y registro
    IF NOT EXISTS (SELECT 1 FROM plan_1201 WHERE expediente_id = exp.id AND tipo = 'acompanamiento') THEN
      -- Generar hitos de Acompañamiento
      FOREACH dia IN ARRAY hitos_dias LOOP
        INSERT INTO plan_1201 (
          expediente_id,
          tipo,
          etiqueta,
          dia_desde_origen,
          fecha_objetivo,
          estado,
          obligatorio
        ) VALUES (
          exp.id,
          'acompanamiento',
          'Día ' || dia,
          dia,
          exp.fecha_primer_servicio + (dia * INTERVAL '1 day'),
          'pendiente',
          true
        );
      END LOOP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM plan_1201 WHERE expediente_id = exp.id AND tipo = 'registro') THEN
      -- Generar hitos de Registro
      FOREACH dia IN ARRAY hitos_dias LOOP
        INSERT INTO plan_1201 (
          expediente_id,
          tipo,
          etiqueta,
          dia_desde_origen,
          fecha_objetivo,
          estado,
          obligatorio
        ) VALUES (
          exp.id,
          'registro',
          'Día ' || dia,
          dia,
          exp.fecha_primer_servicio + (dia * INTERVAL '1 day'),
          'pendiente',
          true
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;