-- Recrear tabla profiles con user_id
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  nombre text,
  apellidos text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger para crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre, apellidos)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellidos'
  )
  ON CONFLICT (user_id) DO UPDATE SET 
    email = EXCLUDED.email,
    nombre = COALESCE(EXCLUDED.nombre, profiles.nombre),
    apellidos = COALESCE(EXCLUDED.apellidos, profiles.apellidos);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Poblar desde auth.users
INSERT INTO public.profiles (user_id, email, nombre, apellidos)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nombre', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'apellidos'
FROM auth.users au
ON CONFLICT (user_id) DO NOTHING;

-- Recrear funciones de permisos limpias
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
      WHERE user_id = _user_id AND base_nombre = _base_nombre
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
        WHERE user_id = _user_id AND base_nombre = _base_nombre
      )
    );
END;
$$;
ALTER FUNCTION public.can_admin_base(uuid, text) OWNER TO postgres;

-- Políticas RLS para profiles
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

-- Limpiar políticas anteriores de user_roles y base_assignments
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "base_assignments_select" ON public.base_assignments;
DROP POLICY IF EXISTS "base_assignments_admin_manage" ON public.base_assignments;
DROP POLICY IF EXISTS "base_assignments_gestor_manage" ON public.base_assignments;

-- Políticas RLS para user_roles
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

-- Políticas RLS para base_assignments
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

-- Limpiar datos y asignar admin
DELETE FROM public.base_assignments;
DELETE FROM public.user_roles;

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.profiles
WHERE email = 'javier.alonso@renfe.es';