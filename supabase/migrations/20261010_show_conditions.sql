-- 공연 조건 기록 (2026-10-10 피벗)
-- 오리는 단체에 아마추어/프로 딱지를 붙이지 않고, 공연마다 조건을 기록한다.
-- 라이선스 필요 여부는 저작권법 제29조 기준(관객에게 대가를 받았는지, 출연자에게 보수를 줬는지)으로 갈린다.
-- 공연장 규모는 극장(venues.seat_count)에서 가져오므로 여기엔 두지 않는다.

alter table public.shows
  add column if not exists ticket_type text
    check (ticket_type in ('유료', '무료')),
  add column if not exists performers_paid boolean,
  add column if not exists performance_count integer
    check (performance_count is null or performance_count > 0),
  -- 기록의 신뢰도: 누가 확인했는가
  add column if not exists record_status text not null default '미확인'
    check (record_status in ('미확인', '단체 확인', '권리 확인'));

comment on column public.shows.ticket_type is '관객에게 받은 대가: 유료/무료 (null=모름)';
comment on column public.shows.performers_paid is '출연자에게 보수를 지급했는가 (null=모름)';
comment on column public.shows.performance_count is '공연 회차 수';
comment on column public.shows.record_status is '기록 신뢰도: 미확인 → 단체 확인 → 권리 확인';
comment on column public.shows.is_licensed is '라이선스 상태 (내부용, 개별 공개 금지): 창작/완료/미확보';
