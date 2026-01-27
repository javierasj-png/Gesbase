-- Crear enum para tipo de actuación 16.03
CREATE TYPE public.tipo_actuacion_1603 AS ENUM ('Acompañamiento', 'Registro', 'Alcohol', 'Drogas');

-- Crear enum para estado de bloque 16.03
CREATE TYPE public.estado_bloque_1603 AS ENUM ('Pendiente', 'En ventana', 'Vencida', 'Cumplida');

-- Crear enum para estado de expediente
CREATE TYPE public.estado_expediente AS ENUM ('Activo', 'Cerrado');

-- Tabla de expedientes PE 16.03
CREATE TABLE public.expedientes_1603 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maquinista_id UUID NOT NULL REFERENCES public.maquinistas(id) ON DELETE CASCADE,
  fecha_primer_servicio DATE NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin_prevista DATE NOT NULL,
  estado public.estado_expediente NOT NULL DEFAULT 'Activo',
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE(maquinista_id)
);

-- Tabla del plan de vigilancia PE 16.03
CREATE TABLE public.plan_1603 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id UUID NOT NULL REFERENCES public.expedientes_1603(id) ON DELETE CASCADE,
  tipo public.tipo_actuacion_1603 NOT NULL,
  etiqueta TEXT NOT NULL,
  orden INTEGER NOT NULL,
  inicio_ventana DATE NOT NULL,
  fin_ventana DATE NOT NULL,
  estado public.estado_bloque_1603 NOT NULL DEFAULT 'Pendiente',
  actuacion_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Tabla de actuaciones PE 16.03
CREATE TABLE public.actuaciones_1603 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id UUID NOT NULL REFERENCES public.expedientes_1603(id) ON DELETE CASCADE,
  tipo public.tipo_actuacion_1603 NOT NULL,
  fecha_real DATE NOT NULL,
  resultado TEXT,
  observaciones TEXT,
  adjuntos TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Habilitar RLS
ALTER TABLE public.expedientes_1603 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_1603 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actuaciones_1603 ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para expedientes_1603
CREATE POLICY "Admins full access to expedientes_1603"
ON public.expedientes_1603 FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mandos can view expedientes from their bases"
ON public.expedientes_1603 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.maquinistas m
    WHERE m.id = maquinista_id
    AND can_access_base(auth.uid(), m.base)
  )
);

CREATE POLICY "Mandos can update expedientes from their bases"
ON public.expedientes_1603 FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.maquinistas m
    WHERE m.id = maquinista_id
    AND can_access_base(auth.uid(), m.base)
  )
);

-- Políticas RLS para plan_1603
CREATE POLICY "Admins full access to plan_1603"
ON public.plan_1603 FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mandos can view plan from their bases"
ON public.plan_1603 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes_1603 e
    JOIN public.maquinistas m ON m.id = e.maquinista_id
    WHERE e.id = expediente_id
    AND can_access_base(auth.uid(), m.base)
  )
);

CREATE POLICY "Mandos can update plan from their bases"
ON public.plan_1603 FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes_1603 e
    JOIN public.maquinistas m ON m.id = e.maquinista_id
    WHERE e.id = expediente_id
    AND can_access_base(auth.uid(), m.base)
  )
);

-- Políticas RLS para actuaciones_1603
CREATE POLICY "Admins full access to actuaciones_1603"
ON public.actuaciones_1603 FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mandos can view actuaciones from their bases"
ON public.actuaciones_1603 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes_1603 e
    JOIN public.maquinistas m ON m.id = e.maquinista_id
    WHERE e.id = expediente_id
    AND can_access_base(auth.uid(), m.base)
  )
);

CREATE POLICY "Mandos can insert actuaciones in their bases"
ON public.actuaciones_1603 FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expedientes_1603 e
    JOIN public.maquinistas m ON m.id = e.maquinista_id
    WHERE e.id = expediente_id
    AND can_access_base(auth.uid(), m.base)
  )
);

