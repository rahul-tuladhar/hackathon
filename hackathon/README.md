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
  page.tsx                 redirects to the source resume editor
  resume/page.tsx          editable source resume and PDF preview
  workspace/page.tsx       job tabs · document · pipeline overlay
  FinalOutput.tsx          generate, score, edit, preview and export each job's resume
  api/jev/route.ts         JevRouter plan (HTTP → CLI → policy fallback)
  api/generate/route.ts    tailored CV (LLM, deterministic mock fallback)
  api/assess/route.ts      quality assessment (LLM, deterministic mock fallback)
  api/research/route.ts    Exa if keyed, else LLM knowledge brief, else stub
  api/parse-resume/route.ts upload a resume (PDF via unpdf, DOCX via mammoth)
  api/health/route.ts      provider detection for the badges
components/
  AccountMenu.tsx          profile, appearance, and help settings
  AppSettingsDialog.tsx    app-wide settings dialog
  JobTabs.tsx              one tab per target job, sourced from app/jobs.ts
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
  store.ts                 Zustand workspaces persisted in browser storage
```

## UI

- **Resume editor** at `/resume`: edit the source experience and preview its PDF.
- **Document workspace** at `/workspace`: job tabs, the Big CV source, pipeline,
  tailored CV, quality assessment, and agent trace.
- **Jobs page** at `/jobs`: browse roles, rank resume bullets with Jev, and
  generate a tailored resume above the people to reach out to.
- **Pipeline**: an embedded node graph. **Expand** opens a full-screen canvas
  with a right-hand **Tour** stepper; click any node (or step) to see its detail.
- **Per-job output**: generate and edit the tailored resume on the Jobs page and
  download its PDF. The resume section appears above people to reach out to.
- **Account settings**: edit your local profile, appearance, and help preferences
  from the account menu in the top navigation.
- **Agent trace**: a collapsed section at the bottom.

**No database.** Resume content, workspaces, and profile preferences persist in
this browser using local storage.

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

Open http://localhost:3000/jobs to browse roles. `/resume` edits the source
resume; `/workspace` opens the document-style pipeline view. The root route opens
`/resume`.

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

1. Open http://localhost:3000/workspace.
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

Each Conductor workspace needs its own ignored `hackathon/.env.local`. Start from
`.env.local.example` and add credentials for that workspace only. Git carries the
placeholders and setup instructions, never the actual keys.

- `NEON_AI_GATEWAY_BASE_URL` and `NEON_AI_GATEWAY_TOKEN` configure the hosted LLM
  for resume generation, assessment, summaries, and research briefs. `NEON_MODEL`
  (or legacy `NEON_AI_GATEWAY_MODEL`) optionally selects the Neon model.
- `AI_GATEWAY_API_KEY` configures the optional Vercel AI Gateway fallback for LLM
  tasks. `VERCEL_AI_GATEWAY_API_KEY` and legacy `VERCEL_AI_GATEWAY` are accepted.
- `EXA_API_KEY` enables live job and people research. `EXA_AGENT_MAX_COST` sets
  the optional per-run spend ceiling. Research is context, not resume evidence.
- `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` save outreach drafts to the chosen
  inbox. The app does not send email. Create a key scoped to the hackathon inbox
  with send/read mail access; the key is optional until one is available.
  `OUTREACH_TEST_RECIPIENT`, `OUTREACH_LIVE_RECIPIENTS`, and
  `OUTREACH_SENDER_NAME` control test recipients and signatures.
- `VERCEL_AI_GATEWAY`, `JEV_HTTP_URL`, `JEV_PROVIDER`, and `OPENROUTER_API_KEY`
  optionally configure hosted/live JevRouter decision routing. Without these,
  JevRouter uses its offline demo provider.
- `LLM_LOCAL=0` disables local LM Studio auto-detection when validating hosted
  model output. Without hosted credentials, the app may use local LM Studio and
  ultimately falls back to deterministic mock generation.

After editing `.env.local`, restart `npm run dev`. Check `/api/health` to see the
resolved LLM provider and model without exposing credentials.

## What is real vs. stubbed

- **Real:** JevRouter planning, hosted or local LLM generation and assessment when
  configured, Big CV parsing, keyword coverage, resume editing, and the UI.
- **Stubbed / pluggable:** `email_send` is modelled as a gated capability but no
  mail is sent; `cover_letter` is produced inside the generation step rather than
  as its own routed capability; Exa research falls back to the model's knowledge
  when no key is present.
