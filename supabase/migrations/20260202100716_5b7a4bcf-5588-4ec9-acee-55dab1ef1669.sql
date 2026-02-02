-- 1. Crear trigger para auto-crear perfiles (si no existe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Crear el trigger en auth.users (debe crearse en el schema auth)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Crear perfiles faltantes para usuarios existentes
INSERT INTO public.profiles (user_id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Mejorar política SELECT de profiles para que admin pueda ver todos
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'gestor')
  );

-- 4. Permitir a admin/gestor hacer INSERT en profiles si necesario (para reparar)
DROP POLICY IF EXISTS "System creates profiles" ON public.profiles;
CREATE POLICY "Create profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
  );

-- 5. Mejorar policies de base_assignments para gestores
DROP POLICY IF EXISTS "Admins manage assignments" ON public.base_assignments;
CREATE POLICY "Admins and gestors manage assignments"
  ON public.base_assignments
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    OR (
      has_role(auth.uid(), 'gestor') 
      AND EXISTS (
        SELECT 1 FROM public.base_assignments ba 
        WHERE ba.user_id = auth.uid() 
        AND ba.base_nombre = base_assignments.base_nombre
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
  );

-- 6. Asegurar que user_roles permite ver roles a gestores también
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
CREATE POLICY "Users view roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'gestor')
  );