CREATE POLICY "Mandos can update actuaciones from their bases"
ON public.actuaciones_1603 FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.expedientes_1603 e
    JOIN public.maquinistas m ON m.id = e.maquinista_id
    WHERE e.id = expediente_id
    AND can_access_base(auth.uid(), m.base)
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_expedientes_1603_updated_at
BEFORE UPDATE ON public.expedientes_1603
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_1603_updated_at
BEFORE UPDATE ON public.plan_1603
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_actuaciones_1603_updated_at
BEFORE UPDATE ON public.actuaciones_1603
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para generar el plan PE 16.03 automáticamente
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
    -- Verificar si ya existe expediente para este maquinista
    IF NOT EXISTS (SELECT 1 FROM expedientes_1603 WHERE maquinista_id = NEW.id) THEN
      v_fecha_origen := NEW.fecha_primer_servicio;
      v_fecha_fin := v_fecha_origen + INTERVAL '3 years';
      
      -- Crear expediente
      INSERT INTO expedientes_1603 (maquinista_id, fecha_primer_servicio, fecha_inicio, fecha_fin_prevista, created_by, updated_by)
      VALUES (NEW.id, v_fecha_origen, CURRENT_DATE, v_fecha_fin, NEW.created_by, NEW.updated_by)
      RETURNING id INTO v_expediente_id;
      
      -- Generar plan de vigilancia - ACOMPAÑAMIENTOS (5 bloques)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Acompañamiento', 'Primera Quincena', 1, v_fecha_origen, v_fecha_origen + 15),
        (v_expediente_id, 'Acompañamiento', 'Primer Trimestre', 2, v_fecha_origen + 16, v_fecha_origen + 90),
        (v_expediente_id, 'Acompañamiento', 'Primer Semestre', 3, v_fecha_origen + 91, v_fecha_origen + 182),
        (v_expediente_id, 'Acompañamiento', 'Segundo Semestre', 4, v_fecha_origen + 183, v_fecha_origen + 365),
        (v_expediente_id, 'Acompañamiento', 'Tercer Semestre', 5, v_fecha_origen + 366, v_fecha_origen + 547);
      
      -- REGISTROS - Primer Año (4 trimestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Trimestre', 1, v_fecha_origen, v_fecha_origen + 90),
        (v_expediente_id, 'Registro', 'Segundo Trimestre', 2, v_fecha_origen + 91, v_fecha_origen + 182),
        (v_expediente_id, 'Registro', 'Tercer Trimestre', 3, v_fecha_origen + 183, v_fecha_origen + 273),
        (v_expediente_id, 'Registro', 'Cuarto Trimestre', 4, v_fecha_origen + 274, v_fecha_origen + 365);
      
      -- REGISTROS - Segundo Año (2 semestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Semestre (2º Año)', 5, v_fecha_origen + 366, v_fecha_origen + 547),
        (v_expediente_id, 'Registro', 'Segundo Semestre (2º Año)', 6, v_fecha_origen + 548, v_fecha_origen + 730);
      
      -- REGISTROS - Tercer Año (2 semestres)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Registro', 'Primer Semestre (3er Año)', 7, v_fecha_origen + 731, v_fecha_origen + 912),
        (v_expediente_id, 'Registro', 'Segundo Semestre (3er Año)', 8, v_fecha_origen + 913, v_fecha_origen + 1095);
      
      -- ALCOHOL (1 por año)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Alcohol', '1er Año', 1, v_fecha_origen, v_fecha_origen + 365),
        (v_expediente_id, 'Alcohol', '2º Año', 2, v_fecha_origen + 366, v_fecha_origen + 730),
        (v_expediente_id, 'Alcohol', '3er Año', 3, v_fecha_origen + 731, v_fecha_origen + 1095);
      
      -- DROGAS (1 por año)
      INSERT INTO plan_1603 (expediente_id, tipo, etiqueta, orden, inicio_ventana, fin_ventana) VALUES
        (v_expediente_id, 'Drogas', '1er Año', 1, v_fecha_origen, v_fecha_origen + 365),
        (v_expediente_id, 'Drogas', '2º Año', 2, v_fecha_origen + 366, v_fecha_origen + 730),
        (v_expediente_id, 'Drogas', '3er Año', 3, v_fecha_origen + 731, v_fecha_origen + 1095);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para generar plan automáticamente al crear/actualizar maquinista
CREATE TRIGGER trigger_generar_plan_1603
AFTER INSERT OR UPDATE OF bajo_pe_1603, fecha_primer_servicio ON public.maquinistas
FOR EACH ROW
EXECUTE FUNCTION public.generar_plan_1603();