ALTER TABLE public.planes_vigilancia_acciones
  ADD COLUMN IF NOT EXISTS comunicada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comunicada_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS comunicada_por uuid,
  ADD COLUMN IF NOT EXISTS comunicacion_destinatario text,
  ADD COLUMN IF NOT EXISTS comunicacion_asunto text;