# Knowledge Q&A Pilot

AI-powered question answering web application (Next.js + PostgreSQL + Claude).

**Current status:** Phases 1–7 are implemented. The homepage uses the full Haiku → search → context → Sonnet pipeline via `POST /api/ask`.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- PostgreSQL via Drizzle ORM
- PDF text extraction via `pdf-parse`
- Anthropic Claude Haiku (query understanding) + Sonnet (answer generation)
- Target deploy: Railway

## Project structure

```
src/
  app/                      # App Router pages and API routes
  components/               # React UI components
  lib/
    db/                     # Drizzle client and knowledge-base schema
    env.ts                  # Environment variable helpers
  services/
    ai/                     # Claude Haiku + Sonnet
    search/                 # PostgreSQL full-text search (Phase 4)
    context/                # Context builder (Phase 5)
    ask/                    # End-to-end Q&A pipeline (Phase 7)
    ingestion/              # PDF parse → validate → import
  utils/                    # Shared helpers
scripts/
  ingest-pdf.ts             # CLI for PDF ingestion
drizzle/                    # SQL migrations
```

## Install dependencies

```bash
npm install
```

## Configure environment variables

1. Copy the example file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

2. Fill in values (no secrets are committed to the repo):

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
ANTHROPIC_API_KEY=
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6
```

- `DATABASE_URL` — required for migrations and non-dry-run ingestion
- `ANTHROPIC_API_KEY` — server-side only (never `NEXT_PUBLIC_`); required for Haiku and Sonnet
- `ANTHROPIC_HAIKU_MODEL` — Haiku model ID (defaults to `claude-haiku-4-5-20251001` if unset)
- `ANTHROPIC_SONNET_MODEL` — Sonnet model ID (defaults to `claude-sonnet-4-6` if unset)

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database migration

Generate migrations (already committed for Phase 2):

```bash
npm run db:generate
```

Apply migrations to PostgreSQL:

```bash
npm run db:migrate
```

Requires `DATABASE_URL` in `.env.local`.

### Knowledge-base schema (`knowledge_entries`)

| Column | Purpose |
| --- | --- |
| `id` | UUID primary key |
| `question` | FAQ question text |
| `answer` | FAQ answer text (source wording preserved) |
| `category` | Section heading when present (e.g. `IV. SOIL AND NUTRITION`) |
| `source_document` | Source PDF filename |
| `source_page` | PDF page where the question starts |
| `searchable_content` | `question + answer` for future text search |
| `question_normalized` | Deduplication key |
| `created_at` / `updated_at` | Timestamps |

Indexes:

- unique on `question_normalized`
- btree on `source_document`
- GIN `to_tsvector('english', searchable_content)` used by Phase 4 full-text search

## PDF format discovered

Two PDFs ship with the repo:

1. **`FAQs-in-English-इंग्रजी-8-12.pdf`** (5 pages) — **knowledge source**
   - Machine-readable text (not scanned)
   - Informal Q&A: question line(s), then answer paragraph(s)
   - Most questions end with `?`; one prompt ends with `.` (`Tell me …`)
   - Compound questions may contain multiple `?` in one entry
   - Answers can continue across page boundaries
   - Layout noise: orphaned `Qn.` labels, bare page numbers, broken chemical subscripts
   - One section heading observed: `IV. SOIL AND NUTRITION`
   - No Q/A tables

2. **`Pilot project.pdf`** (1 page) — **project requirements**, not FAQ content
   - Ingestion correctly reports **0** Q&A pairs

## How PDF ingestion works

```
PDF
 → text extraction (pdf-parse, per page)
 → strip layout noise (Qn. labels, page numbers)
 → parse Q&A by question-start heuristics
 → normalize whitespace (no paraphrasing)
 → validate (non-empty question/answer + metadata)
 → deduplicate by normalized question
 → insert into PostgreSQL (unless --dry-run)
