# AI-TA UI (Next.js)

## Setup
1. `npm i`
2. Create `.env.local` with the required runtime configuration:
```
AI_TA_API_BASE_URL="http://localhost:8000"
NEXT_PUBLIC_SUPABASE_URL="https://kkszhdlglyqbjwqzvkbw.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...V0wnKi39FblzTv3QiUgO0jAI3bSZb4CbfqzkvEscYfE"
# Optional: enable citation hover previews (labels + details)
NEXT_PUBLIC_SHOW_CITATION_PREVIEWS="1"
```
   - Use your own Supabase project URL and anon key when deploying.
   - These `NEXT_PUBLIC_*` values must be available during build and runtime.
3. `npm run dev` and open http://localhost:3001

## How it works
- `app/api/ask/route.ts` proxies `POST /api/ask` → `$AI_TA_API_BASE_URL/ask` and streams responses.
- `app/page.tsx` provides a chat UI with drag-drop, paste-to-attach, previews, and streaming answers. It fetches textbooks from Supabase, enforces textbook selection, and records each question/answer (with citations/results metadata) to Supabase via the REST API.
- Images are sent inline as base64 data URLs. Update backend to decode and process.

### Citation Previews
- When `NEXT_PUBLIC_SHOW_CITATION_PREVIEWS=1`, the assistant message renders hoverable citation chips beneath the answer.
- Hover shows: document type (Textbook/Slides/etc.), file, page, OCR confidence (if available), and an optional thumbnail if the API includes one.
- Safe no-op when the flag is omitted.

## Extend
- If backend needs extra fields (e.g., `course_id`, `doc_sets`), add to the `fetch('/api/ask')` body.
- For file uploads to object storage, add `app/api/upload/route.ts` and send returned URLs instead of base64.

## Supabase schema & policies

SQL to create the `textbooks`, `questions`, and `answers` tables (plus Row Level Security policies) lives in `supabase/schema.sql`. Run it inside your Supabase SQL editor or CLI once per project. Seed at least one textbook row so the UI dropdown is populated.
