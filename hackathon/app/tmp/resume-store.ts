import { create } from "zustand";
import type { ResumeData } from "./resume-types";

// A single work experience, edited via the form. The resume derives from these.
export type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  timeRange: string;
  bullets: string[];
};

// Static parts of the resume for now (only experiences are form-driven).
const NAME = "First Last";
const CONTACT = "first.last@example.com | github.com/mike-pete";

const seedExperiences: Experience[] = [
  {
    id: "exp-vercel",
    jobTitle: "Staff Software Engineer",
    company: "BigCo",
    timeRange: "2024 – Present",
    bullets: [
      "Led the architecture of a multi-region edge caching layer serving 2B requests per day",
      "Reduced build times 55% across the platform by parallelizing the compilation pipeline",
      "Drove adoption of React Server Components across 40+ internal applications",
      "Designed a zero-downtime database migration framework adopted company-wide",
      "Mentored 6 engineers, two of whom were promoted within a year",
      "Built an incremental static regeneration system that cut origin load by 70%",
      "Established performance budgets and automated regression gates in CI",
      "Shipped a streaming log pipeline ingesting 100TB per week with sub-second tail latency",
      "Reduced p95 cold-start latency for serverless functions 60% through runtime pooling",
      "Authored the internal RFC process now used for all cross-team architecture decisions",
      "Led a security hardening initiative closing 30+ findings ahead of the SOC 2 audit",
      "Built a feature-flag and experimentation platform powering 200+ concurrent experiments",
      "Cut on-call pages 45% by improving alerting signal and auto-remediation runbooks",
      "Partnered with product to define and ship the v2 analytics dashboard used by 50k teams",
      "Open-sourced an internal profiling tool that gained 4k GitHub stars",
    ],
  },
  {
    id: "exp-luca",
    jobTitle: "Founding Software Engineer",
    company: "Luca (YC W23)",
    timeRange: "2024 – 2024",
    bullets: [
      "Took price plan deletions down from 30 minutes to 2 seconds by optimizing PostgreSQL table relationships",
      "Achieved instant user interactions by updating the UI before changing the DB, resulting in a snappy user experience",
      "Informed users of current pricing landscape by building price index summary notifications for Slack and email",
      "Enabled pre-launch feature testing using branch previews (Next.js/Vercel) and Launch Darkly feature flags",
      "Ensure smooth data ingestion by building and documenting REST APIs for our competitor intelligence provider",
      "Reduced API p99 latency from 1.2s to 180ms by adding Redis caching and connection pooling",
      "Cut cloud infrastructure costs 40% by rightsizing containers and introducing spot instances",
      "Migrated a 2M-line monolith to a modular service architecture with zero customer downtime",
      "Built a real-time collaboration engine using WebSockets and CRDTs supporting 10k concurrent users",
      "Automated the release pipeline, reducing deploy time from 45 minutes to 4 minutes",
      "Designed an event-driven ingestion system processing 50M events per day with Kafka",
      "Introduced end-to-end type safety across the stack with tRPC, eliminating a class of runtime errors",
      "Led migration from REST to GraphQL, cutting over-fetching and halving mobile payload sizes",
      "Implemented feature flagging infrastructure enabling safe, incremental rollouts to 1% cohorts",
      "Reduced frontend bundle size 62% through code splitting, tree shaking, and lazy loading",
      "Built an internal design system adopted by 7 product teams, standardizing 120+ components",
      "Shipped offline-first mobile sync with conflict resolution, improving retention in low-connectivity regions",
      "Created a self-serve analytics dashboard that cut ad-hoc data requests to the team by 80%",
    ],
  },
  {
    id: "exp-avogadro",
    jobTitle: "Founding Software Engineer",
    company: "Avogadro",
    timeRange: "2023 – 2024",
    bullets: [
      "Streamlined lead generation by building a React/TypeScript tool to scrape and export prospects from LinkedIn",
      "Protected product stability by building an end-to-end test suite using Playwright and GitHub Actions",
      "Led team meeting to establish React state management coding standards for the frontend team",
      "Hardened authentication by adding WebAuthn passkeys and rotating refresh tokens",
      "Optimized a hot Postgres query path with partial indexes, dropping load times from 8s to 300ms",
      "Instrumented the app with OpenTelemetry, giving the team distributed tracing across 30 services",
      "Built a document-generation service rendering 100k personalized PDFs daily",
      "Reduced flaky test rate from 12% to under 1% by isolating shared state and adding retries",
      "Architected a multi-tenant data model with row-level security for enterprise customers",
      "Shipped a Stripe billing integration supporting metered usage, proration, and dunning",
      "Built an LLM-powered support assistant that deflected 35% of inbound tickets",
      "Designed a rate limiter using a token-bucket algorithm backed by Redis Lua scripts",
      "Migrated CI from Jenkins to GitHub Actions, cutting pipeline costs and maintenance overhead",
      "Implemented blue-green deployments with automated smoke tests and instant rollback",
      "Reduced onboarding time for new engineers from two weeks to three days with a one-command dev setup",
    ],
  },
  {
    id: "exp-zillow",
    jobTitle: "Senior Software Engineer",
    company: "Zillow",
    timeRange: "2022 – 2023",
    bullets: [
      "Revamped mortgage processing system used by 120 loan officers to facilitate $72m in mortgages per month",
      "5x’ed the mortgage options available to loan officers for each borrower, taking 45 minute sessions down to 5 minutes",
      "Owned the business logic and input validation code for the forms that determine end-user mortgage qualification",
      "Extended Python/Go document generation microservices enabling loan officers to send customers custom PDFs",
      "Ensured user-entered data validity by using React Hook Form and Yup to control and verify form data",
      "Coordinated with design team and business analysts to ensure features met functional and usability requirements",
      "Built a webhook delivery system with exponential backoff, dead-letter queues, and idempotency keys",
      "Led an accessibility audit and remediation bringing the app to WCAG 2.1 AA compliance",
      "Created a synthetic monitoring suite catching regressions before they reached production",
      "Optimized the image pipeline with on-the-fly resizing and AVIF, cutting bandwidth 55%",
      "Built a search experience with typo tolerance and faceting using Elasticsearch",
      "Designed a job queue with priority lanes and backpressure handling 5M jobs per day",
      "Shipped a GDPR data-export and deletion workflow with full audit logging",
      "Reduced cold-start times for serverless functions 70% by trimming dependencies and bundling",
      "Built a feature-rich rich-text editor with collaborative cursors and version history",
      "Migrated secrets management to Vault with automatic rotation and least-privilege policies",
      "Created a load-testing harness with k6 that surfaced a connection leak before launch",
      "Implemented streaming server-side rendering, improving LCP from 4.1s to 1.3s",
      "Built a data pipeline backfilling 3 years of historical records without impacting live traffic",
    ],
  },
  {
    id: "exp-stemtaught",
    jobTitle: "Software Engineer",
    company: "STEMTaught",
    timeRange: "2018 – 2021",
    bullets: [
      "Enabled site admins to create and edit content of digital textbook by building a custom page editor with React",
      "Improved content accessibility for students by highlighting words in the textbook as a recording read the text aloud",
      "Used Python and Google’s Speech-to-Text API to determine the timing of each word in textbook audio recordings",
      "Designed an A/B testing framework with sequential testing and automatic guardrail metrics",
      "Reduced the memory footprint of a worker fleet 45% by fixing a retained-closure leak",
      "Shipped an admin impersonation tool with scoped permissions and full action auditing",
      "Built a notification system spanning email, SMS, and push with user preference controls",
      "Introduced contract testing with Pact, catching breaking API changes across teams",
      "Optimized a React render path with memoization and virtualization for 50k-row tables",
      "Built a CLI that scaffolds new services with linting, CI, and observability baked in",
      "Led incident response for a Sev1 outage, authoring the postmortem and three preventative fixes",
      "Migrated from a vendor CMS to a headless architecture, cutting content publish time in half",
      "Built a fraud-detection rules engine flagging suspicious transactions in real time",
      "Implemented database read replicas and query routing, scaling reads 4x",
      "Created a developer portal with API docs, interactive playgrounds, and usage dashboards",
    ],
  },
];

