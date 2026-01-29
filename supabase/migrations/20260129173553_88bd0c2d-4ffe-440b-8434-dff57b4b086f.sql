-- =============================================
-- PE 12.01 TABLAS: Expedientes, Plan (hitos obligatorios), Actuaciones
-- =============================================

-- 1. TABLA EXPEDIENTES_1201
CREATE TABLE IF NOT EXISTS public.expedientes_1201 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinista_id UUID REFERENCES public.maquinistas(id) ON DELETE CASCADE NOT NULL,
  id_suceso TEXT NOT NULL,
  fecha_suceso DATE,
  fecha_primer_servicio DATE NOT NULL,
  descripcion_suceso TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  cierre_manual BOOLEAN DEFAULT false,
  fecha_cierre TIMESTAMPTZ,
  cerrado_por UUID REFERENCES auth.users(id),
  fecha_fin_prevista DATE, -- 40 días desde primer servicio
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.expedientes_1201 ENABLE ROW LEVEL SECURITY;

-- 2. TABLA PLAN_1201 (hitos obligatorios: día 1, 7, 23, 30)
CREATE TABLE IF NOT EXISTS public.plan_1201 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes_1201(id) ON DELETE CASCADE NOT NULL,
  actuacion_id UUID, -- se llenará cuando se registre la actuación
  tipo TEXT NOT NULL, -- 'hito_obligatorio' o 'ad_hoc'
  etiqueta TEXT NOT NULL, -- 'Día 1', 'Día 7', 'Día 23', 'Día 30' o descripción ad-hoc
  dia_desde_origen INTEGER NOT NULL, -- 1, 7, 23, 30 para obligatorios
  fecha_objetivo DATE, -- fecha calculada desde primer servicio
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'programado', 'realizado', 'no_procede')),
  obligatorio BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plan_1201 ENABLE ROW LEVEL SECURITY;

-- 3. TABLA ACTUACIONES_1201
CREATE TABLE IF NOT EXISTS public.actuaciones_1201 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes_1201(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plan_1201(id) ON DELETE SET NULL,
  fecha_programada DATE,
  fecha_real DATE,
  tipo_accion TEXT NOT NULL, -- 'entrevista', 'acompanamiento', 'formacion', 'evaluacion', 'otro'
  descripcion TEXT,
  resultado TEXT,
  observaciones TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.actuaciones_1201 ENABLE ROW LEVEL SECURITY;

-- Añadir FK en plan_1201 para actuacion_id
ALTER TABLE public.plan_1201 
  ADD CONSTRAINT plan_1201_actuacion_id_fkey 
  FOREIGN KEY (actuacion_id) REFERENCES public.actuaciones_1201(id) ON DELETE SET NULL;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Expedientes 1201: acceso por base del maquinista
CREATE POLICY "Access expedientes_1201" ON public.expedientes_1201
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage expedientes_1201" ON public.expedientes_1201
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- Plan 1201
CREATE POLICY "Access plan_1201" ON public.plan_1201
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1201 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage plan_1201" ON public.plan_1201
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1201 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- Actuaciones 1201
CREATE POLICY "Access actuaciones_1201" ON public.actuaciones_1201
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1201 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage actuaciones_1201" ON public.actuaciones_1201
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1201 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- =============================================
-- TRIGGER: Generar plan con hitos obligatorios al crear expediente
-- =============================================
CREATE OR REPLACE FUNCTION public.generar_plan_1201()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Calcular fecha fin prevista (40 días)
  NEW.fecha_fin_prevista := NEW.fecha_primer_servicio + INTERVAL '40 days';
  
  -- Insertar hitos obligatorios
  INSERT INTO public.plan_1201 (expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, obligatorio) VALUES
    (NEW.id, 'hito_obligatorio', 'Día 1', 1, NEW.fecha_primer_servicio + INTERVAL '1 day', true),
    (NEW.id, 'hito_obligatorio', 'Día 7', 7, NEW.fecha_primer_servicio + INTERVAL '7 days', true),
    (NEW.id, 'hito_obligatorio', 'Día 23', 23, NEW.fecha_primer_servicio + INTERVAL '23 days', true),
    (NEW.id, 'hito_obligatorio', 'Día 30', 30, NEW.fecha_primer_servicio + INTERVAL '30 days', true);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generar_plan_1201
AFTER INSERT ON public.expedientes_1201
FOR EACH ROW
EXECUTE FUNCTION public.generar_plan_1201();

-- Trigger para updated_at
CREATE TRIGGER update_expedientes_1201_updated_at
BEFORE UPDATE ON public.expedientes_1201
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_actuaciones_1201_updated_at
BEFORE UPDATE ON public.actuaciones_1201
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
