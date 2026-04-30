-- 관리자가 다른 직원 프로필(status, is_admin, department, position)을 수정할 수 있게 허용
-- profiles_update_self 와 공존 — 자기 자신은 두 정책 모두 적용
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
