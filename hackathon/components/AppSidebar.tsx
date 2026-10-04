"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAgentStore } from "@/lib/store";

function Mark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
      <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M15 3.5V8h4M8.5 13h7M8.5 16.5h5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function WorkspaceIcon() {
  return <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2.5" /><path d="M7 3v14M7 7h10" /></svg>;
}

function JobsIcon() {
  return <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="6" width="15" height="11" rx="2" /><path d="M7 6V4.7a1.7 1.7 0 0 1 1.7-1.7h2.6A1.7 1.7 0 0 1 13 4.7V6M2.5 10h15M8 10v2h4v-2" /></svg>;
}

function ResumeIcon() {
  return <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 2.8h7l3.5 3.5v10.9H5a1.5 1.5 0 0 1-1.5-1.5V4.3A1.5 1.5 0 0 1 5 2.8Z" /><path d="M12 3v4h4M6.5 10h7M6.5 13h7" strokeLinecap="round" /></svg>;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sampleLabel = useAgentStore((state) => state.sampleLabel);
  const bulletCount = useAgentStore((state) => state.bullets.length);
  const loadResume = useAgentStore((state) => state.loadResume);
  const isWorkspace = pathname === "/";
  const isJobs = pathname.startsWith("/jobs");

  const openResume = () => {
    loadResume();
    if (!isWorkspace) router.push("/");
  };

  const navItem = (
    active: boolean,
    icon: ReactNode,
    label: string,
    action: () => void,
    title: string,
  ) => (
    <button
      key={label}
      type="button"
      onClick={action}
      title={title}
      aria-current={active ? "page" : undefined}
      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      <span className="grid size-7 shrink-0 place-items-center">{icon}</span>
      <span className="hidden truncate xl:block">{label}</span>
    </button>
  );

  return (
    <>
      <aside className="hidden h-dvh w-[68px] shrink-0 flex-col border-r border-zinc-200 bg-white px-2.5 py-4 dark:border-zinc-800 dark:bg-zinc-950 md:flex xl:w-[224px] xl:px-4">
        <Link href="/" className="mb-9 flex items-center gap-3 rounded-xl px-1" aria-label="Tailor workspace">
          <Mark />
          <span className="hidden min-w-0 xl:block">
            <span className="block text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Tailor</span>
            <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">CAREER WORKSPACE</span>
          </span>
        </Link>

        <div className="mb-2 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 xl:block dark:text-zinc-500">
          Workspace
        </div>
        <nav aria-label="Workspace navigation" className="space-y-1">
          {navItem(isWorkspace, <WorkspaceIcon />, "Tailoring", () => router.push("/"), "Open tailoring workspace")}
          {navItem(isJobs, <JobsIcon />, "Job board", () => router.push("/jobs"), "Browse the job board")}
        </nav>

        <div className="mb-2 mt-8 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 xl:block dark:text-zinc-500">
          Profile
        </div>
        <nav aria-label="Resume navigation" className="space-y-1">
          {navItem(false, <ResumeIcon />, "My resume", openResume, "Load Rahul’s resume")}
        </nav>

        <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="hidden items-center gap-2.5 px-2 xl:flex">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">RT</span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-zinc-800 dark:text-zinc-200">Rahul Tuladhar</span>
              <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400" title={sampleLabel ?? "Resume not loaded"}>
                {sampleLabel ? `${bulletCount} resume points` : "Resume not loaded"}
              </span>
            </span>
          </div>
          <div className="grid place-items-center xl:hidden" title={sampleLabel ?? "Resume not loaded"}>
            <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">RT</span>
          </div>
        </div>
      </aside>

      <nav aria-label="Mobile workspace navigation" className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <Link href="/" className="mr-auto flex items-center gap-2.5 rounded-lg pr-2">
          <Mark />
          <span className="text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Tailor</span>
        </Link>
        <Link href="/" aria-current={isWorkspace ? "page" : undefined} className={`rounded-lg px-2.5 py-2 text-xs font-medium ${isWorkspace ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-zinc-600 dark:text-zinc-400"}`}>
          Tailoring
        </Link>
        <Link href="/jobs" aria-current={isJobs ? "page" : undefined} className={`rounded-lg px-2.5 py-2 text-xs font-medium ${isJobs ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-zinc-600 dark:text-zinc-400"}`}>
          Jobs
        </Link>
        <button type="button" onClick={openResume} className="rounded-lg px-2.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Resume
        </button>
      </nav>
    </>
  );
}
