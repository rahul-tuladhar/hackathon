import { jsonComplete } from "@/lib/llm";
import { mockGenerate } from "@/lib/mock";
import { generatePrompt } from "@/lib/prompts";
import { completeResumeEvidence } from "@/lib/resume-selection";
import type { PersonalMemory } from "@/lib/memory";
import type { BigCVBullet, GeneratedCV, JobTarget } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  bullets?: BigCVBullet[];
  job?: JobTarget;
  intent?: string;
  plan?: string[];
  research?: string | null;
  memories?: PersonalMemory[];
};

function isUsableCV(cv: unknown): cv is GeneratedCV {
  if (!cv || typeof cv !== "object") return false;
  const c = cv as Partial<GeneratedCV>;
  return (
    typeof c.headline === "string" &&
    typeof c.summary === "string" &&
    Array.isArray(c.bullets) &&
    c.bullets.length > 0
  );
}

function normalize(cv: GeneratedCV): GeneratedCV {
  return {
    headline: cv.headline || "Tailored CV",
    summary: cv.summary || "",
    skills: Array.isArray(cv.skills) ? cv.skills.slice(0, 16) : [],
    bullets: (cv.bullets || []).slice(0, 12).map((b, i) => ({
      id: b.id || `g${i + 1}`,
      text: String(b.text || "").trim(),
      evidenceId: b.evidenceId ?? null,
      rationale: String(b.rationale || "").trim(),
      keywords: Array.isArray(b.keywords) ? b.keywords.slice(0, 8) : [],
    })),
    coverNote: cv.coverNote || "",
  };
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const source = body.bullets || [];
  const bullets = source.filter((b) => b.selected);
  const job = body.job || { title: "", company: "", url: "", description: "" };
  const fallback = () =>
    completeResumeEvidence(
      mockGenerate({ bullets: source, job, intent: body.intent || "" }),
      source,
      job,
    );

  try {
    const { system, user } = generatePrompt({
      bullets,
      job,
      intent: body.intent || "",
      plan: body.plan || ["cv_generate", "cv_assess"],
      research: body.research,
      memories: Array.isArray(body.memories) ? body.memories.filter((item) => item?.status === "approved") : [],
    });
    const { data, provider, model } = await jsonComplete<GeneratedCV>(
      system,
      user,
      { maxTokens: 4000 },
    );
    if (!isUsableCV(data)) throw new Error("model returned an unusable CV shape");
    return Response.json({
      cv: completeResumeEvidence(normalize(data), source, job),
      provider,
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({
      cv: fallback(),
      provider: "mock",
      model: "deterministic",
      warning: message,
    });
  }
}
