-- 만들기 첫 화면 카드에 D-day·극장을 보여주기 위해 날짜·극장명을 함께 돌려준다.
DROP FUNCTION IF EXISTS public.list_my_projects_detail();
CREATE FUNCTION public.list_my_projects_detail()
 RETURNS TABLE(id uuid, title text, status text, troupe_name text, work_name text, owner_email text, owner_nickname text, owner_person_id uuid, created_at timestamp with time zone, venue_name text, target_start_date date, target_end_date date)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.title, p.status, t.name, w.title, au.email, up.nickname, up.person_id, p.created_at,
         v.name, p.target_start_date, p.target_end_date
  FROM projects p
  JOIN project_members pm_owner ON pm_owner.project_id = p.id AND pm_owner.member_role = 'owner'
  JOIN auth.users au ON au.id = pm_owner.user_id
  LEFT JOIN user_profiles up ON up.id = pm_owner.user_id
  LEFT JOIN troupes t ON t.id = p.troupe_id
  LEFT JOIN works w ON w.id = p.work_id
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE is_project_participant(p.id)
  ORDER BY p.created_at DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.list_my_projects_detail() TO authenticated;
