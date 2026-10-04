import { evaluateWithJev, isJevConfigured, type JevQuestion } from "../../jev";
import type { BigCVBullet, JobTarget } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isJevConfigured()) return Response.json({ error: "Jev is not configured." }, { status: 503 });
  try {
    const { bullets = [], job } = (await request.json()) as { bullets?: BigCVBullet[]; job?: JobTarget };
    if (!job?.description || !Array.isArray(bullets)) return Response.json({ error: "Job and bullets are required." }, { status: 400 });
    const selected = bullets.filter((bullet) => bullet.selected).slice(0, 60);
    if (!selected.length) return Response.json({ scores: {} });
    const questions: Record<string, JevQuestion> = {};
    for (const bullet of selected) {
      questions[bullet.id] = {
        type: "boolean",
        instructions: `Evaluate the candidate's resume bullet with id ${bullet.id}: “${bullet.text}”. Is this specific bullet relevant evidence for the target job in state? Count transferable skills and impact, but do not equate generic engineering experience with role relevance.`,
      };
    }
    const state = JSON.stringify({ job, bullets: selected.map(({ id, text, tags }) => ({ id, text, tags })) });
    const { answers } = await evaluateWithJev({ state, questions });
    const scores = Object.fromEntries(selected.map((bullet) => {
      const answer = answers[bullet.id];
      return [bullet.id, answer?.type === "boolean" ? answer.probability : 0.5];
    }));
    return Response.json({ scores, provider: "Jev", count: selected.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Jev scoring failed." }, { status: 502 });
  }
}
