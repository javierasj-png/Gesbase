
-- Create table for base visits/audits
CREATE TABLE public.visitas_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_id UUID NOT NULL REFERENCES public.bases_conduccion(id),
  base_nombre TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'visita_seguridad', -- visita_seguridad, auditoria
  fecha_visita DATE NOT NULL DEFAULT CURRENT_DATE,
  archivo_url TEXT,
  archivo_nombre TEXT,
  estado_analisis TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, procesando, completado, error
  resumen TEXT,
  puntos_fuertes JSONB DEFAULT '[]'::jsonb,
  puntos_mejora JSONB DEFAULT '[]'::jsonb,
  no_conformidades JSONB DEFAULT '[]'::jsonb,
  acta_completa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

ALTER TABLE public.visitas_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access visitas by base" ON public.visitas_base
  FOR SELECT USING (can_access_base(auth.uid(), base_nombre));

CREATE POLICY "Manage visitas by base" ON public.visitas_base
  FOR ALL USING (can_access_base(auth.uid(), base_nombre))
  WITH CHECK (can_access_base(auth.uid(), base_nombre));

CREATE TRIGGER update_visitas_base_updated_at
  BEFORE UPDATE ON public.visitas_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for visit PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('visitas-base', 'visitas-base', false);

CREATE POLICY "Access visita files" ON storage.objects
  FOR SELECT USING (bucket_id = 'visitas-base');

CREATE POLICY "Upload visita files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'visitas-base' AND auth.role() = 'authenticated');

CREATE POLICY "Delete visita files" ON storage.objects
  FOR DELETE USING (bucket_id = 'visitas-base' AND auth.role() = 'authenticated');
