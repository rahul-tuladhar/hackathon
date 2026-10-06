"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { useAgentStore } from "@/lib/store";

const links = [
  { href: "/jobs", label: "Jobs" },
  { href: "/workspace", label: "Workspace" },
  { href: "/rules", label: "Rules" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const loadResume = useAgentStore((s) => s.loadResume);

  const openResume = () => {
    loadResume();
    router.push("/resume");
  };

  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <Link href="/jobs" className="mr-3 font-semibold tracking-tight">
        Tailor
      </Link>
      <nav className="flex items-center gap-1">
        {links.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={openResume}
        className={`ml-auto rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          pathname === "/resume"
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        My resume
      </button>
      <div className="ml-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
        <AccountMenu />
      </div>
    </header>
  );
}
