-- Corregir funciones de permisos para evitar recursión infinita

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
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
  SET LOCAL row_security = off;
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
  SET LOCAL row_security = off;
  RETURN public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.base_assignments
      WHERE user_id = _user_id AND (base = _base_nombre)
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
  SET LOCAL row_security = off;
  RETURN public.has_role(_user_id, 'admin')
    OR (
      public.has_role(_user_id, 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.base_assignments
        WHERE user_id = _user_id AND (base = _base_nombre)
      )
    );
END;
$$;
ALTER FUNCTION public.can_admin_base(uuid, text) OWNER TO postgres;

-- Limpiar políticas existentes de base_assignments
DROP POLICY IF EXISTS "Admins can view all base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can insert base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can update base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins can delete base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users can view their own base assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins and gestors manage assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users view own assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admin full access to base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Gestor manage base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users view own base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "base_assignments_select" ON public.base_assignments;
DROP POLICY IF EXISTS "base_assignments_admin_manage" ON public.base_assignments;
DROP POLICY IF EXISTS "base_assignments_gestor_manage" ON public.base_assignments;
DROP POLICY IF EXISTS "ba_select" ON public.base_assignments;
DROP POLICY IF EXISTS "ba_admin_all" ON public.base_assignments;

-- Crear políticas simples que no causan recursión
CREATE POLICY "ba_select"
ON public.base_assignments FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "ba_admin_all"
ON public.base_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Limpiar políticas de profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation on signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "prof_select" ON public.profiles;
DROP POLICY IF EXISTS "prof_insert" ON public.profiles;
DROP POLICY IF EXISTS "prof_update" ON public.profiles;

-- Crear políticas simples para profiles (id = user auth id)
CREATE POLICY "prof_select"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "prof_insert"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "prof_update"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Limpiar políticas de user_roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "ur_select" ON public.user_roles;
DROP POLICY IF EXISTS "ur_admin_all" ON public.user_roles;

-- Crear políticas simples para user_roles
CREATE POLICY "ur_select"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "ur_admin_all"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));