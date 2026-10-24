-- 이야기·게시판 (2026-10-24): 작품·배역 페이지의 "이야기" 탭 + 게시판(#board)
-- 건설적인 대화를 위해: 글은 종류를 골라 쓴다(해석·연기 팁·연출 아이디어·제작 팁·질문 / 게시판: 자유·질문·정보),
-- 반응은 "도움됐어요"만(싫어요 없음), 신고 → 운영자가 숨김. 숨긴 글은 쓴 사람·운영자만 본다.
-- 읽기는 진짜 로그인한 사람만(is_real_user). 이름은 서버가 user_profiles.nickname에서 붙인다(직접 적을 수 없음).
create table if not exists public.talk_posts (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('work','role','board')),
  target_id uuid,
  kind text not null check (kind in ('해석','연기','연출','제작','질문','자유','정보')),
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(body) between 2 and 4000),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_hidden boolean not null default false,
  check ((target_type = 'board') = (target_id is null))
);
create index if not exists talk_posts_target on public.talk_posts (target_type, target_id, created_at desc);
create table if not exists public.talk_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.talk_posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_hidden boolean not null default false
);
create index if not exists talk_replies_post on public.talk_replies (post_id, created_at);
create table if not exists public.talk_helpful (
  item_type text not null check (item_type in ('post','reply')),
  item_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_type, item_id, user_id)
);
create table if not exists public.talk_reports (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('post','reply')),
  item_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (item_type, item_id, user_id)
);

alter table public.talk_posts enable row level security;
alter table public.talk_replies enable row level security;
alter table public.talk_helpful enable row level security;
alter table public.talk_reports enable row level security;

create policy talk_posts_select on public.talk_posts for select to authenticated
  using (public.is_real_user() and (not is_hidden or user_id = auth.uid() or public.is_admin()));
create policy talk_posts_insert on public.talk_posts for insert to authenticated
  with check (user_id = auth.uid() and public.is_real_user() and not is_hidden);
create policy talk_posts_update on public.talk_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy talk_posts_delete on public.talk_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy talk_replies_select on public.talk_replies for select to authenticated
  using (public.is_real_user() and (not is_hidden or user_id = auth.uid() or public.is_admin()));
create policy talk_replies_insert on public.talk_replies for insert to authenticated
  with check (user_id = auth.uid() and public.is_real_user() and not is_hidden);
create policy talk_replies_update on public.talk_replies for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy talk_replies_delete on public.talk_replies for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy talk_helpful_own on public.talk_helpful for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_real_user());
create policy talk_reports_insert on public.talk_reports for insert to authenticated
  with check (user_id = auth.uid() and public.is_real_user());
create policy talk_reports_admin on public.talk_reports for select to authenticated using (public.is_admin());

-- 고칠 수 있는 칸만: 숨김(is_hidden)은 운영자가 talk_hide로만
revoke all on public.talk_posts, public.talk_replies, public.talk_helpful, public.talk_reports from anon;
revoke update on public.talk_posts, public.talk_replies from authenticated;
grant select, insert, delete on public.talk_posts, public.talk_replies to authenticated;
grant update (kind, title, body, edited_at) on public.talk_posts to authenticated;
grant update (body, edited_at) on public.talk_replies to authenticated;
grant select, insert, delete on public.talk_helpful to authenticated;
grant select, insert on public.talk_reports to authenticated;

-- 목록: 글 + 이름 + 도움됐어요 수 + 내가 눌렀는지 + 답글 수 (+ 운영자에게만 신고 수)
-- p_target_type='feed'면 게시판 전체 피드(게시판 글 + 작품·배역 이야기 최신순)
create or replace function public.talk_list(p_target_type text, p_target_id uuid default null)
returns table (id uuid, target_type text, target_id uuid, kind text, title text, body text, author text, mine boolean,
               created_at timestamptz, edited_at timestamptz, helpful int, my_helpful boolean, replies int, reports int, is_hidden boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.target_type, p.target_id, p.kind, p.title, p.body,
         coalesce(nullif(up.nickname, ''), '오리 사용자'), p.user_id = auth.uid(), p.created_at, p.edited_at,
         (select count(*)::int from talk_helpful h where h.item_type = 'post' and h.item_id = p.id),
         exists (select 1 from talk_helpful h where h.item_type = 'post' and h.item_id = p.id and h.user_id = auth.uid()),
         (select count(*)::int from talk_replies r where r.post_id = p.id and (not r.is_hidden or r.user_id = auth.uid() or is_admin())),
         case when is_admin() then (select count(*)::int from talk_reports x where x.item_type = 'post' and x.item_id = p.id) else 0 end,
         p.is_hidden
  from talk_posts p left join user_profiles up on up.id = p.user_id
  where is_real_user()
    and (not p.is_hidden or p.user_id = auth.uid() or is_admin())
    and (case when p_target_type = 'feed' then true
              when p_target_type = 'board' then p.target_type = 'board'
              else p.target_type = p_target_type and p.target_id = p_target_id end)
  order by p.created_at desc
  limit 300
$$;
create or replace function public.talk_replies_list(p_post_id uuid)
returns table (id uuid, body text, author text, mine boolean, created_at timestamptz, helpful int, my_helpful boolean, reports int, is_hidden boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.body, coalesce(nullif(up.nickname, ''), '오리 사용자'), r.user_id = auth.uid(), r.created_at,
         (select count(*)::int from talk_helpful h where h.item_type = 'reply' and h.item_id = r.id),
         exists (select 1 from talk_helpful h where h.item_type = 'reply' and h.item_id = r.id and h.user_id = auth.uid()),
         case when is_admin() then (select count(*)::int from talk_reports x where x.item_type = 'reply' and x.item_id = r.id) else 0 end,
         r.is_hidden
  from talk_replies r left join user_profiles up on up.id = r.user_id
  where is_real_user() and r.post_id = p_post_id and (not r.is_hidden or r.user_id = auth.uid() or is_admin())
  order by r.created_at
$$;
-- 운영자 숨기기·되살리기
create or replace function public.talk_hide(p_item_type text, p_item_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '운영자만 숨길 수 있어요'; end if;
  if p_item_type = 'post' then update talk_posts set is_hidden = p_hidden where id = p_item_id;
  elsif p_item_type = 'reply' then update talk_replies set is_hidden = p_hidden where id = p_item_id;
  else raise exception '알 수 없는 종류'; end if;
end $$;
revoke execute on function public.talk_list(text, uuid), public.talk_replies_list(uuid), public.talk_hide(text, uuid, boolean) from anon, public;
grant execute on function public.talk_list(text, uuid), public.talk_replies_list(uuid), public.talk_hide(text, uuid, boolean) to authenticated;
