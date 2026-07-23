CREATE TABLE public.criterios_plan_anual (
  anio integer PRIMARY KEY,
  registro_km_minimo integer NOT NULL DEFAULT 100,
  acompanamientos_por_red integer NOT NULL DEFAULT 1,
  acompanamientos_con_1201 integer NOT NULL DEFAULT 2,
  alcohol_anual integer NOT NULL DEFAULT 1,
  drogas_cobertura_pct integer NOT NULL DEFAULT 25,
  vigencia_1201_anios integer NOT NULL DEFAULT 3,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT ON public.criterios_plan_anual TO authenticated;
GRANT ALL ON public.criterios_plan_anual TO service_role;

ALTER TABLE public.criterios_plan_anual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read criterios"
  ON public.criterios_plan_anual FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert criterios"
  ON public.criterios_plan_anual FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update criterios"
  ON public.criterios_plan_anual FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete criterios"
  ON public.criterios_plan_anual FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_criterios_plan_anual_updated_at
  BEFORE UPDATE ON public.criterios_plan_anual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.criterios_plan_anual (anio, notas) VALUES
  (2024, 'Criterios iniciales'),
  (2025, 'Criterios iniciales'),
  (2026, 'Criterios iniciales')
ON CONFLICT (anio) DO NOTHING;