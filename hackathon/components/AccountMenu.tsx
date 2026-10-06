"use client";

import { useEffect, useState } from "react";
import { CircleHelp, Settings2, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AccountProfile,
  AppSettingsDialog,
  SettingsSection,
  ThemePreference,
} from "@/components/AppSettingsDialog";

const PROFILE_KEY = "hirehand.profile";
const THEME_KEY = "hirehand.theme";
const defaultProfile: AccountProfile = { name: "Rahul Tuladhar", email: "" };

export function AccountMenu() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("general");
  const [profile, setProfile] = useState(defaultProfile);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const storedProfile = localStorage.getItem(PROFILE_KEY);
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile) as Partial<AccountProfile>;
          setProfile({
            name: typeof parsed.name === "string" ? parsed.name : defaultProfile.name,
            email: typeof parsed.email === "string" ? parsed.email : "",
          });
        }
        if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
          setTheme(storedTheme);
        }
      } catch {
        // Preferences are optional; a blocked or malformed localStorage entry falls back to defaults.
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Continue with in-memory preferences when the browser cannot save local data.
    }
    const root = document.documentElement;
    const syncTheme = () => {
      root.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
      );
    };
    syncTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [hydrated, profile, theme]);

  const openSettings = (target: SettingsSection) => {
    setSection(target);
    setSettingsOpen(true);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setSection("general");
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setSection, setSettingsOpen]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Open account menu for ${profile.name || "your account"}`}
            className="group inline-flex items-center gap-2 rounded-full border border-transparent p-0.5 pr-2 transition hover:border-zinc-200 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-[#f4dc9e] text-[11px] font-semibold text-[#624818] ring-2 ring-white transition group-hover:ring-[#f7f2e4] dark:ring-zinc-950 dark:group-hover:ring-zinc-800">
              {initials(profile.name)}
            </span>
            <span className="hidden max-w-[130px] truncate text-xs font-medium text-zinc-600 sm:inline dark:text-zinc-300">
              {profile.name || "Your account"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10} className="w-[264px] rounded-xl border-zinc-200 bg-[#fffefa] p-1.5 shadow-[0_14px_40px_rgba(33,32,25,0.15)] dark:border-zinc-700 dark:bg-zinc-900">
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 font-normal">
            <span className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4dc9e] text-xs font-semibold text-[#624818]">
                {initials(profile.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{profile.name || "Your account"}</span>
                <span className="mt-0.5 block truncate text-[11px] font-normal text-zinc-500">{profile.email || "Personal workspace"}</span>
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1.5 bg-[#ece9df]" />
          <DropdownMenuItem onSelect={() => openSettings("profile")} className="h-9 rounded-lg px-2.5 text-xs text-zinc-700 focus:bg-[#f7f6f1] focus:text-zinc-900 dark:text-zinc-300 dark:focus:bg-zinc-800 dark:focus:text-zinc-100">
            <UserRound className="size-4 text-zinc-500" />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openSettings("general")} className="h-9 rounded-lg px-2.5 text-xs text-zinc-700 focus:bg-[#f7f6f1] focus:text-zinc-900 dark:text-zinc-300 dark:focus:bg-zinc-800 dark:focus:text-zinc-100">
            <Settings2 className="size-4 text-zinc-500" />
            Settings
            <span className="ml-auto text-[10px] text-zinc-400">⌘ ,</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openSettings("help")} className="h-9 rounded-lg px-2.5 text-xs text-zinc-700 focus:bg-[#f7f6f1] focus:text-zinc-900 dark:text-zinc-300 dark:focus:bg-zinc-800 dark:focus:text-zinc-100">
            <CircleHelp className="size-4 text-zinc-500" />
            Help & about
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5 bg-[#ece9df]" />
          <p className="px-2.5 pb-1 pt-0.5 text-[10px] text-zinc-400">Preferences stay in this browser</p>
        </DropdownMenuContent>
      </DropdownMenu>

      <AppSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        section={section}
        onSectionChange={setSection}
        profile={profile}
        onProfileChange={setProfile}
        theme={theme}
        onThemeChange={setTheme}
      />
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
