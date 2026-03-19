-- 1. Add 'redes' field to bases_conduccion
ALTER TABLE public.bases_conduccion 
ADD COLUMN redes text NOT NULL DEFAULT 'convencional';
-- Values: 'convencional', 'av', 'ambas'

-- 2. Create actuaciones_plan_anual table
CREATE TABLE public.actuaciones_plan_anual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinista_id uuid NOT NULL REFERENCES public.maquinistas(id) ON DELETE CASCADE,
  anio integer NOT NULL,
  tipo text NOT NULL, -- 'registro', 'acompanamiento', 'alcohol', 'drogas'
  red text, -- 'convencional', 'av', null (for alcohol/drogas)
  fecha_real date NOT NULL,
  km_recorridos numeric, -- for registro type, min 100km
  indice_prever numeric,
  resultado text, -- for alcohol/drogas: 'Negativo', 'Positivo'
  observaciones text,
  registrado_por uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.actuaciones_plan_anual ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - same pattern as other maquinista-related tables
CREATE POLICY "Access actuaciones_plan_anual" ON public.actuaciones_plan_anual
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maquinistas m
    WHERE m.id = actuaciones_plan_anual.maquinista_id
    AND public.can_access_base(auth.uid(), m.base)
  ));

CREATE POLICY "Manage actuaciones_plan_anual" ON public.actuaciones_plan_anual
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maquinistas m
    WHERE m.id = actuaciones_plan_anual.maquinista_id
    AND public.can_access_base(auth.uid(), m.base)
  ));

-- 5. Updated_at trigger
CREATE TRIGGER update_actuaciones_plan_anual_updated_at
  BEFORE UPDATE ON public.actuaciones_plan_anual
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();