type ResumeStore = {
  experiences: Experience[];
  addExperience: () => void;
  updateExperience: (
    id: string,
    patch: Partial<Pick<Experience, "jobTitle" | "company" | "timeRange">>,
  ) => void;
  removeExperience: (id: string) => void;
  addBullet: (id: string) => void;
  updateBullet: (id: string, index: number, text: string) => void;
  removeBullet: (id: string, index: number) => void;
};

export const useResumeStore = create<ResumeStore>((set) => ({
  experiences: seedExperiences,
  addExperience: () =>
    set((s) => ({
      experiences: [
        ...s.experiences,
        {
          id: crypto.randomUUID(),
          jobTitle: "",
          company: "",
          timeRange: "",
          bullets: [""],
        },
      ],
    })),
  updateExperience: (id, patch) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    })),
  removeExperience: (id) =>
    set((s) => ({ experiences: s.experiences.filter((e) => e.id !== id) })),
  addBullet: (id) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id ? { ...e, bullets: [...e.bullets, ""] } : e,
      ),
    })),
  updateBullet: (id, index, text) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id
          ? { ...e, bullets: e.bullets.map((b, i) => (i === index ? text : b)) }
          : e,
      ),
    })),
  removeBullet: (id, index) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id
          ? { ...e, bullets: e.bullets.filter((_, i) => i !== index) }
          : e,
      ),
    })),
}));

// Derive the full resume JSON from the structured store state.
export function buildResumeData(experiences: Experience[]): ResumeData {
  return {
    name: NAME,
    contact: CONTACT,
    sections: [
      {
        title: "Experience",
        type: "entries",
        entries: experiences
          .filter((e) => e.jobTitle.trim() || e.company.trim())
          .map((e) => ({
            title: e.jobTitle,
            subtitle: e.company || undefined,
            right: e.timeRange || undefined,
            bullets: e.bullets.filter((b) => b.trim()),
          })),
      },
    ],
  };
}
