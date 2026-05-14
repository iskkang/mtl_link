// scripts/ingest-kb.ts
// 실행: npx ts-node scripts/ingest-kb.ts
//
// 필요 패키지:
// npm install @supabase/supabase-js openai gray-matter glob dotenv

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { glob } from "glob";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ─── 환경변수 ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// ─── knowledge-base 폴더 경로 ────────────────────────────
// zip을 푼 위치에 맞게 수정
const KB_ROOT = path.join(process.cwd(), "supabase/knowledge-base");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ─── 텍스트 청크 분할 (약 500 토큰 단위) ─────────────────
function chunkText(text: string, maxChars = 1500): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 50); // 너무 짧은 청크 제외
}

// ─── 임베딩 생성 ──────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

// ─── 메인 인제스트 ────────────────────────────────────────
async function ingest() {
  // 모든 .md 파일 재귀 탐색
  const files = await glob("**/*.md", {
    cwd: KB_ROOT,
    ignore: ["**/_GUIDE.md"], // 가이드 파일 제외
  });

  console.log(`📂 총 ${files.length}개 파일 발견`);
  let inserted = 0;
  let skipped = 0;

  for (const relPath of files) {
    const absPath = path.join(KB_ROOT, relPath);
    const raw = fs.readFileSync(absPath, "utf-8");

    // frontmatter 파싱
    const { data: meta, content } = matter(raw);

    // _GUIDE나 내용 없는 파일 스킵
    if (!content.trim() || content.trim().length < 100) {
      skipped++;
      continue;
    }

    const chunks = chunkText(content);
    console.log(`  📄 ${relPath} → ${chunks.length}개 청크`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 임베딩 생성 (rate limit 방지용 딜레이)
      await new Promise((r) => setTimeout(r, 200));
      const embedding = await embed(chunk);

      // Supabase 저장
      const { error } = await supabase.from("knowledge_base").upsert(
        {
          filename: relPath,
          chunk_index: i,
          content: chunk,
          embedding,
          // frontmatter 메타데이터
          doc_type: meta.doc_type || null,
          domain: meta.domain || "operations",
          issue_type: meta.issue_type || null,
          region: meta.region || null,
          mode: meta.mode || null,
          risk_level: meta.risk_level || null,
          cargo_type: meta.cargo_type || null,
          last_updated: meta.last_updated || null,
        },
        {
          onConflict: "filename,chunk_index", // 중복 실행 시 업데이트
        }
      );

      if (error) {
        console.error(`    ❌ 오류: ${relPath} chunk ${i}`, error.message);
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n✅ 완료: ${inserted}개 청크 저장, ${skipped}개 파일 스킵`);
}

ingest().catch(console.error);
