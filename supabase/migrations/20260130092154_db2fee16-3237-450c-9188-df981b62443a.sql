-- Create helper functions for gestor role management

-- Function to check if user is gestor
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'gestor'
  )
$$;

-- Function to check if user can admin a specific base
-- Returns true if user is admin, OR if user is gestor AND has that base assigned
CREATE OR REPLACE FUNCTION public.can_admin_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin') 
    OR (
      public.has_role(_user_id, 'gestor') 
      AND EXISTS (
        SELECT 1 FROM public.base_assignments
        WHERE user_id = _user_id AND base_nombre = _base_nombre
      )
    )
$$;