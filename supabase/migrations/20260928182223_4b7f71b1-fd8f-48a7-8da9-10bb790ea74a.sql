CREATE TABLE public.doc_actuaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_nombre text NOT NULL,
  matricula text,
  nombre text,
  referencia text,
  responsable text NOT NULL CHECK (length(trim(responsable)) BETWEEN 1 AND 150),
  fecha_actuacion date NOT NULL,
  fecha_comunicacion date,
  canal text,
  estado text NOT NULL CHECK (estado IN ('He hablado con el agente','Aviso enviado','Mando intermedio (MMII)','Baja IT','Vacaciones','Anomalía comunicada','Incidencia técnica','Pendiente de seguimiento','Otra situación')),
  vigencia_hasta date,
  comentario text CHECK (comentario IS NULL OR length(comentario) <= 4000),
  no_computa boolean NOT NULL DEFAULT false,
  periodo date NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doc_act_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= fecha_actuacion),
  CONSTRAINT doc_act_nocomputa_matricula CHECK (NOT no_computa OR matricula IS NOT NULL),
  CONSTRAINT doc_act_nombre_matricula CHECK (nombre IS NULL OR matricula IS NOT NULL),
  CONSTRAINT doc_act_comunicacion CHECK ((fecha_comunicacion IS NULL) = (canal IS NULL)),
  CONSTRAINT doc_act_com_fecha CHECK (fecha_comunicacion IS NULL OR fecha_comunicacion <= fecha_actuacion),
  CONSTRAINT doc_act_aviso CHECK (estado NOT IN ('Aviso enviado','Anomalía comunicada') OR fecha_comunicacion IS NOT NULL)
);
CREATE UNIQUE INDEX doc_act_una_por_sondeo ON public.doc_actuaciones (base_nombre, matricula, periodo) WHERE matricula IS NOT NULL;
CREATE INDEX doc_act_base ON public.doc_actuaciones (base_nombre, matricula);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_actuaciones TO authenticated;
GRANT ALL ON public.doc_actuaciones TO service_role;
ALTER TABLE public.doc_actuaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_act_select ON public.doc_actuaciones FOR SELECT TO authenticated USING (public.can_access_base(auth.uid(), base_nombre));
CREATE POLICY doc_act_insert ON public.doc_actuaciones FOR INSERT TO authenticated WITH CHECK (public.can_access_base(auth.uid(), base_nombre) AND created_by = auth.uid());
CREATE POLICY doc_act_update ON public.doc_actuaciones FOR UPDATE TO authenticated USING (public.can_access_base(auth.uid(), base_nombre)) WITH CHECK (public.can_access_base(auth.uid(), base_nombre));
CREATE POLICY doc_act_delete ON public.doc_actuaciones FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.can_admin_base(auth.uid(), base_nombre));

CREATE OR REPLACE FUNCTION public.doc_act_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); NEW.created_at := now(); NEW.updated_by := NULL;
  ELSE NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.updated_by := auth.uid(); NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER doc_act_audit BEFORE INSERT OR UPDATE ON public.doc_actuaciones FOR EACH ROW EXECUTE FUNCTION public.doc_act_audit();