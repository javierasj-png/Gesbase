
-- 1. Create traslados_1603 table
CREATE TABLE public.traslados_1603 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes_1603(id) ON DELETE CASCADE,
  fecha_traslado date NOT NULL,
  base_origen text NOT NULL,
  base_destino text NOT NULL,
  observaciones text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add columns to plan_1603 for transfer justification
ALTER TABLE public.plan_1603
  ADD COLUMN justificado_traslado boolean DEFAULT false,
  ADD COLUMN traslado_id uuid REFERENCES public.traslados_1603(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.traslados_1603 ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for traslados_1603
CREATE POLICY "Access traslados_1603" ON public.traslados_1603
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = traslados_1603.expediente_id
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage traslados_1603" ON public.traslados_1603
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = traslados_1603.expediente_id
      AND public.can_access_base(auth.uid(), m.base)
    )
  );
