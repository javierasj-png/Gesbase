INSERT INTO public.profiles (user_id, email, status)
SELECT u.id, u.email, 'pending'
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);