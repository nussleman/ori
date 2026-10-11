-- ⚠️ 아직 적용 안 됨 (2026-10-11): 함수 안에 delete(요청 지우기)가 있어 Supabase MCP가 승인을 기다리다 시간 초과.
-- 태준님이 승인 창에서 승인하거나, 대시보드 SQL Editor에서 그대로 실행하면 됨.
-- 이력 요청을 취소하면, 그 요청으로 새로 만든 공연이 빈 채로 남지 않게 숨긴다 (지우지 않고 숨김 — 되살릴 수 있게).
-- 조건: 내가 만든 공연(created_by)이고, 남은 이력·프로젝트가 없고, 아직 누구도 확인·분류하지 않음(미확인·라이선스 미상)
create or replace function public.cancel_my_participation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_show uuid;
begin
  select show_id into v_show from participation_history
  where id = p_id and requested_by = auth.uid() and confirm_status in ('확인 대기', '거절');
  if v_show is null then raise exception '지울 수 없는 이력이에요'; end if;
  delete from participation_history where id = p_id;
  update shows s set is_hidden = true
  where s.id = v_show and s.created_by = auth.uid()
    and s.record_status = '미확인' and s.is_licensed is null
    and not exists (select 1 from participation_history ph where ph.show_id = s.id)
    and not exists (select 1 from projects pr where pr.published_show_id = s.id);
end $$;
