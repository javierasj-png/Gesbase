-- Recreate permission helper functions robustly to avoid RLS recursion.
-- Use plpgsql and set_config('row_security','off', true) inside SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure RLS is not applied inside this permission check (prevents recursion)
  PERFORM set_config('row_security', 'off', true);

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;
ALTER FUNCTION public.has_role(uuid, public.app_role) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  RETURN public.has_role(_user_id, 'gestor');
END;
$$;
ALTER FUNCTION public.is_gestor(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.can_access_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  RETURN public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.base_assignments
      WHERE user_id = _user_id
        AND base_nombre = _base_nombre
    );
END;
$$;
ALTER FUNCTION public.can_access_base(uuid, text) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.can_admin_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  RETURN public.has_role(_user_id, 'admin')
    OR (
      public.has_role(_user_id, 'gestor')
      AND EXISTS (
        SELECT 1
        FROM public.base_assignments
        WHERE user_id = _user_id
          AND base_nombre = _base_nombre
      )
    );
END;
$$;
ALTER FUNCTION public.can_admin_base(uuid, text) OWNER TO postgres;
