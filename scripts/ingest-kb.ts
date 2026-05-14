// scripts/ingest-kb.ts
// 실행: npx ts-node scripts/ingest-kb.ts

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { glob } from "glob";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ─── 기존 MTL Link 패턴 그대로 ───────────────────────────
const SUPABASE_URL = 'https://zidkckbabtajpgkhxmfm.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_KEY   = process.env.OPENAI_API_KEY!

if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local을 확인하세요.")
if (!OPENAI_KEY)  throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.")

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const openai   = new OpenAI({ apiKey: OPENAI_KEY })

// ─── knowledge-base 폴더 경로 ────────────────────────────
const KB_ROOT = path.join(process.cwd(), "supabase/knowledge-base");

// ─── 텍스트 청크 분할 ─────────────────────────────────────
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
  return chunks.filter((c) => c.length > 50);
}

// ─── 임베딩 생성 ──────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

// ─── 메인 ─────────────────────────────────────────────────
async function ingest() {
  const files = await glob("**/*.md", {
    cwd: KB_ROOT,
    ignore: ["**/_GUIDE.md"],
  });

  console.log(`총 ${files.length}개 파일 발견`);
  let inserted = 0;

  for (const relPath of files) {
    const absPath = path.join(KB_ROOT, relPath);
    const raw     = fs.readFileSync(absPath, "utf-8");
    const { data: meta, content } = matter(raw);

    if (!content.trim() || content.trim().length < 100) continue;

    const chunks = chunkText(content);
    console.log(`  ${relPath} -> ${chunks.length}개 청크`);

    for (let i = 0; i < chunks.length; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const embedding = await embed(chunks[i]);

      const { error } = await supabase.from("knowledge_base").upsert({
        filename:     relPath,
        chunk_index:  i,
        content:      chunks[i],
        embedding,
        doc_type:     meta.doc_type    || null,
        domain:       meta.domain      || "operations",
        issue_type:   meta.issue_type  || null,
        region:       meta.region      || null,
        mode:         meta.mode        || null,
        risk_level:   meta.risk_level  || null,
        cargo_type:   meta.cargo_type  || null,
        last_updated: meta.last_updated || null,
      }, { onConflict: "filename,chunk_index" });

      if (error) console.error(`    ERROR ${relPath} chunk ${i}:`, error.message);
      else inserted++;
    }
  }

  console.log(`\n완료: ${inserted}개 청크 저장`);
}

ingest().catch(console.error);