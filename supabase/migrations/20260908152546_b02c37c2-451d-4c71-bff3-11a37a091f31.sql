CREATE TABLE public.maquinista_inactividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinista_id uuid NOT NULL REFERENCES public.maquinistas(id) ON DELETE CASCADE,
  motivo text NOT NULL DEFAULT 'baja_temporal',
  observaciones text,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maquinista_inactividades TO authenticated;
GRANT ALL ON public.maquinista_inactividades TO service_role;

ALTER TABLE public.maquinista_inactividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver inactividades de bases accesibles"
ON public.maquinista_inactividades FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.maquinistas m WHERE m.id = maquinista_id AND public.can_access_base(auth.uid(), m.base)));

CREATE POLICY "Gestionar inactividades de bases accesibles"
ON public.maquinista_inactividades FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.maquinistas m WHERE m.id = maquinista_id AND public.can_access_base(auth.uid(), m.base)))
WITH CHECK (EXISTS (SELECT 1 FROM public.maquinistas m WHERE m.id = maquinista_id AND public.can_access_base(auth.uid(), m.base)));

CREATE INDEX idx_maquinista_inactividades_maq ON public.maquinista_inactividades(maquinista_id);

CREATE TRIGGER trg_maquinista_inactividades_updated
BEFORE UPDATE ON public.maquinista_inactividades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.plan_1603 ADD COLUMN IF NOT EXISTS justificado_inactividad boolean NOT NULL DEFAULT false;
ALTER TABLE public.plan_1201 ADD COLUMN IF NOT EXISTS justificado_inactividad boolean NOT NULL DEFAULT false;
ALTER TABLE public.plan_seguimiento_especial ADD COLUMN IF NOT EXISTS justificado_inactividad boolean NOT NULL DEFAULT false;
ALTER TABLE public.planes_vigilancia_acciones ADD COLUMN IF NOT EXISTS justificado_inactividad boolean NOT NULL DEFAULT false;