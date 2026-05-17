
-- Cabecera: seguimientos especiales por maquinista
CREATE TABLE public.seguimientos_especiales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maquinista_id uuid NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  motivo text NOT NULL,
  indice_prever numeric,
  fecha_anomalia date,
  email_destinatario text,
  email_asunto text,
  email_cuerpo text,
  email_enviado_at timestamptz,
  estado text NOT NULL DEFAULT 'abierto',
  fecha_cierre timestamptz,
  cerrado_por uuid,
  observaciones text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seg_esp_maquinista ON public.seguimientos_especiales(maquinista_id);
CREATE INDEX idx_seg_esp_estado ON public.seguimientos_especiales(estado);

ALTER TABLE public.seguimientos_especiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access seguimientos_especiales"
ON public.seguimientos_especiales
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.maquinistas m
  WHERE m.id = seguimientos_especiales.maquinista_id
    AND can_access_base(auth.uid(), m.base)
));

CREATE POLICY "Manage seguimientos_especiales"
ON public.seguimientos_especiales
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.maquinistas m
  WHERE m.id = seguimientos_especiales.maquinista_id
    AND can_access_base(auth.uid(), m.base)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.maquinistas m
  WHERE m.id = seguimientos_especiales.maquinista_id
    AND can_access_base(auth.uid(), m.base)
));

CREATE TRIGGER trg_seg_esp_updated_at
BEFORE UPDATE ON public.seguimientos_especiales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Acciones planificadas del seguimiento
CREATE TABLE public.plan_seguimiento_especial (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seguimiento_id uuid NOT NULL REFERENCES public.seguimientos_especiales(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  fecha_objetivo date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  fecha_real date,
  resultado text,
  observaciones text,
  comentario_vencida text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pse_seguimiento ON public.plan_seguimiento_especial(seguimiento_id);
CREATE INDEX idx_pse_fecha ON public.plan_seguimiento_especial(fecha_objetivo);

ALTER TABLE public.plan_seguimiento_especial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access plan_seg_esp"
ON public.plan_seguimiento_especial
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.seguimientos_especiales s
  JOIN public.maquinistas m ON m.id = s.maquinista_id
  WHERE s.id = plan_seguimiento_especial.seguimiento_id
    AND can_access_base(auth.uid(), m.base)
));

CREATE POLICY "Manage plan_seg_esp"
ON public.plan_seguimiento_especial
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.seguimientos_especiales s
  JOIN public.maquinistas m ON m.id = s.maquinista_id
  WHERE s.id = plan_seguimiento_especial.seguimiento_id
    AND can_access_base(auth.uid(), m.base)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.seguimientos_especiales s
  JOIN public.maquinistas m ON m.id = s.maquinista_id
  WHERE s.id = plan_seguimiento_especial.seguimiento_id
    AND can_access_base(auth.uid(), m.base)
));

CREATE TRIGGER trg_pse_updated_at
BEFORE UPDATE ON public.plan_seguimiento_especial
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
