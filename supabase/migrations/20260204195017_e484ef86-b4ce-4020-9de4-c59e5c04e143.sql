-- Drop constraint instead of index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

-- Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id);

-- Asignar rol admin al primer usuario (javier.alonso@renfe.es)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.profiles
WHERE email = 'javier.alonso@renfe.es'
ON CONFLICT DO NOTHING;