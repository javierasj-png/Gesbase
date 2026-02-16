
-- Create partes table for storing extracted parte data
CREATE TABLE public.partes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_parte TEXT,
  fecha_parte DATE,
  hora_parte TEXT,
  hora_inicio TEXT,
  hora_fin TEXT,
  base TEXT,
  maquinista_texto TEXT,
  maquinista_id TEXT,
  tren_servicio TEXT,
  linea_tramo TEXT,
  tipo_parte TEXT NOT NULL DEFAULT 'Otro',
  descripcion_hechos TEXT,
  minutos_retraso INTEGER NOT NULL DEFAULT 0,
  causa TEXT,
  acciones_tomadas TEXT,
  firmante TEXT,
  observaciones TEXT,
  fuente_archivo TEXT,
  archivo_url TEXT,
  estado TEXT NOT NULL DEFAULT 'Nuevo',
  responsable TEXT,
  dudas_conflictos JSONB,
  confianza_global INTEGER NOT NULL DEFAULT 0,
  datos_extraidos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.partes ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users with base access can manage partes
-- Since partes may not always have a base, allow all authenticated users to read
CREATE POLICY "Authenticated users can read partes"
  ON public.partes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert partes"
  ON public.partes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update partes"
  ON public.partes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete partes"
  ON public.partes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_partes_updated_at
  BEFORE UPDATE ON public.partes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for parte files
INSERT INTO storage.buckets (id, name, public) VALUES ('partes', 'partes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload partes files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'partes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read partes files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete partes files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'partes' AND public.has_role(auth.uid(), 'admin'));