```

Parser code is DB-independent (`parsePdf` → records). Import is separate (`importKnowledgeRecords`).

## Run ingestion

Dry-run (no database writes) — recommended first:

```bash
npm run ingest:pdf -- --dry-run --all
```

Or a single file:

```bash
npm run ingest:pdf -- --dry-run "./FAQs-in-English-इंग्रजी-8-12.pdf"
```

Insert into PostgreSQL (after `db:migrate`):

```bash
npm run ingest:pdf -- --all
```

### Expected dry-run output (both PDFs)

```
Documents: 2
Pages processed: 6
Questions detected: 33
Valid records: 33
Invalid records: 0
Duplicates: 0
Records to insert: 33
```

`Pilot project.pdf` contributes a parser note that it is not a FAQ source.

## Claude Haiku query understanding (Phase 3)

Haiku is used **only** to turn a user question into structured search information:

```
User question → Claude Haiku → { intent, searchQuery }
```

It does **not** answer the user, build context, or call Sonnet. Phase 4 searches PostgreSQL using `searchQuery`.

### Local API endpoint

`POST /api/ai/query`

Example request:

```bash
curl -X POST http://localhost:3000/api/ai/query ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"How long do I have to return my product?\"}"
```

Example response:

```json
{
  "intent": "return_policy",
  "searchQuery": "product return period"
}
```

Note: exact `intent` / `searchQuery` values are generated by the model for each question (not a fixed taxonomy).

### Testing Haiku

Unit tests mock the Anthropic SDK (no API key required):

```bash
npm test
```

Optional live integration (requires a real key):

```bash
# PowerShell
$env:RUN_ANTHROPIC_INTEGRATION="1"
$env:ANTHROPIC_API_KEY="your-key"
npm test
```

## PostgreSQL search (Phase 4)

Takes a concise `searchQuery` (typically from Haiku) and runs PostgreSQL full-text search against `knowledge_entries.searchable_content` using the existing GIN index.

```
searchQuery → plainto_tsquery('english', …)
           → match to_tsvector('english', searchable_content)
           → rank with ts_rank
           → top N results
```

This phase does **not** call Haiku or Sonnet (Context Builder is Phase 5).

### Search API endpoint

`POST /api/search`

Example request:

```bash
curl -X POST http://localhost:3000/api/search ^
  -H "Content-Type: application/json" ^
  -d "{\"searchQuery\":\"pomegranate plantation spacing\",\"limit\":5}"
```

Example response:

```json
{
  "searchQuery": "pomegranate plantation spacing",
  "count": 1,
  "results": [
    {
      "id": "…",
      "question": "What is the recommended spacing for pomegranate plantation?",
      "answer": "Spacing of 4.5 m (15 ft.) X 3 m (10 ft.) …",
      "category": null,
      "sourceDocument": "FAQs-in-English-इंग्रजी-8-12.pdf",
      "sourcePage": 1,
      "rank": 0.12
    }
  ]
}
```

- `limit` is optional (default 5, max 25)
- Empty matches return `{ "count": 0, "results": [] }`
- Requires `DATABASE_URL` and ingested knowledge rows (`npm run db:migrate` + `npm run ingest:pdf`)

### Typical Phase 3 → Phase 4 → Phase 5 handoff

1. `POST /api/ai/query` with the user question → `{ intent, searchQuery }`
2. `POST /api/search` with that `searchQuery` → ranked FAQ hits
3. `POST /api/context/build` with those hits (+ optional intent/searchQuery) → bounded context

`/api/ask` now runs the full pipeline (Phase 7).

## End-to-end Q&A (`POST /api/ask`) — Phase 7

The homepage form posts to `/api/ask`, which calls services **directly** (no internal HTTP loops):

```
question
  → Haiku (intent + searchQuery)
  → PostgreSQL FTS
  → Context Builder
  → Sonnet
  → { answer, intent, searchQuery, sources, … }
```

Example request:

```bash
curl -X POST http://localhost:3000/api/ask ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"What is the recommended spacing for pomegranate plantation?\"}"
```

Example response:

```json
{
  "answer": "The recommended spacing is 4.5 m × 3 m…",
  "intent": "spacing_guidance",
  "searchQuery": "pomegranate plantation spacing",
  "resultCount": 1,
  "includedCount": 1,
  "sources": [
    {
      "id": "…",
      "question": "What is the recommended spacing…",
      "sourceDocument": "FAQs-in-English-इंग्रजी-8-12.pdf",
      "sourcePage": 1
    }
  ]
}
```

Requirements for a live answer:

1. `DATABASE_URL` set, migrations applied, FAQ PDF ingested
2. `ANTHROPIC_API_KEY` set (Haiku + Sonnet)

Independent stage endpoints (`/api/ai/query`, `/api/search`, `/api/context/build`, `/api/ai/answer`) remain available for debugging.

## Context builder (Phase 5)

Turns Phase 4 search hits into clean, token-bounded context for a future Sonnet call.

```
ranked KnowledgeSearchHit[]
        ↓
dedupe / drop empty / optional minRank filter
        ↓
fit maxItems + maxTokens budgets (highest rank first)
        ↓
contextText + excerpts metadata
```

Token estimates use a simple `ceil(chars / 4)` heuristic (no extra tokenizer dependency).

This phase does **not** call Haiku, PostgreSQL, or Sonnet.

### Context API endpoint

`POST /api/context/build`

Example request:

```bash
curl -X POST http://localhost:3000/api/context/build ^
  -H "Content-Type: application/json" ^
  -d "{\"intent\":\"spacing_guidance\",\"searchQuery\":\"pomegranate spacing\",\"results\":[{\"id\":\"…\",\"question\":\"What is the recommended spacing for pomegranate plantation?\",\"answer\":\"Spacing of 4.5 m …\",\"category\":null,\"sourceDocument\":\"FAQs.pdf\",\"sourcePage\":1,\"rank\":0.12}],\"maxTokens\":3000,\"maxItems\":5}"
