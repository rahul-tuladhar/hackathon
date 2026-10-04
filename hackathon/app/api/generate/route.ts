import { parsePartialJson } from "ai";
import { openChatCompletionStream, extractJson } from "@/lib/llm";
import { mockGenerate } from "@/lib/mock";
import { generatePrompt } from "@/lib/prompts";
import { completeResumeEvidence } from "@/lib/resume-selection";
import type { BigCVBullet, GeneratedCV, JobTarget } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  bullets?: BigCVBullet[];
  sourceSkills?: string[];
  job?: JobTarget;
  intent?: string;
  verbatimness?: number;
  plan?: string[];
  research?: string | null;
  relevanceById?: Record<string, number>;
};

function isUsableCV(cv: unknown): cv is GeneratedCV {
  if (!cv || typeof cv !== "object") return false;
  const candidate = cv as Partial<GeneratedCV>;
  return (
    typeof candidate.headline === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.bullets)
  );
}

function toPartialCV(value: unknown): GeneratedCV | null {
  if (!value || typeof value !== "object") return null;
  const fields = value as Record<string, unknown>;
  const bullets = Array.isArray(fields.bullets)
    ? fields.bullets.flatMap((entry, index) => {
        if (!entry || typeof entry !== "object") return [];
        const bullet = entry as Record<string, unknown>;
        return [{
          id: typeof bullet.id === "string" ? bullet.id : `stream-${index + 1}`,
          text: typeof bullet.text === "string" ? bullet.text : "",
          evidenceId: typeof bullet.evidenceId === "string" ? bullet.evidenceId : null,
          rationale: typeof bullet.rationale === "string" ? bullet.rationale : "",
          keywords: Array.isArray(bullet.keywords)
            ? bullet.keywords.filter((keyword): keyword is string => typeof keyword === "string")
            : [],
        }];
      })
    : [];

  return {
    headline: typeof fields.headline === "string" ? fields.headline : "",
    summary: typeof fields.summary === "string" ? fields.summary : "",
    skills: Array.isArray(fields.skills)
      ? fields.skills.filter((skill): skill is string => typeof skill === "string")
      : [],
    bullets,
    coverNote: typeof fields.coverNote === "string" ? fields.coverNote : "",
  };
}

function normalize(
  cv: GeneratedCV,
  sourceBullets: BigCVBullet[],
  verbatimness: number,
  sourceSkills: string[],
): GeneratedCV {
  const sourceById = new Map(sourceBullets.map((bullet) => [bullet.id, bullet.text.trim()]));
  const evidenceText = [
    ...sourceBullets.filter((bullet) => bullet.selected).map((bullet) => bullet.text),
    ...sourceSkills,
  ].join(" ").toLowerCase();
  const clampedVerbatimness = Math.max(0, Math.min(100, Math.round(verbatimness)));
  const normalizedBullets = (cv.bullets || []).slice(0, Math.max(12, sourceBullets.length)).map((bullet, index) => ({
    id: bullet.id || `g${index + 1}`,
    text: String(bullet.text || "").trim(),
    evidenceId: bullet.evidenceId ?? null,
    rationale: String(bullet.rationale || "").trim(),
    keywords: Array.isArray(bullet.keywords) ? bullet.keywords.slice(0, 8) : [],
  }));
  const eligible = normalizedBullets.filter(
    (bullet) => bullet.evidenceId && sourceById.has(bullet.evidenceId),
  );
  const verbatimCount = Math.round((eligible.length * clampedVerbatimness) / 100);
  eligible.slice(0, verbatimCount).forEach((bullet) => {
    bullet.text = sourceById.get(bullet.evidenceId!)!;
  });

  return {
    headline: cv.headline || "",
    summary: cv.summary || "",
    skills: Array.isArray(cv.skills)
      ? cv.skills
          .filter((skill) => typeof skill === "string" && evidenceText.includes(skill.toLowerCase().trim()))
          .slice(0, 16)
      : [],
    bullets: normalizedBullets,
    coverNote: cv.coverNote || "",
  };
}

