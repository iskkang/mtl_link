# MTL Link — Step 1 Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase DB 스키마(마이그레이션 18개) + Edge Functions 2개를 작성해 `supabase db push` 한 번으로 배포 가능한 상태로 만든다.

**Architecture:** 마이그레이션은 v2 기반(12개) → v2.1 음성번역 확장(6개) 순서로 실행된다. Edge Functions는 Deno 런타임에서 실행되며, API 키는 Supabase Secrets에만 보관한다.

**Tech Stack:** Supabase Postgres, Supabase Edge Functions (Deno), OpenAI Whisper API, Anthropic Claude Haiku API

---

## 파일 목록

```
supabase/
  migrations/
    20260430000000_extensions.sql
    20260430000001_profiles.sql
    20260430000002_rooms.sql
    20260430000003_room_members.sql
    20260430000004_messages.sql
    20260430000005_attachments.sql
    20260430000006_indexes.sql
    20260430000007_functions.sql
    20260430000008_triggers.sql
    20260430000009_rls_policies.sql
    20260430000010_storage_buckets.sql
    20260430000011_storage_policies.sql
    20260501100000_v2_1_profiles_language.sql
    20260501100001_v2_1_rooms_translation.sql
    20260501100002_v2_1_messages_translation.sql
    20260501100003_v2_1_translation_preferences.sql
    20260501100004_v2_1_get_target_language_fn.sql
    20260501100005_v2_1_translation_rls.sql
  functions/
    admin-create-user/index.ts
    voice-translate/index.ts
    voice-translate/providers/whisper.ts
    voice-translate/providers/claude.ts
  seed.sql
```

---

## 배포 명령어

```bash
# 1. Supabase CLI 설치 (이미 있으면 건너뜀)
npm install -g supabase

# 2. 프로젝트 루트에서 Supabase 초기화
supabase init

# 3. Supabase 로그인
supabase login

# 4. 호스팅 프로젝트와 연결
supabase link --project-ref <프로젝트-ref>

# 5. 마이그레이션 적용
supabase db push

# 6. Edge Function 시크릿 등록
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<값>
supabase secrets set OPENAI_API_KEY=<값>
supabase secrets set ANTHROPIC_API_KEY=<값>

# 7. Edge Functions 배포
supabase functions deploy admin-create-user
supabase functions deploy voice-translate

# 8. 첫 관리자 계정 설정 (Supabase 대시보드 SQL Editor 에서 실행)
-- UPDATE public.profiles SET is_admin = true WHERE email = 'admin@example.com';
```
