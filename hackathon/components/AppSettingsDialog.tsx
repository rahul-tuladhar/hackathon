"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CircleHelp,
  House,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type SettingsSection = "general" | "profile" | "appearance" | "help";
export type ThemePreference = "system" | "light" | "dark";

export type AccountProfile = {
  name: string;
  email: string;
};

type AppSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  profile: AccountProfile;
  onProfileChange: (profile: AccountProfile) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
};

const navGroups: {
  label: string;
  items: { id: SettingsSection; label: string; icon: typeof House }[];
}[] = [
  {
    label: "Personal",
    items: [
      { id: "general", label: "General", icon: House },
      { id: "profile", label: "Profile", icon: UserRound },
      { id: "appearance", label: "Appearance", icon: Palette },
    ],
  },
  {
    label: "Support",
    items: [{ id: "help", label: "Help & about", icon: CircleHelp }],
  },
];

const sectionCopy: Record<SettingsSection, { title: string; description: string }> = {
  general: {
    title: "General",
    description: "A few details about your Hirehand workspace.",
  },
  profile: {
    title: "Profile",
    description: "The name and contact details shown in your workspace.",
  },
  appearance: {
    title: "Appearance",
    description: "Choose how Hirehand looks on this device.",
  },
  help: {
    title: "Help & about",
    description: "Find your way around the job search workspace.",
  },
};

