-- 이력 요청을 취소하면 그 요청으로 새로 만든 빈 공연도 함께 정리 (2026-10-11)
-- 전엔 "내 이력 추가"에서 오리에 없는 공연을 적으면 공연이 새로 생기고, 요청을 취소해도 그 공연은 남았다
-- (사이트엔 안 나오지만 어드민 "라이선스 미상 공연"에 쌓임). 이제 공연을 누가 만들었는지 기록하고,
-- 만든 사람이 요청을 취소할 때 그 공연을 숨긴다 → 취소 함수는 승인 대기라 supabase/drafts/20261011_cancel_hides_request_show.sql (태준님 할 일)
-- 이 파일은 적용된 부분만: 공연을 만든 사람 기록 칸 + 이력 요청 함수가 그 칸을 채우기

alter table public.shows add column if not exists created_by uuid;
comment on column public.shows.created_by is '이 공연을 사이트에서 만든 사람 (내 이력 추가로 새로 만든 공연 정리용). 운영자·단체가 만든 공연은 비어 있음';

create or replace function public.request_my_participation(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_person uuid;
  v_show uuid := nullif(p->>'show_id', '')::uuid;
  v_work uuid;
  v_kind text := coalesce(nullif(p->>'kind', ''), '배우');
  v_label text := nullif(trim(p->>'label'), '');
  v_role uuid; v_staff uuid; v_part uuid; v_note text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요해요';
  end if;
  select person_id into v_person from user_profiles where id = v_uid;
  if v_person is null then raise exception '먼저 내 프로필(사람)을 연결해주세요'; end if;
  if v_kind not in ('배우', '스태프') then raise exception '배우인지 스태프인지 골라주세요'; end if;
  if (select count(*) from participation_history where requested_by = v_uid and confirm_status = '확인 대기') >= 30 then
    raise exception '확인을 기다리는 이력이 너무 많아요. 단체가 확인한 뒤 더 추가해주세요';
  end if;

  if v_show is null then
    if nullif(trim(p->>'show_title'), '') is null then raise exception '공연을 고르거나 공연명을 적어주세요'; end if;
    if nullif(p->>'show_date', '') is null then raise exception '새 공연은 첫 공연일을 적어주세요'; end if;
    select id into v_show from shows
      where title = trim(p->>'show_title') and show_date = (p->>'show_date')::date
        and troupe_id is not distinct from nullif(p->>'troupe_id', '')::uuid
      limit 1;
    if v_show is null then
      insert into shows (title, show_date, troupe_id, record_status, created_by)
      values (trim(p->>'show_title'), (p->>'show_date')::date, nullif(p->>'troupe_id', '')::uuid, '미확인', v_uid)
      returning id into v_show;
    end if;
  elsif not exists (select 1 from shows where id = v_show) then
    raise exception '공연을 찾을 수 없어요';
  end if;

  select work_id into v_work from shows where id = v_show;
  if v_label is not null then
    if v_kind = '배우' then
      select id into v_role from roles where work_id = v_work and name = v_label limit 1;
    else
      select id into v_staff from staff_roles where name = v_label limit 1;
    end if;
  end if;
  -- 목록에 없는 배역·역할 이름은 메모로 남겨 확인하는 사람이 보게 한다
  v_note := concat_ws(' · ',
    case when v_label is not null and v_role is null and v_staff is null then v_kind || ': ' || v_label end,
    nullif(trim(p->>'note'), ''));

  if exists (
    select 1 from participation_history ph
    left join participation_roles pr on pr.participation_id = ph.id
    left join participation_staff_roles ps on ps.participation_id = ph.id
    where ph.show_id = v_show and ph.person_id = v_person and ph.confirm_status <> '거절'
      and coalesce(ph.role_type, '') = case when v_kind = '배우' then '배우' else '스텝' end
      and coalesce(pr.role_id::text, '') = coalesce(v_role::text, '')
      and coalesce(ps.staff_role_id::text, '') = coalesce(v_staff::text, '')
  ) then raise exception '이미 같은 이력이 있어요'; end if;

  insert into participation_history (show_id, person_id, role_type, confirm_status, requested_by, request_note)
  values (v_show, v_person, case when v_kind = '배우' then '배우' else '스텝' end, '확인 대기', v_uid, nullif(v_note, ''))
  returning id into v_part;
  if v_role is not null then insert into participation_roles (participation_id, role_id) values (v_part, v_role); end if;
  if v_staff is not null then insert into participation_staff_roles (participation_id, staff_role_id) values (v_part, v_staff); end if;
  return v_part;
end $$;

