**Live demo:** [hackathon-gold-rho-73.vercel.app](https://hackathon-gold-rho-73.vercel.app)

# Tailor — a personal CV + job + JEV agent

A personal agent that turns a **Big CV** (a messy dump of everything you have ever
done) plus a **target job** and an **intent** into a tailored, evidence-grounded CV
and an honest quality assessment.

This is the CV + Job + JEV slice of the **res-you-may-agents** team's build for the
[Build Personal Agents hack](https://build-personal-agents.com) (Oct 4, 2026, SF).

## What it does

1. **Big CV in.** Paste your whole career dump. It is parsed into candidate
   evidence bullets you can toggle on and off.
2. **JEV routes the work.** [JevRouter](https://github.com/BillionsBobby/JevRouter)
   is given the capability set and asked which capability handles each step of the
   request. It returns ordered steps with Jev probabilities, confidence, router
   rank, risk level, confirmation gates, filters and provenance hashes.
3. **Capabilities execute in plan order.** `company_research` (optional) →
   `cv_generate` → `cv_assess`.
4. **Tailored CV out.** A headline, summary, ATS skills, rewritten bullets with
   `← evidenceId` traces back to the Big CV, and a cover note.
5. **Quality assessment.** Six dimensions scored 0–100, matched/missing keyword
   coverage, and concrete suggested edits.
6. **PDF export.** A polished, ATS-friendly one-page resume rendered with
   `@react-pdf/renderer` (name and contact pulled from the Big CV).

## Architecture

```
app/
  page.tsx                 document shell (header · job tabs · contents rail · document)
  api/jev/route.ts         JevRouter plan (HTTP → CLI → policy fallback)
  api/generate/route.ts    tailored CV (LLM, deterministic mock fallback)
  api/assess/route.ts      quality assessment (LLM, deterministic mock fallback)
  api/research/route.ts    Exa if keyed, else LLM knowledge brief, else stub
  api/parse-resume/route.ts upload a resume (PDF via unpdf, DOCX via mammoth)
  api/health/route.ts      provider detection for the badges
components/
  TopBar.tsx               brand, provider badges, resume actions
  JobTabs.tsx              one tab per target job, sourced from app/jobs.ts
  ContentsRail.tsx         section nav + resume source
  DocumentView.tsx         the markdown document: CV, job, pipeline, quality, trace
  FlowDiagram.tsx          the pipeline node graph (embedded + full)
  FlowOverlay.tsx          expanded canvas with the right-hand tour stepper
  ResumePdf.tsx            the PDF resume (@react-pdf/renderer)
  Markdown.tsx             react-markdown renderer
lib/
  jev.ts                   JevRouter client + decision normalisation
  capabilities.ts          the capability manifests handed to JevRouter
  pipeline.ts              flow nodes + live per-node state
  resume-profile.ts        name/contact extraction for the PDF header
  llm.ts                   OpenAI-compatible failover chain
  prompts.ts               generation + assessment prompts (strict JSON)
  mock.ts                  deterministic offline fallback
  store.ts                 Zustand workspaces, in-memory only
```

## UI

- **Job tabs** up top: one tab per target job, each keeping its own intent,
  JEV plan, tailored CV, assessment and trace. The Big CV is shared across tabs.
- **Contents rail** on the left: section nav with completion ticks, plus the
  resume source and Upload/Parse.
- **Document column**: the whole flow rendered as a markdown document with
  numbered sections (Big CV, Target job, Pipeline, Tailored CV, Quality, Agent
  trace).
- **Pipeline**: an embedded node graph. **Expand** opens a full-screen canvas
  with a right-hand **Tour** stepper; click any node (or step) to see its detail.
- **Agent trace**: a collapsed section at the bottom.

**No database.** All state lives in a Zustand store for the session, exactly as the
team scoped it: `big CV and intent can change`, nothing persisted.

## JEV integration in detail

`lib/capabilities.ts` defines five manifests (`cv_generate`, `cv_assess`,
`company_research`, `cover_letter`, `email_send`). The last two carry risk and a
confirmation gate, so JevRouter reasons about them differently.

`lib/jev.ts` runs the plan over three transports, in order:

| Transport | How | When |
|---|---|---|
| `http` | `POST /route` to a running `jevrouter serve` | `JEV_HTTP_URL` reachable |
| `cli` | `npx jevrouter plan --provider demo --stdin` | default, fully offline |
| `policy` | deterministic local fallback | CLI unavailable |

The router is **decision-only**: nothing executes implicitly. When Jev confidence
is below policy it returns `no_decision` and a `low_confidence` fallback, and the
UI labels the executed capabilities as *best-ranked safe picks* rather than
pretending it was a confident choice.

`npm run jev` starts the HTTP server on `:8787` for the fast path.

## LLM

`lib/llm.ts` is an OpenAI-compatible client with a failover chain. The first
configured and reachable provider wins, and it falls through on any error:

1. **Neon AI Gateway** via `NEON_AI_GATEWAY_BASE_URL` + `NEON_AI_GATEWAY_TOKEN`
   (base `${NEON_AI_GATEWAY_BASE_URL}/v1`, default model `gpt-5-mini`).
2. **Vercel AI Gateway** via `AI_GATEWAY_API_KEY`
   (base `https://ai-gateway.vercel.sh/v1`, default model `anthropic/claude-sonnet-5`).
3. **Any OpenAI-compatible endpoint** via `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`.
4. **Local LM Studio** at `http://127.0.0.1:1234/v1`, auto-detected, never required.
   Set `LLM_LOCAL=0` to disable.
5. **OpenCode Zen** via `OPENCODE_API_KEY`.
6. **Deterministic mock** so the demo never dead-ends.

A local model is a convenience, not a requirement. With a gateway key set, the
app runs with no local inference at all.

> Local auto-detection skips embedding models and any "abliterated" variant. Dense
> local models are slow, so a hosted gateway (Neon or Vercel) is recommended for
> a live demo.

## Run it

```bash
npm install

# LLM: point at a gateway (recommended). Copy and fill in Neon or Vercel keys.
cp .env.example .env.local

# Optional: a local model as a fallback with no keys at all.
# lms load qwen3-30b-a3b --gpu max --ttl 7200 -y

# optional: serve JevRouter for the fast HTTP route
npm run jev

npm run dev
```

Open http://localhost:3000. The app seeds itself with a sample Big CV and job on
first load.

- **Upload** (top of the Big CV panel) parses a resume file into bullets. PDF via
  `unpdf`, DOCX via `mammoth`, TXT/MD/RTF as text. You can also drag a file onto
  the textarea. Max 8 MB.
- **Sample CV** loads the fictional payments persona.
- **My resume** loads Rahul's real resume (`lib/rahul-resume.ts`, from
  `~/Documents/Personal Mac Documents/Rahul_Tuladhar_Resume.pdf`) as the Big CV.
- **From the job board** in the Target job panel pulls jobs from Mike's shared
  `app/jobs.ts`, so the CV agent and the `/jobs` board use one source of truth.

The stepper under the header tracks the workflow: **Add resume → Pick a job →
Set intent → Run agent → Review**.

> If port 3000 is taken (e.g. by another local service), run `PORT=3100 npm run dev`.

## End-to-end walkthrough

1. Open http://localhost:3000.
2. Click **Upload** in the Big CV panel and choose a resume file (or drag it onto
   the textarea), or click **My resume** for the bundled real example. Either way
   the bullets appear in the list (22 for the PDF, 25 for the bundled text).
3. Click **+ Job** and pick "Frontend Software Engineer, Codex App · OpenAI".
   A new tab opens for it.
4. Click **Run agent**.
5. Watch the **Pipeline** section: the node graph lights up as JevRouter plans and
   each capability runs. Click a node to see its detail, or **Expand** for the
   full canvas and the right-hand tour stepper.
6. Read the **Tailored CV** section (rendered markdown, each bullet traced to a
   Big CV id), then **Quality** for the score, keyword coverage and edits.
7. The **Agent trace** at the bottom is collapsed; open it for the raw event log.


## Environment

Create a workspace-local `hackathon/.env.local` from `.env.local.example` (or
`.env.example`) and add credentials there. `.env.local` is ignored by Git; share
the example files and setup steps with other workspaces, never credential
values. Each Conductor workspace needs its own `.env.local`.

- **Resume generation and quality assessment:** configure `NEON_AI_GATEWAY_TOKEN`
  and `NEON_AI_GATEWAY_BASE_URL` for the preferred hosted LLM, or configure the
  Vercel, OpenAI-compatible, or OpenCode provider described above. Local LM Studio
  is optional. `LLM_LOCAL=0` disables local-model discovery. If no hosted provider
  is configured, generation and assessment use a deterministic fallback.
- **Company research:** `EXA_API_KEY` enables live Exa search. Without it, the
  feature can use an LLM-generated knowledge brief when a hosted model is
  configured. Research is context only and is not resume evidence.
- **Jev live routing:** `VERCEL_AI_GATEWAY` enables the hosted Vercel-backed Jev
  decision model. `JEV_HTTP_URL` can point to a running JevRouter service;
  otherwise JevRouter uses its offline demo CLI/provider. `JEV_PROVIDER` and
  `OPENROUTER_API_KEY` configure the OpenRouter route when used.
- **Outreach drafts:** `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` enable draft
  creation in the configured AgentMail inbox. Drafts are not sent by the app.
  `OUTREACH_LIVE_RECIPIENTS` defaults to `false`; set `OUTREACH_TEST_RECIPIENT`
  for a test address and `OUTREACH_SENDER_NAME` for the signature.

After editing `.env.local`, restart `npm run dev`. `/api/health` reports which
LLM provider and model the workspace resolved without exposing credentials.

## What is real vs. stubbed

- **Real:** JevRouter decision/plan with its full contract; hosted gateway or
  local LLM generation and scoring; Big CV parsing; keyword coverage math; the
  whole UI.
- **Stubbed / pluggable:** `email_send` is modelled as a gated capability but no
  mail is sent; `cover_letter` is produced inside the generation step rather than
  as its own routed capability; Exa research falls back to the model's knowledge
  when no key is present.
