-- Harden permission helper functions against any RLS recursion by disabling row_security inside SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;
ALTER FUNCTION public.has_role(uuid, public.app_role) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.can_access_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.base_assignments
      WHERE user_id = _user_id
        AND base_nombre = _base_nombre
    );
$$;
ALTER FUNCTION public.can_access_base(uuid, text) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.has_role(_user_id, 'gestor');
$$;
ALTER FUNCTION public.is_gestor(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.can_admin_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR (
      public.has_role(_user_id, 'gestor')
      AND EXISTS (
        SELECT 1
        FROM public.base_assignments
        WHERE user_id = _user_id
          AND base_nombre = _base_nombre
      )
    );
$$;
ALTER FUNCTION public.can_admin_base(uuid, text) OWNER TO postgres;
