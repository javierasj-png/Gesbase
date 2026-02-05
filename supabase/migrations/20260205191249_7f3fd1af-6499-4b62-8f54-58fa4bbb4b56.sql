-- Recrear funciones sin SET LOCAL (que no es compatible con funciones STABLE)
-- Usamos un enfoque diferente: consulta directa sin row_security trick

-- Función has_role: verificar si usuario tiene un rol específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Función is_gestor
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'gestor');
$$;

-- Función can_access_base: admin ve todo, otros ven bases asignadas
CREATE OR REPLACE FUNCTION public.can_access_base(_user_id uuid, _base_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.base_assignments
      WHERE user_id = _user_id AND base_nombre = _base_nombre
    );
$$;

-- Función can_admin_base: admin o gestor con esa base asignada
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
    );
$$;

-- Sobrecargas con orden de parámetros invertido (por compatibilidad)
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION public.can_access_base(_base_nombre text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_base(_user_id, _base_nombre);
$$;

CREATE OR REPLACE FUNCTION public.can_admin_base(_base_nombre text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_admin_base(_user_id, _base_nombre);
$$;

-- Políticas RLS simplificadas para user_roles (sin recursión)
DROP POLICY IF EXISTS "admin_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_view_own_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;

-- Cualquier usuario autenticado puede ver sus propios roles
CREATE POLICY "user_view_own_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins pueden ver todos los roles (usando la función)
CREATE POLICY "admin_view_all_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins pueden insertar/actualizar/eliminar roles
CREATE POLICY "admin_insert_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para base_assignments
DROP POLICY IF EXISTS "admin_all_base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "user_view_own_bases" ON public.base_assignments;
DROP POLICY IF EXISTS "admin_manage_base_assignments" ON public.base_assignments;

CREATE POLICY "user_view_own_bases"
ON public.base_assignments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_view_all_bases"
ON public.base_assignments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_base_assignments"
ON public.base_assignments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_base_assignments"
ON public.base_assignments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_base_assignments"
ON public.base_assignments FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para profiles
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "user_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.profiles;

CREATE POLICY "user_view_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_view_all_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_update_own_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_manage_profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));