-- Fix permission helper functions to avoid RLS recursion and align with expected RPC signatures

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent infinite recursion when this function is used inside RLS policies
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

-- Overload to match the generated client types ordering (role, user_id)
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, _role);
$$;

ALTER FUNCTION public.has_role(public.app_role, uuid) OWNER TO postgres;

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

-- Overload to match generated client types ordering (base_nombre, user_id)
CREATE OR REPLACE FUNCTION public.can_access_base(_base_nombre text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_base(_user_id, _base_nombre);
$$;

ALTER FUNCTION public.can_access_base(text, uuid) OWNER TO postgres;

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

-- Overload to match generated client types ordering (base_nombre, user_id)
CREATE OR REPLACE FUNCTION public.can_admin_base(_base_nombre text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_admin_base(_user_id, _base_nombre);
$$;

ALTER FUNCTION public.can_admin_base(text, uuid) OWNER TO postgres;