```

Example response:

```json
{
  "intent": "spacing_guidance",
  "searchQuery": "pomegranate spacing",
  "contextText": "Knowledge base excerpts:\nIntent: spacing_guidance\nSearch query: pomegranate spacing\n\n[1] Question: …\nAnswer: …\nSource: FAQs.pdf | p.1",
  "excerpts": [
    {
      "id": "…",
      "question": "…",
      "answer": "…",
      "category": null,
      "sourceDocument": "FAQs.pdf",
      "sourcePage": 1,
      "rank": 0.12,
      "estimatedTokens": 42
    }
  ],
  "includedCount": 1,
  "omittedCount": 0,
  "estimatedTokens": 80,
  "maxTokens": 3000
}
```

Optional body fields: `maxTokens` (default 3000, max 8000), `maxItems` (default 5, max 10), `minRank` (default 0).

## Claude Sonnet answer generation (Phase 6)

Sonnet turns the user question + Phase 5 `contextText` into a natural-language answer grounded only in that context.

```
question + contextText (+ optional intent/searchQuery)
        ↓
Claude Sonnet
        ↓
{ answer }
```

This phase does **not** call Haiku, search PostgreSQL, or rebuild context. Phase 7 wires it into `/api/ask`.

### Answer API endpoint

`POST /api/ai/answer`

Example request:

```bash
curl -X POST http://localhost:3000/api/ai/answer ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"What is the recommended spacing for pomegranate plantation?\",\"contextText\":\"Knowledge base excerpts:\\n[1] Question: What is the recommended spacing...\\nAnswer: Spacing of 4.5 m...\",\"intent\":\"spacing_guidance\",\"searchQuery\":\"pomegranate spacing\"}"
```

Example response:

```json
{
  "answer": "The recommended spacing is 4.5 m (15 ft.) × 3 m (10 ft.), which accommodates about 296 plants per acre."
}
```

### Typical Phase 3 → 6 handoff (manual)

1. `POST /api/ai/query` → `{ intent, searchQuery }`
2. `POST /api/search` → ranked hits
3. `POST /api/context/build` → `{ contextText, … }`
4. `POST /api/ai/answer` with question + `contextText` → `{ answer }`

Or use the wired pipeline: `POST /api/ask` with `{ question }` (Phase 7).
## Tests

```bash
npm test
```

## Typecheck, lint, and build

```bash
npm run typecheck
npm run lint
npm run build
```

Production start (after build):

```bash
npm run start
```

## Assumptions and limitations

- Only FAQ-style PDFs matching the NRCP English FAQ layout are parsed into knowledge rows.
- `Pilot project.pdf` is intentionally not treated as knowledge content.
- Section headings appear late in extraction order due to PDF layout; early soil questions may have `category = null`.
- Chemical formulas may retain OCR artifacts (split subscripts such as `ZnSO` + `4`).
- One slurry answer is truncated in the source PDF text (`…As a result,`) — stored as extracted, not rewritten.
- Duplicate detection uses normalized question text globally (category is not part of the key; questions are unique in this FAQ).
- Original PDFs are never modified.
- Haiku intent labels are free-form descriptive strings, not a fixed enum.
- Search uses PostgreSQL FTS (`plainto_tsquery` + `ts_rank`), not embeddings/vector search.
- Context token counts are approximate (`chars / 4`), not model-exact.
- Live `/api/ask` answers require both PostgreSQL knowledge rows and a valid Anthropic API key.

## Deployment (Railway)

1. Create a Railway project and add a PostgreSQL service.
2. Set `DATABASE_URL`, `ANTHROPIC_API_KEY`, and optionally `ANTHROPIC_HAIKU_MODEL` / `ANTHROPIC_SONNET_MODEL` in Railway variables.
3. Run migrations (`npm run db:migrate`) against that database.
4. Run ingestion once (`npm run ingest:pdf -- --all`) from a machine with access to the PDFs and DB.
5. Deploy the Next.js app; start command `npm run start`.

## Phase status

**Phase 1 — done:** app shell, homepage, env, DB utility stub, `/api/ask` 501 placeholder.

**Phase 2 — done:** knowledge-base schema + migration, PDF ingestion pipeline, CLI, tests.

**Phase 3 — done:** Claude Haiku query understanding + `POST /api/ai/query`.

**Phase 4 — done:** PostgreSQL full-text search + `POST /api/search`.

**Phase 5 — done:** Context builder + `POST /api/context/build`.

**Phase 6 — done:** Claude Sonnet answer generation + `POST /api/ai/answer`.

**Phase 7 — done:** End-to-end `POST /api/ask` pipeline + homepage integration.

**Optional later work:**

- Streaming answers
- Auth / admin UI
- Additional FAQ PDFs / languages
