import jobs from "../../../jobs";
import { evaluateWithJev, isJevConfigured, type JevQuestion } from "../../../jev";

// Scores every resume bullet's relevance to a job using jev. Each bullet becomes
// one boolean question ("is this relevant to the role?"); its probability is the
// relevance score. One jev call per experience, run in parallel.
// POST { jobId, experiences: { id, jobTitle, company, bullets }[] }
//   -> { scores: Record<experienceId, number[]> } | { error }.

type IncomingExperience = {
  id: string;
  jobTitle: string;
  company: string;
  bullets: string[];
};

export async function POST(request: Request) {
  if (!isJevConfigured()) {
    return Response.json(
      { error: "Jev is not configured. Set VERCEL_AI_GATEWAY in .env.local." },
      { status: 503 },
    );
  }

  const { jobId, experiences } = (await request.json()) as {
    jobId?: number;
    experiences?: IncomingExperience[];
  };

  const job = jobId != null ? jobs[jobId] : undefined;
  if (!job) {
    return Response.json({ error: `Unknown job: ${jobId}` }, { status: 404 });
  }

  try {
    const entries = await Promise.all(
      (experiences ?? []).map(async (exp) => {
        if (exp.bullets.length === 0) return [exp.id, []] as const;

        const questions: Record<string, JevQuestion> = {};
        exp.bullets.forEach((bullet, i) => {
          questions[`b${i}`] = {
            type: "boolean",
            instructions: `A candidate is tailoring their resume for this job. Under their "${exp.jobTitle}" role at ${exp.company}, one resume bullet reads: "${bullet}". Is this bullet relevant and compelling for this specific job, such that it should stay on a one-page resume?`,
          };
        });

        const state = JSON.stringify({ id: jobId, ...job });
        const { answers } = await evaluateWithJev({ state, questions });
        const scores = exp.bullets.map((_, i) => {
          const answer = answers[`b${i}`];
          return answer?.type === "boolean" ? answer.probability : 0;
        });
        return [exp.id, scores] as const;
      }),
    );

    return Response.json({ scores: Object.fromEntries(entries) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to score bullets" },
      { status: 500 },
    );
  }
}
