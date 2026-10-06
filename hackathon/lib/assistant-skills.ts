export const TAILOR_SKILLS = [
  {
    id: "resume-tailoring",
    name: "Resume tailoring",
    summary: "Tailor the active job workspace using selected evidence, then assess and export the result.",
    instructions: "Inspect the active job and selected resume points first. Run the existing Tailor pipeline when asked to create a tailored CV. Explain evidence traceability and call out fallback copy for verification.",
  },
  {
    id: "recruiting-strategy",
    name: "Recruiting strategy",
    summary: "Plan applications, role fit, networking, recruiter conversations, and interview preparation.",
    instructions: "Use the active job and approved career preferences. Separate verified resume evidence from hypotheses. Offer a practical next step and never contact anyone on the user's behalf.",
  },
  {
    id: "professional-writing",
    name: "Professional writing",
    summary: "Draft or edit recruiter notes, cover notes, follow-ups, and other professional writing.",
    instructions: "Match approved voice preferences and the user's current instruction. Draft for user review; do not send messages or claim to have sent them.",
  },
  {
    id: "workspace-operator",
    name: "Workspace operator",
    summary: "Inspect and manage jobs, resume evidence, pipeline runs, provider health, and local memory.",
    instructions: "Use the app tools for any workspace operation. Verify each mutation from the tool result before reporting success. Ask for missing specifics instead of guessing destructive targets.",
  },
] as const;

export type TailorSkillId = (typeof TAILOR_SKILLS)[number]["id"];

export function getTailorSkill(id: string) {
  return TAILOR_SKILLS.find((skill) => skill.id === id);
}
