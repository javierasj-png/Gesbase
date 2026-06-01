DROP POLICY IF EXISTS "Read base_certificaciones" ON public.base_certificaciones;

CREATE POLICY "Read base_certificaciones scoped"
ON public.base_certificaciones
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.bases_conduccion b
    WHERE b.id = base_certificaciones.base_id
      AND public.can_access_base(auth.uid(), b.nombre)
  )
);