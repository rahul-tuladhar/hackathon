// Runs once when a server instance starts. Kicks off Exa people research for
// every job so results are ready before anyone opens a listing. Jobs that
// already have a run at Exa are skipped, so restarts don't cost extra.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` can load instrumentation too; never spend credits during builds.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.EXA_API_KEY || process.env.RESEARCH_ON_BOOT === "false") return;

  const [{ startAllPeopleRuns }, { allResearchJobs }] = await Promise.all([
    import("./lib/research"),
    import("./app/researchJobs"),
  ]);

  // Not awaited: starting runs must not delay the server becoming ready.
  startAllPeopleRuns(allResearchJobs()).catch((err) => console.error("[research] failed to start people runs:", err));
}