function fallbackCV(
  source: BigCVBullet[],
  job: JobTarget,
  intent: string,
  verbatimness: number,
  sourceSkills: string[],
  relevanceById: Record<string, number>,
) {
  const completed = completeResumeEvidence(
    mockGenerate({ bullets: source, job, intent }),
    source,
    relevanceById,
  );
  return normalize(completed, source, verbatimness, sourceSkills);
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source = body.bullets || [];
  const sourceSkills = Array.isArray(body.sourceSkills) ? body.sourceSkills : [];
  const bullets = source.filter((bullet) => bullet.selected);
  const job = body.job || { title: "", company: "", url: "", description: "" };
  const intent = body.intent || "";
  const relevanceById = body.relevanceById ?? {};
  const verbatimness = Math.max(0, Math.min(100, Math.round(body.verbatimness ?? 0)));
  const encoder = new TextEncoder();
  const streamAbort = new AbortController();
  const signal = AbortSignal.any([request.signal, streamAbort.signal]);
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      void (async () => {
        let upstreamOpened = false;
        let latestDraft = "";
        const prompt = generatePrompt({
          bullets,
          sourceSkills,
          job,
          intent,
          verbatimness,
          plan: body.plan || ["cv_generate", "cv_assess"],
          research: body.research,
        });

        try {
          const upstream = await openChatCompletionStream(prompt.system, prompt.user, {
            maxTokens: 4000,
            signal,
          });
          upstreamOpened = true;

          let raw = "";
          let lastEmit = 0;
          for await (const chunk of upstream.chunks) {
            raw += chunk;
            const now = Date.now();
            if (now - lastEmit < 70) continue;
            lastEmit = now;

            const parsed = await parsePartialJson(raw);
            const partial = toPartialCV(parsed.value);
            if (!partial || (!partial.headline && !partial.summary && partial.bullets.length === 0)) continue;
            const cv = normalize(partial, source, verbatimness, sourceSkills);
            const serialized = JSON.stringify(cv);
            if (serialized === latestDraft) continue;
            latestDraft = serialized;
            send(controller, "draft", { cv, provider: upstream.provider, model: upstream.model });
          }

          const parsed = extractJson(raw);
          if (!isUsableCV(parsed)) throw new Error("model returned an unusable CV shape");
          const completed = completeResumeEvidence(
            normalize(parsed, source, verbatimness, sourceSkills),
            source,
            relevanceById,
          );
          const cv = normalize(completed, source, verbatimness, sourceSkills);
          send(controller, "complete", { cv, provider: upstream.provider, model: upstream.model });
        } catch (err) {
          if (signal.aborted) return;
          const warning = err instanceof Error ? err.message : String(err);
          send(controller, "warning", { message: warning });
          const cv = fallbackCV(source, job, intent, verbatimness, sourceSkills, relevanceById);

          const empty: GeneratedCV = { headline: "", summary: "", skills: [], bullets: [], coverNote: "" };
          const drafts: GeneratedCV[] = [
            { ...empty, headline: cv.headline },
            { ...empty, headline: cv.headline, summary: cv.summary },
            { ...empty, headline: cv.headline, summary: cv.summary, skills: cv.skills },
            { ...cv, bullets: cv.bullets.slice(0, Math.max(1, Math.floor(cv.bullets.length / 2))) },
            cv,
          ];
          for (const draft of drafts) {
            const normalized = normalize(draft, source, verbatimness, sourceSkills);
            const serialized = JSON.stringify(normalized);
            if (serialized === latestDraft) continue;
            latestDraft = serialized;
            send(controller, "draft", { cv: normalized, provider: "mock", model: "deterministic" });
          }
          send(controller, "complete", {
            cv,
            provider: "mock",
            model: "deterministic",
            warning: upstreamOpened ? `Stream interrupted: ${warning}` : warning,
          });
        } finally {
          if (!signal.aborted) controller.close();
        }
      })();
    },
    cancel() {
      streamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
