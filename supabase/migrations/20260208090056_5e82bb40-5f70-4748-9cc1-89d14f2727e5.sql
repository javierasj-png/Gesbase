
-- 1) Add status column to profiles (pending by default)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Set existing users to 'active' (they were already working)
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

-- 2) Create function for gestor to manage users (restricted: only mando role, only their bases)
CREATE OR REPLACE FUNCTION public.gestor_can_manage_user(_user_id uuid, _gestor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_gestor_id, 'admin')
    OR (
      public.has_role(_gestor_id, 'gestor')
    );
$$;

-- 3) Allow gestors to INSERT mando role (not admin/gestor)
CREATE POLICY "gestor_insert_mando_role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND role = 'mando'::app_role
  )
);

-- 4) Allow gestors to DELETE mando role only
CREATE POLICY "gestor_delete_mando_role"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND role = 'mando'::app_role
  )
);

-- 5) Allow gestors to manage base_assignments for their own bases
CREATE POLICY "gestor_insert_base_assignments"
ON public.base_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.base_assignments ba
      WHERE ba.user_id = auth.uid() AND ba.base_nombre = base_assignments.base_nombre
    )
  )
);

CREATE POLICY "gestor_delete_base_assignments"
ON public.base_assignments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.base_assignments ba
      WHERE ba.user_id = auth.uid() AND ba.base_nombre = base_assignments.base_nombre
    )
  )
);

-- 6) Allow admin/gestor to update profiles status
CREATE POLICY "admin_gestor_update_profiles_status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);
