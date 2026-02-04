-- Drop old conflicting policies first
DROP POLICY IF EXISTS "Admins can view all base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can insert base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can update base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can delete base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users can view their own base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins and gestors manage assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users view own assignments" ON public.base_assignments;

-- Create simplified policies that don't use can_access_base (to avoid recursion)
-- Admin can do everything
CREATE POLICY "Admin full access to base_assignments"
ON public.base_assignments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Gestor can manage assignments for bases they are assigned to
-- We use a correlated subquery with alias to avoid self-reference issues
CREATE POLICY "Gestor manage base_assignments"
ON public.base_assignments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor') 
  AND EXISTS (
    SELECT 1 FROM public.base_assignments ba 
    WHERE ba.user_id = auth.uid() AND ba.base_nombre = base_assignments.base_nombre
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'gestor') 
  AND EXISTS (
    SELECT 1 FROM public.base_assignments ba 
    WHERE ba.user_id = auth.uid() AND ba.base_nombre = base_assignments.base_nombre
  )
);

-- Users can view their own assignments
CREATE POLICY "Users view own base_assignments"
ON public.base_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);