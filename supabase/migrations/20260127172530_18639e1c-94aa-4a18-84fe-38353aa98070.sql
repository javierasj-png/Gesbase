-- Fix the update_updated_at_column function to have proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update partes RLS policies to be more restrictive (require authenticated users)
DROP POLICY IF EXISTS "Permitir actualización de partes" ON public.partes;
DROP POLICY IF EXISTS "Permitir eliminación de partes" ON public.partes;
DROP POLICY IF EXISTS "Permitir inserción de partes" ON public.partes;
DROP POLICY IF EXISTS "Permitir lectura de partes" ON public.partes;

-- New policies for partes that respect base access
CREATE POLICY "Users can read partes from their bases"
ON public.partes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.can_access_base(auth.uid(), base)
);

CREATE POLICY "Users can insert partes for their bases"
ON public.partes FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.can_access_base(auth.uid(), base)
);

CREATE POLICY "Users can update partes from their bases"
ON public.partes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.can_access_base(auth.uid(), base)
);

CREATE POLICY "Users can delete partes from their bases"
ON public.partes FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.can_access_base(auth.uid(), base)
);