export function AppSettingsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
  profile,
  onProfileChange,
  theme,
  onThemeChange,
}: AppSettingsDialogProps) {
  const copy = sectionCopy[section];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="app-settings-dialog fixed inset-2 left-2 top-2 flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-zinc-200 bg-[#fffefa] p-0 shadow-[0_24px_90px_rgba(33,32,25,0.22)] sm:inset-6 sm:left-6 sm:top-6 sm:h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] sm:max-w-none md:inset-10 md:left-10 md:top-10 md:h-[calc(100dvh-5rem)] md:w-[calc(100vw-5rem)] dark:border-zinc-700 dark:bg-zinc-900"
      >
        <DialogTitle className="sr-only">Hirehand settings</DialogTitle>
        <DialogDescription className="sr-only">
          Update your profile and preferences for the whole app.
        </DialogDescription>

        <div className="flex min-h-0 flex-1">
          <aside className="settings-sidebar flex w-[64px] shrink-0 flex-col border-r border-[#ece9df] bg-[#f7f6f1] sm:w-[220px] md:w-[260px] dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex h-[68px] items-center justify-between border-b border-[#ece9df] px-2 sm:px-5 dark:border-zinc-700">
              <div>
                <p className="hidden text-sm font-semibold tracking-tight text-zinc-900 sm:block dark:text-zinc-100">Settings</p>
                <p className="hidden text-[11px] text-zinc-500 sm:mt-0.5 sm:block dark:text-zinc-400">Your Hirehand space</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close settings"
                className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav aria-label="Settings sections" className="flex-1 overflow-y-auto px-1.5 py-5 sm:px-3">
              {navGroups.map((group) => (
                <div key={group.label} className="mb-6">
                  <p className="mb-2 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 sm:block">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(({ id, label, icon: Icon }) => {
                      const selected = section === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onSectionChange(id)}
                          aria-current={selected ? "page" : undefined}
                          title={label}
                          className={`flex w-full items-center justify-center gap-2.5 rounded-lg px-1.5 py-2 text-left text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:justify-start sm:px-2.5 ${
                            selected
                              ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(30,30,20,0.08)] dark:bg-zinc-800 dark:text-zinc-100"
                              : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          }`}
                        >
                          <Icon className={`size-4 shrink-0 ${selected ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`} />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-[#ece9df] p-2 sm:p-4 dark:border-zinc-700">
              <div className="flex items-center justify-center gap-2.5 rounded-xl bg-white/80 p-1.5 sm:justify-start sm:p-2.5 dark:bg-zinc-800">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f4dc9e] text-[11px] font-semibold text-[#624818]">
                  {initials(profile.name)}
                </span>
                <span className="min-w-0">
                  <span className="hidden truncate text-xs font-medium text-zinc-800 sm:block dark:text-zinc-100">
                    {profile.name || "Your profile"}
                  </span>
                  <span className="hidden truncate text-[10px] text-zinc-500 sm:block dark:text-zinc-400">Personal workspace</span>
                </span>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-[#fffefa] dark:bg-zinc-950">
            <div className="mx-auto w-full max-w-[820px] px-6 py-8 sm:px-10 sm:py-11 lg:px-14">
              <div className="mb-8 border-b border-[#ece9df] pb-5 dark:border-zinc-800">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Personal workspace
                </p>
                <h2 className="text-[26px] font-semibold tracking-[-0.035em] text-zinc-900 dark:text-zinc-100">{copy.title}</h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{copy.description}</p>
              </div>

              {section === "general" && <GeneralSettings />}
              {section === "profile" && (
                <ProfileSettings profile={profile} onProfileChange={onProfileChange} />
              )}
              {section === "appearance" && <AppearanceSettings theme={theme} onThemeChange={onThemeChange} />}
              {section === "help" && (
                <HelpSettings onSectionChange={onSectionChange} onClose={() => onOpenChange(false)} />
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralSettings() {
  return (
    <div className="space-y-8">
      <SettingsGroup title="Your workspace" note="A private place to prepare stronger, more personal applications.">
        <SettingRow title="Workspace type" description="Your resume, target roles, and research stay together here.">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e9e5da] bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
            <BriefcaseBusiness className="size-3.5 text-amber-700" /> Personal
          </span>
        </SettingRow>
        <SettingRow title="Saved on this device" description="Profile and appearance preferences are stored in this browser.">
          <span className="rounded-full bg-[#f3f1e9] px-2.5 py-1 text-[11px] font-medium text-zinc-600">Local</span>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Your workflow" note="Keep each step grounded in your own experience.">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            { icon: UserRound, step: "01", title: "Add your resume", body: "Bring in your experience once." },
            { icon: BriefcaseBusiness, step: "02", title: "Choose a role", body: "Compare jobs in one place." },
            { icon: Bell, step: "03", title: "Review together", body: "Check every draft before it leaves." },
          ].map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="rounded-xl border border-[#eeebe2] bg-white p-3.5">
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-amber-700" />
                <span className="font-mono text-[10px] text-zinc-400">{step}</span>
              </div>
              <p className="mt-4 text-xs font-semibold text-zinc-800">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{body}</p>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}

function ProfileSettings({
  profile,
  onProfileChange,
}: {
  profile: AccountProfile;
  onProfileChange: (profile: AccountProfile) => void;
}) {
  return (
    <SettingsGroup title="Your details" note="Edit the personal details you want to see in your Hirehand account.">
      <div className="flex items-center gap-4 border-b border-[#efede6] pb-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#f4dc9e] text-sm font-semibold text-[#624818]">
          {initials(profile.name)}
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-800">{profile.name || "Your profile"}</p>
          <p className="mt-1 text-xs text-zinc-500">Personal account</p>
        </div>
      </div>
      <label className="block pt-5">
        <span className="text-xs font-medium text-zinc-700">Name</span>
        <input
          value={profile.name}
          onChange={(event) => onProfileChange({ ...profile, name: event.target.value })}
          autoComplete="name"
          className="mt-1.5 h-10 w-full rounded-lg border border-[#e5e2d8] bg-white px-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 sm:max-w-md"
          placeholder="Your name"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-xs font-medium text-zinc-700">Email <span className="font-normal text-zinc-400">· optional</span></span>
        <input
          type="email"
          value={profile.email}
          onChange={(event) => onProfileChange({ ...profile, email: event.target.value })}
          autoComplete="email"
          className="mt-1.5 h-10 w-full rounded-lg border border-[#e5e2d8] bg-white px-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 sm:max-w-md"
          placeholder="you@example.com"
        />
      </label>
      <p className="mt-4 text-[11px] text-zinc-400">Changes save automatically on this device.</p>
    </SettingsGroup>
  );
}

function AppearanceSettings({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const options: { id: ThemePreference; title: string; detail: string; icon: typeof Sun }[] = [
    { id: "system", title: "Match device", detail: "Follow your system setting", icon: Monitor },
    { id: "light", title: "Light", detail: "A bright, paper-like workspace", icon: Sun },
    { id: "dark", title: "Dark", detail: "A softer view for low light", icon: Moon },
  ];

  return (
    <SettingsGroup title="Color theme" note="Your choice applies across every page in this app.">
      <div className="space-y-2" role="radiogroup" aria-label="Color theme">
        {options.map(({ id, title, detail, icon: Icon }) => {
          const selected = theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onThemeChange(id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selected ? "border-amber-500/70 bg-amber-50/60" : "border-[#eeebe2] bg-white hover:border-[#d9d4c6]"}`}
            >
              <span className={`flex size-9 items-center justify-center rounded-lg ${selected ? "bg-[#f4dc9e] text-[#624818]" : "bg-[#f5f4ef] text-zinc-500"}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-zinc-800">{title}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">{detail}</span>
              </span>
              <span className={`flex size-[18px] items-center justify-center rounded-full border ${selected ? "border-amber-700 bg-amber-700" : "border-zinc-300 bg-white"}`}>
                {selected && <span className="size-1.5 rounded-full bg-white" />}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsGroup>
  );
}

function HelpSettings({
  onSectionChange,
  onClose,
}: {
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-7">
      <SettingsGroup title="A thoughtful job search" note="Hirehand helps you bring your real experience to the right opportunities.">
        <div className="space-y-2">
          <HelpLink href="/resume" onNavigate={onClose} title="Tailor your resume" body="Start from your experience and shape it around a role." />
          <HelpLink href="/jobs" onNavigate={onClose} title="Explore jobs" body="Review opportunities and company research together." />
          <HelpLink href="/rules" onNavigate={onClose} title="Set your criteria" body="Adjust the preferences that guide your search." />
        </div>
      </SettingsGroup>
      <SettingsGroup title="About Hirehand" note="Built for more personal, evidence-grounded applications.">
        <SettingRow title="Your work stays yours" description="Drafts and generated materials stay in your workspace until you choose to use them.">
          <span className="rounded-full bg-[#f3f1e9] px-2.5 py-1 text-[11px] font-medium text-zinc-600">Review first</span>
        </SettingRow>
      </SettingsGroup>
      <button
        type="button"
        onClick={() => onSectionChange("profile")}
        className="text-xs font-medium text-amber-800 underline decoration-amber-800/30 underline-offset-4 hover:decoration-amber-800"
      >
        Update your profile
      </button>
    </div>
  );
}

function SettingsGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold text-zinc-800">{title}</h3>
        {note && <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{note}</p>}
      </div>
      <div className="rounded-xl border border-[#eeebe2] bg-white px-4 sm:px-5">{children}</div>
    </section>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#efede6] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-800">{title}</p>
        <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-zinc-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function HelpLink({ href, title, body, onNavigate }: { href: string; title: string; body: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className="group flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-[#faf9f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
      <span>
        <span className="block text-xs font-medium text-zinc-800 group-hover:text-amber-900">{title}</span>
        <span className="mt-1 block text-[11px] text-zinc-500">{body}</span>
      </span>
      <span aria-hidden="true" className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-amber-800">↗</span>
    </Link>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
