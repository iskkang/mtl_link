create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null unique,
  name                 text not null,
  department           text,
  position             text,
  avatar_url           text,
  status               text not null default 'active'
                         check (status in ('active', 'inactive')),
  is_admin             boolean not null default false,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.profiles.is_admin             is '관리자 여부. 직원 추가·비활성화 권한';
comment on column public.profiles.must_change_password is '첫 로그인 시 비밀번호 변경 필요 여부';
