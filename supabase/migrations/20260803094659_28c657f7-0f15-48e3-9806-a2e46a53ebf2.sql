-- Catálogo de tipos de acción de vigilancia
CREATE TABLE public.tipos_accion_vigilancia (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  tipo_plan_anual text, -- mapeo opcional a actuaciones_plan_anual.tipo
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_accion_vigilancia TO authenticated;
GRANT ALL ON public.tipos_accion_vigilancia TO service_role;
ALTER TABLE public.tipos_accion_vigilancia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tav_select_auth" ON public.tipos_accion_vigilancia FOR SELECT TO authenticated USING (true);
CREATE POLICY "tav_write_admin" ON public.tipos_accion_vigilancia FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Planes de vigilancia
CREATE TABLE public.planes_vigilancia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('especifico','campania')),
  nombre text NOT NULL,
  descripcion text,
  responsable text,
  base text NOT NULL,
  modo_alcance text NOT NULL DEFAULT 'concretos' CHECK (modo_alcance IN ('concretos','porcentaje','todos')),
  porcentaje integer CHECK (porcentaje IS NULL OR (porcentaje BETWEEN 1 AND 100)),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  distribucion text NOT NULL DEFAULT 'uniforme' CHECK (distribucion IN ('uniforme','aleatoria','manual')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','propuesta','validado','completado','archivado')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planes_vigilancia TO authenticated;
GRANT ALL ON public.planes_vigilancia TO service_role;
ALTER TABLE public.planes_vigilancia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_select" ON public.planes_vigilancia FOR SELECT TO authenticated
  USING (public.can_access_base(auth.uid(), base));
CREATE POLICY "pv_write" ON public.planes_vigilancia FOR ALL TO authenticated
  USING (public.can_access_base(auth.uid(), base))
  WITH CHECK (public.can_access_base(auth.uid(), base));

-- Acciones del plan
CREATE TABLE public.planes_vigilancia_acciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.planes_vigilancia(id) ON DELETE CASCADE,
  maquinista_id uuid NOT NULL REFERENCES public.maquinistas(id) ON DELETE CASCADE,
  tipo_accion text NOT NULL REFERENCES public.tipos_accion_vigilancia(id),
  tipo_accion_libre text,
  fecha_prevista date NOT NULL,
  fecha_real date,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','realizada','no_realizada')),
  resultado text CHECK (resultado IS NULL OR resultado IN ('conforme','no_conforme')),
  observaciones text,
  actuacion_plan_anual_id uuid REFERENCES public.actuaciones_plan_anual(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX idx_pva_plan ON public.planes_vigilancia_acciones(plan_id);
CREATE INDEX idx_pva_maquinista ON public.planes_vigilancia_acciones(maquinista_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planes_vigilancia_acciones TO authenticated;
GRANT ALL ON public.planes_vigilancia_acciones TO service_role;
ALTER TABLE public.planes_vigilancia_acciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pva_select" ON public.planes_vigilancia_acciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planes_vigilancia p WHERE p.id = plan_id AND public.can_access_base(auth.uid(), p.base)));
CREATE POLICY "pva_write" ON public.planes_vigilancia_acciones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planes_vigilancia p WHERE p.id = plan_id AND public.can_access_base(auth.uid(), p.base)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.planes_vigilancia p WHERE p.id = plan_id AND public.can_access_base(auth.uid(), p.base)));

CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON public.planes_vigilancia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pva_updated BEFORE UPDATE ON public.planes_vigilancia_acciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tav_updated BEFORE UPDATE ON public.tipos_accion_vigilancia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.tipos_accion_vigilancia (id, nombre, tipo_plan_anual, orden) VALUES
  ('acompanamiento_cabina','Acompañamiento en cabina','acompanamiento',1),
  ('registro','Registro','registro',2),
  ('alcohol_drogas','Control de alcohol y drogas','alcohol',3),
  ('acompanamiento_maniobras','Acompañamiento en maniobras',NULL,4),
  ('sondeo_documentacion','Sondeo de documentación',NULL,5),
  ('presentacion_servicio','Presentación al servicio',NULL,6),
  ('otros','Otros',NULL,7);