
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(app_role, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_base(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_base(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_base(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(app_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_base(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_base(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_base(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_base(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gestor_can_manage_user(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1603(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_plan_1201(uuid, date) TO authenticated, service_role;
