-- Restrict certification catalog to authenticated users only
DROP POLICY IF EXISTS "Todos pueden ver certificaciones activas" ON public.certificaciones;

CREATE POLICY "Authenticated users can view certifications"
ON public.certificaciones
FOR SELECT
TO authenticated
USING (
  true
);