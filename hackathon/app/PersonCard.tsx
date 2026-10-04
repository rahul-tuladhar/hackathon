import Image from "next/image";
import type { ReactNode } from "react";
import type { PersonProfile } from "./actions";

export default function PersonCard({
  person,
  action,
  children,
}: {
  person: PersonProfile;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex gap-4">
        <Image
          src={person.profilePicUrl}
          alt={person.name}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{person.name}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {person.jobTitle}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-sm font-medium">
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {person.email}
              </a>
            )}
            <a
              href={person.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Profile
            </a>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {person.description}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
