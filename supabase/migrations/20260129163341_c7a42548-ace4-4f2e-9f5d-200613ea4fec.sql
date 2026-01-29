
-- =============================================
-- MIGRACIÓN CONSOLIDADA: Sistema GesBase
-- =============================================

-- 1. ENUM PARA ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'mando');

-- 2. TABLA PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nombre TEXT,
  apellidos TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. TABLA USER_ROLES (separada de profiles por seguridad)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. FUNCIÓN has_role (SECURITY DEFINER para evitar recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. TABLA BASES_CONDUCCION
CREATE TABLE IF NOT EXISTS public.bases_conduccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  codigo TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bases_conduccion ENABLE ROW LEVEL SECURITY;

-- 6. TABLA BASE_ASSIGNMENTS (asignación de bases a mandos)
CREATE TABLE IF NOT EXISTS public.base_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  base_nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, base_nombre)
);

ALTER TABLE public.base_assignments ENABLE ROW LEVEL SECURITY;

-- 7. FUNCIÓN can_access_base
CREATE OR REPLACE FUNCTION public.can_access_base(_user_id UUID, _base_nombre TEXT)
RETURNS BOOLEAN
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
    )
$$;

-- 8. TABLA CERTIFICACIONES (catálogo)
CREATE TABLE IF NOT EXISTS public.certificaciones (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('vehiculo', 'linea')),
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certificaciones ENABLE ROW LEVEL SECURITY;

-- 9. TABLA BASE_CERTIFICACIONES (configuración por base)
CREATE TABLE IF NOT EXISTS public.base_certificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES public.bases_conduccion(id) ON DELETE CASCADE NOT NULL,
  certificacion_id TEXT NOT NULL,
  certificacion_nombre TEXT NOT NULL,
  certificacion_tipo TEXT NOT NULL CHECK (certificacion_tipo IN ('vehiculo', 'linea')),
  obligatoria BOOLEAN DEFAULT false,
  vigilar_vencimiento BOOLEAN DEFAULT false,
  periodo_inactividad_meses INTEGER DEFAULT 6,
  aviso_dias INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_id, certificacion_id)
);

ALTER TABLE public.base_certificaciones ENABLE ROW LEVEL SECURITY;

-- 10. TABLA MAQUINISTAS
CREATE TABLE IF NOT EXISTS public.maquinistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  base TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  fecha_ingreso DATE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.maquinistas ENABLE ROW LEVEL SECURITY;

-- 11. TABLA MAQUINISTA_CERTIFICACIONES
CREATE TABLE IF NOT EXISTS public.maquinista_certificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinista_id UUID REFERENCES public.maquinistas(id) ON DELETE CASCADE NOT NULL,
  certificacion_id TEXT NOT NULL,
  certificacion_nombre TEXT NOT NULL,
  certificacion_tipo TEXT NOT NULL CHECK (certificacion_tipo IN ('vehiculo', 'linea')),
  obtenida BOOLEAN DEFAULT false,
  fecha_obtencion DATE,
  fecha_ultimo_servicio DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(maquinista_id, certificacion_id)
);

ALTER TABLE public.maquinista_certificaciones ENABLE ROW LEVEL SECURITY;

-- 12. TABLA EXPEDIENTES_1603 (PE 16.03)
CREATE TABLE IF NOT EXISTS public.expedientes_1603 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinista_id UUID REFERENCES public.maquinistas(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nuevo_acceso', 'reincorporacion')),
  fecha_inicio DATE NOT NULL,
  fecha_primer_servicio DATE,
  estado TEXT DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  observaciones TEXT,
  cierre_manual BOOLEAN DEFAULT false,
  fecha_cierre TIMESTAMPTZ,
  cerrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expedientes_1603 ENABLE ROW LEVEL SECURITY;

-- 13. TABLA ACTUACIONES_1603
CREATE TABLE IF NOT EXISTS public.actuaciones_1603 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes_1603(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('acompanamiento', 'registro', 'alcohol', 'drogas')),
  fecha_programada DATE,
  fecha_real DATE,
  resultado TEXT CHECK (resultado IN ('positivo', 'negativo', 'no_realizado', null)),
  indice_prever NUMERIC(3,2),
  observaciones TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.actuaciones_1603 ENABLE ROW LEVEL SECURITY;

-- 14. TABLA PLAN_1603 (planificación de actuaciones)
CREATE TABLE IF NOT EXISTS public.plan_1603 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes_1603(id) ON DELETE CASCADE NOT NULL,
  actuacion_id UUID REFERENCES public.actuaciones_1603(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('acompanamiento', 'registro', 'alcohol', 'drogas')),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 36),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'programado', 'realizado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plan_1603 ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS
-- =============================================

-- Profiles: usuarios ven su propio perfil, admins ven todos
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System creates profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User Roles: solo admins gestionan roles
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Base Assignments: admins gestionan, usuarios ven las suyas
CREATE POLICY "Admins manage assignments" ON public.base_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own assignments" ON public.base_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Bases Conducción: todos autenticados pueden leer
CREATE POLICY "Authenticated read bases" ON public.bases_conduccion
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage bases" ON public.bases_conduccion
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Certificaciones: lectura pública, gestión admin
CREATE POLICY "Read certificaciones" ON public.certificaciones
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage certificaciones" ON public.certificaciones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Base Certificaciones: lectura autenticada, gestión admin
CREATE POLICY "Read base_certificaciones" ON public.base_certificaciones
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage base_certificaciones" ON public.base_certificaciones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Maquinistas: acceso según base asignada
CREATE POLICY "Access maquinistas by base" ON public.maquinistas
  FOR SELECT TO authenticated
  USING (public.can_access_base(auth.uid(), base));

CREATE POLICY "Manage maquinistas by base" ON public.maquinistas
  FOR ALL TO authenticated
  USING (public.can_access_base(auth.uid(), base));

-- Maquinista Certificaciones: según acceso al maquinista
CREATE POLICY "Access maq_certs" ON public.maquinista_certificaciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m 
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage maq_certs" ON public.maquinista_certificaciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m 
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- Expedientes 1603: según acceso al maquinista
CREATE POLICY "Access expedientes_1603" ON public.expedientes_1603
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m 
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage expedientes_1603" ON public.expedientes_1603
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maquinistas m 
      WHERE m.id = maquinista_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- Actuaciones 1603
CREATE POLICY "Access actuaciones_1603" ON public.actuaciones_1603
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage actuaciones_1603" ON public.actuaciones_1603
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- Plan 1603
CREATE POLICY "Access plan_1603" ON public.plan_1603
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

CREATE POLICY "Manage plan_1603" ON public.plan_1603
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expedientes_1603 e
      JOIN public.maquinistas m ON m.id = e.maquinista_id
      WHERE e.id = expediente_id 
      AND public.can_access_base(auth.uid(), m.base)
    )
  );

-- =============================================
-- TRIGGER: Crear perfil automáticamente al registrarse
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TRIGGER: Actualizar updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_bases_updated_at BEFORE UPDATE ON public.bases_conduccion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_maquinistas_updated_at BEFORE UPDATE ON public.maquinistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_expedientes_updated_at BEFORE UPDATE ON public.expedientes_1603
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_actuaciones_updated_at BEFORE UPDATE ON public.actuaciones_1603
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
