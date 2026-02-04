-- ========================================
-- REINICIO LIMPIO: roles y asignaciones
-- ========================================

-- 1) Eliminar todas las políticas existentes de las tres tablas
DROP POLICY IF EXISTS "Admin full access to base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Gestor manage base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Users view own base_assignments" ON public.base_assignments;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view profiles" ON public.profiles;

-- 2) Borrar datos existentes
DELETE FROM public.base_assignments;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- 3) Recrear funciones de permisos limpias con PL/pgSQL + row_security off

-- has_role: comprueba si un usuario tiene un rol
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

-- is_gestor: shortcut para comprobar rol gestor
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

-- can_access_base: admin accede a todo; otros necesitan asignación
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
      WHERE user_id = _user_id AND base_nombre = _base_nombre
    );
END;
$$;
ALTER FUNCTION public.can_access_base(uuid, text) OWNER TO postgres;

-- can_admin_base: admin global o gestor con base asignada
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
        WHERE user_id = _user_id AND base_nombre = _base_nombre
      )
    );
END;
$$;
ALTER FUNCTION public.can_admin_base(uuid, text) OWNER TO postgres;

-- 4) Políticas RLS simples para profiles
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5) Políticas RLS simples para user_roles
CREATE POLICY "user_roles_select"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "user_roles_admin_manage"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) Políticas RLS simples para base_assignments
CREATE POLICY "base_assignments_select"
ON public.base_assignments FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
);

CREATE POLICY "base_assignments_admin_manage"
ON public.base_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Gestor puede gestionar asignaciones solo en sus propias bases
CREATE POLICY "base_assignments_gestor_manage"
ON public.base_assignments FOR ALL TO authenticated
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

-- 7) Repoblar profiles desde auth.users (todos los usuarios existentes)
INSERT INTO public.profiles (user_id, email, nombre, apellidos)
SELECT 
  id as user_id,
  email,
  COALESCE(raw_user_meta_data->>'nombre', split_part(email, '@', 1)) as nombre,
  raw_user_meta_data->>'apellidos' as apellidos
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 8) Asignar rol admin al primer usuario registrado (javier.alonso@renfe.es)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'javier.alonso@renfe.es'
ON CONFLICT DO NOTHING;