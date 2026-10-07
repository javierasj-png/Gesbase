-- Catálogos: solo usuarios con rol asignado
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

DROP POLICY IF EXISTS "Authenticated can read criterios" ON public.criterios_plan_anual;
CREATE POLICY "Usuarios con rol leen criterios" ON public.criterios_plan_anual FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "tav_select_auth" ON public.tipos_accion_vigilancia;
CREATE POLICY "tav_select_roles" ON public.tipos_accion_vigilancia FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "Authenticated read bases" ON public.bases_conduccion;
CREATE POLICY "Usuarios con rol leen bases" ON public.bases_conduccion FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view certifications" ON public.certificaciones;
CREATE POLICY "Usuarios con rol leen certificaciones" ON public.certificaciones FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- Asistente: solo administradores; cualquiera con rol registra sus propias preguntas
DROP POLICY IF EXISTS "Autenticados gestionan conocimiento" ON public.chatbot_conocimiento;
CREATE POLICY "Admins gestionan conocimiento" ON public.chatbot_conocimiento FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Autenticados gestionan preguntas del asistente" ON public.chatbot_preguntas;
CREATE POLICY "Admins gestionan preguntas" ON public.chatbot_preguntas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Usuarios registran sus preguntas" ON public.chatbot_preguntas FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_any_role(auth.uid()));

-- Partes: por base asignada o autoría
DROP POLICY IF EXISTS "partes_auth_select" ON public.partes;
DROP POLICY IF EXISTS "partes_auth_insert" ON public.partes;
DROP POLICY IF EXISTS "partes_auth_update" ON public.partes;
CREATE POLICY "partes_select_scoped" ON public.partes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR (base IS NOT NULL AND public.can_access_base(auth.uid(), base)));
CREATE POLICY "partes_insert_scoped" ON public.partes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (base IS NULL OR public.can_access_base(auth.uid(), base)));
CREATE POLICY "partes_update_scoped" ON public.partes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR (base IS NOT NULL AND public.can_access_base(auth.uid(), base)))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR (base IS NOT NULL AND public.can_access_base(auth.uid(), base)));

-- Storage: carpeta por usuario
DROP POLICY IF EXISTS "partes_insert_auth" ON storage.objects;
CREATE POLICY "partes_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partes' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "partes_update_auth_scoped" ON storage.objects;
CREATE POLICY "partes_update_own_or_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'partes' AND (public.has_role(auth.uid(),'admin') OR owner_id = (select auth.uid()::text)))
  WITH CHECK (bucket_id = 'partes' AND (public.has_role(auth.uid(),'admin') OR owner_id = (select auth.uid()::text)));
DROP POLICY IF EXISTS "partes_select_auth_scoped" ON storage.objects;
CREATE POLICY "partes_select_scoped" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'partes' AND (
    public.has_role(auth.uid(),'admin')
    OR owner_id = (select auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.partes p WHERE p.archivo_url = objects.name AND p.base IS NOT NULL AND public.can_access_base(auth.uid(), p.base))
  ));
DROP POLICY IF EXISTS "Authenticated users upload visita files" ON storage.objects;
CREATE POLICY "Users upload visita files to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visitas-base' AND (storage.foldername(name))[1] = (select auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.bases_conduccion b WHERE b.id::text = (storage.foldername(name))[2] AND public.can_access_base(auth.uid(), b.nombre)));