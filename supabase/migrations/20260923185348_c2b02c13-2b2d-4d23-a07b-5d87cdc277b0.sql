CREATE TABLE public.doc_sondeos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_sondeo date NOT NULL,
  base_nombre text NOT NULL,
  modo text NOT NULL CHECK (modo IN ('agregado','resumen_maquinista','detalle_agente')),
  nombre_archivo text,
  hash_archivo text,
  observaciones text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha_sondeo, base_nombre, modo)
);
CREATE TABLE public.doc_registros_agregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondeo_id uuid NOT NULL REFERENCES public.doc_sondeos(id) ON DELETE CASCADE,
  referencia text NOT NULL, titulo text, tipo_documento text, fecha_vigor date,
  incluidos integer NOT NULL DEFAULT 0 CHECK (incluidos>=0),
  recibidos integer NOT NULL DEFAULT 0 CHECK (recibidos>=0),
  abiertos integer NOT NULL DEFAULT 0 CHECK (abiertos>=0),
  leidos integer NOT NULL DEFAULT 0 CHECK (leidos>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sondeo_id, referencia)
);
CREATE TABLE public.doc_resumenes_maquinista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondeo_id uuid NOT NULL REFERENCES public.doc_sondeos(id) ON DELETE CASCADE,
  maquinista_id uuid REFERENCES public.maquinistas(id) ON DELETE SET NULL,
  matricula text NOT NULL, nombre text,
  incluidos integer, recibidos integer, abiertos integer, leidos integer,
  asignados integer NOT NULL CHECK (asignados>=0),
  leidos_total integer NOT NULL CHECK (leidos_total>=0 AND leidos_total<=asignados),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sondeo_id, matricula)
);
CREATE TABLE public.doc_detalle_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondeo_id uuid NOT NULL REFERENCES public.doc_sondeos(id) ON DELETE CASCADE,
  maquinista_id uuid REFERENCES public.maquinistas(id) ON DELETE SET NULL,
  matricula text NOT NULL, nombre text,
  referencia text NOT NULL, titulo text, tipo_documento text, fecha_vigor date,
  estado text NOT NULL CHECK (estado IN ('incluido','recibido','abierto','leido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sondeo_id, matricula, referencia)
);
CREATE INDEX ON public.doc_registros_agregados(sondeo_id);
CREATE INDEX ON public.doc_resumenes_maquinista(sondeo_id);
CREATE INDEX ON public.doc_detalle_agente(sondeo_id);
CREATE INDEX ON public.doc_sondeos(base_nombre, fecha_sondeo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_sondeos, public.doc_registros_agregados, public.doc_resumenes_maquinista, public.doc_detalle_agente TO authenticated;
GRANT ALL ON public.doc_sondeos, public.doc_registros_agregados, public.doc_resumenes_maquinista, public.doc_detalle_agente TO service_role;

ALTER TABLE public.doc_sondeos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_registros_agregados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_resumenes_maquinista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_detalle_agente ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.doc_sondeo_base(_sondeo_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT base_nombre FROM public.doc_sondeos WHERE id=_sondeo_id $$;
REVOKE EXECUTE ON FUNCTION public.doc_sondeo_base(uuid) FROM PUBLIC, anon;

-- Evita mezclar tipos: cada tabla hija solo acepta sondeos de su modo
CREATE OR REPLACE FUNCTION public.doc_check_modo() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE m text;
BEGIN
  SELECT modo INTO m FROM public.doc_sondeos WHERE id=NEW.sondeo_id;
  IF m IS DISTINCT FROM TG_ARGV[0] THEN
    RAISE EXCEPTION 'El sondeo es de tipo % y no admite registros de tipo %', m, TG_ARGV[0];
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER doc_reg_modo BEFORE INSERT OR UPDATE ON public.doc_registros_agregados FOR EACH ROW EXECUTE FUNCTION public.doc_check_modo('agregado');
CREATE TRIGGER doc_res_modo BEFORE INSERT OR UPDATE ON public.doc_resumenes_maquinista FOR EACH ROW EXECUTE FUNCTION public.doc_check_modo('resumen_maquinista');
CREATE TRIGGER doc_det_modo BEFORE INSERT OR UPDATE ON public.doc_detalle_agente FOR EACH ROW EXECUTE FUNCTION public.doc_check_modo('detalle_agente');
CREATE TRIGGER doc_sondeos_updated BEFORE UPDATE ON public.doc_sondeos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "doc_sondeos_select" ON public.doc_sondeos FOR SELECT TO authenticated USING (public.can_access_base(auth.uid(), base_nombre));
CREATE POLICY "doc_sondeos_insert" ON public.doc_sondeos FOR INSERT TO authenticated WITH CHECK (public.can_access_base(auth.uid(), base_nombre));
CREATE POLICY "doc_sondeos_update" ON public.doc_sondeos FOR UPDATE TO authenticated USING (public.can_access_base(auth.uid(), base_nombre)) WITH CHECK (public.can_access_base(auth.uid(), base_nombre));
CREATE POLICY "doc_sondeos_delete" ON public.doc_sondeos FOR DELETE TO authenticated USING (public.can_admin_base(auth.uid(), base_nombre));

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['doc_registros_agregados','doc_resumenes_maquinista','doc_detalle_agente'] LOOP
  EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_base(auth.uid(), public.doc_sondeo_base(sondeo_id)))', t);
  EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.can_access_base(auth.uid(), public.doc_sondeo_base(sondeo_id)))', t);
  EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated USING (public.can_access_base(auth.uid(), public.doc_sondeo_base(sondeo_id))) WITH CHECK (public.can_access_base(auth.uid(), public.doc_sondeo_base(sondeo_id)))', t);
  EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated USING (public.can_admin_base(auth.uid(), public.doc_sondeo_base(sondeo_id)))', t);
END LOOP; END $$;