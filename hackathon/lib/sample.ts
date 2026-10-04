import type { BigCVBullet, JobTarget } from "./types";

/**
 * A realistic "Big CV": a messy dump of every experience bullet a person
 * accumulates over years. The agent's job is to select and re-frame the
 * subset that matters for a specific target job.
 */
export const SAMPLE_BIG_CV = `Senior software engineer, 9 years across fintech and developer tools.

- Rebuilt the payments ledger service at Northwind Pay, moving it from a nightly batch to an event-driven pipeline that settled 4.2M transactions/day.
- Cut reconciliation latency from 6 hours to 90 seconds, which unblocked same-day payouts for merchants.
- Led the migration of the core billing API from a Rails monolith to Go microservices with zero customer-visible downtime.
- Introduced idempotency keys and exactly-once delivery for webhooks; dropped duplicate charge incidents by 97%.
- Mentored 4 engineers, two of whom were promoted to senior within a year.
- Ran the on-call rotation for the money-movement team and wrote the incident review process still in use today.
- Built a cost attribution pipeline that surfaced $1.9M/yr of idle cloud spend; finance adopted it company-wide.
- Designed the multi-currency support for payouts across 14 countries, including FX rounding rules.
- Shipped a self-serve API key management console in React and TypeScript used by 30k developers.
- Wrote the first version of the public API docs and SDKs; support tickets about auth fell by 40%.
- Earlier, at a small agency, built marketing sites and internal tools in Python and Django.
- Contributed to open source: maintainer of a small Postgres migration tool with 2k stars.
- Spoke at a regional meetup about event sourcing in payments.
- Comfortable with Kubernetes, Terraform, Postgres, Kafka, Redis, Go, TypeScript, Python.
- Currently interested in developer experience and platform reliability.

Outside work: marathon runner, and I teach a weekend intro-to-code class for high schoolers.`;

export const SAMPLE_JOB: JobTarget = {
  title: "Senior Backend Engineer, Payments Platform",
  company: "Ledgerly",
  url: "https://example.com/jobs/senior-backend-payments",
  description: `About the role
Ledgerly is building the ledger infrastructure for the next generation of fintech. We are looking for a Senior Backend Engineer to join the Payments Platform team.

What you'll do
- Design and operate high-throughput, exactly-once payment services handling millions of transactions per day.
- Own reliability: drive down latency and error budgets for money movement, and lead incident reviews.
- Work across Go and TypeScript services, with Postgres, Kafka and Kubernetes.
- Partner with product on multi-currency payouts and reconciliation tooling.
- Mentor engineers and raise the bar on our engineering practices.

What we're looking for
- 6+ years building backend systems, ideally in payments or fintech.
- Deep experience with distributed systems, idempotency and event-driven architecture.
- Strong Go and SQL/Postgres skills; Kafka and Kubernetes a plus.
- A track record of measurable impact on reliability and cost.
- Excellent written communication and a bias toward ownership.

Nice to have
- Experience with developer-facing APIs and SDKs.
- Familiarity with reconciliation and ledgering.`,
};

/** Naive parser: turn a raw dump into candidate bullets. */
export function parseBigCV(raw: string): BigCVBullet[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets: BigCVBullet[] = [];
  let section: "experience" | "summary" | "education" | "skills" | "certifications" = "experience";
  for (const line of lines) {
    const isBullet = /^[-*•●]/.test(line);
    const body = line.replace(/^[-*•●]\s*/, "").trim();
    if (!isBullet) {
      if (/^(summary|profile|objective)\s*:?$/i.test(line)) section = "summary";
      else if (/^(education|academic background)\s*:?$/i.test(line)) section = "education";
      else if (/^(technical skills|skills|technologies)\s*:?$/i.test(line)) section = "skills";
      else if (/^(certifications?|licenses)\s*:?$/i.test(line)) section = "certifications";
      else if (/\s+[—–]\s+/.test(line)) section = "experience";
    }
    // Skip short headers / non-sentences.
    if (!isBullet || section !== "experience") continue;
    if (body.length < 24) continue;
    bullets.push({
      id: `b${bullets.length + 1}`,
      text: body,
      tags: inferTags(body),
      source: "parsed",
      selected: true,
    });
  }

  // Fall back to sentence splitting if the dump has no bullet markers.
  if (bullets.length === 0) {
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40);
    sentences.forEach((text, i) => {
      bullets.push({
        id: `b${i + 1}`,
        text,
        tags: inferTags(text),
        source: "parsed",
        selected: true,
      });
    });
  }

  return bullets;
}

const TAG_RULES: Array<{ tag: string; re: RegExp }> = [
  { tag: "payments", re: /pay|payment|ledger|billing|transaction|reconcil|payout|charge|currency|fx/i },
  { tag: "backend", re: /service|api|backend|microservice|go\b|postgres|sql|kafka|redis|event/i },
  { tag: "infra", re: /kubernetes|terraform|cloud|k8s|infrastructure|deploy/i },
  { tag: "reliability", re: /reliab|latency|incident|on-call|uptime|error budget|exactly-once|idempoten/i },
  { tag: "leadership", re: /led|mentor|team|promot|owned|owner|rotation|hiring/i },
  { tag: "impact", re: /\$|\d+%|\d+x|\d,\d|million|reduced|increased|grew|dropped|cut/i },
  { tag: "frontend", re: /react|typescript|ui|frontend|console/i },
  { tag: "devrel", re: /docs|sdk|developers|open source|speak|meetup|community/i },
  { tag: "communication", re: /wrote|process|present|speak|class|teach|docs/i },
];

export function inferTags(text: string): string[] {
  return TAG_RULES.filter((r) => r.re.test(text)).map((r) => r.tag);
}
