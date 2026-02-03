-- 1) Fix RLS recursion: make permission helpers plpgsql + disable row_security inside

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Keep existing signature can_access_base(uuid, text) but interpret 2nd arg as base_nombre
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


-- 2) Robust profiles: ensure profiles.user_id exists and is populated so the app can find new users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Backfill user_id from existing id when possible
UPDATE public.profiles
SET user_id = COALESCE(user_id, id::uuid)
WHERE user_id IS NULL;

-- Enforce uniqueness (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_user_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Ensure trigger function matches schema (insert using user_id)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Create trigger on auth.users if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill profiles for already-registered users
INSERT INTO public.profiles (user_id, email)
SELECT u.id, u.email
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
