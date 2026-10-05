"use client";

import { IconPlus, IconX } from "@tabler/icons-react";
import { useResumeStore } from "./resume-store";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700";

export default function ExperienceForm() {
  const experiences = useResumeStore((s) => s.experiences);
  const addExperience = useResumeStore((s) => s.addExperience);
  const updateExperience = useResumeStore((s) => s.updateExperience);
  const removeExperience = useResumeStore((s) => s.removeExperience);
  const addBullet = useResumeStore((s) => s.addBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Experience</h1>

      {experiences.map((exp) => (
        <div
          key={exp.id}
          className="relative rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <button
            type="button"
            onClick={() => removeExperience(exp.id)}
            aria-label="Delete experience"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <IconX size={18} stroke={1.5} />
          </button>

          <div className="grid gap-3 pr-8">
            <input
              type="text"
              value={exp.jobTitle}
              onChange={(e) =>
                updateExperience(exp.id, { jobTitle: e.target.value })
              }
              placeholder="Job title (e.g. Senior Software Engineer)"
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={exp.company}
                onChange={(e) =>
                  updateExperience(exp.id, { company: e.target.value })
                }
                placeholder="Company"
                className={inputClass}
              />
              <input
                type="text"
                value={exp.timeRange}
                onChange={(e) =>
                  updateExperience(exp.id, { timeRange: e.target.value })
                }
                placeholder="Time range (e.g. 2022 – 2023)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Bullet points
            </span>
            <div className="mt-2 flex flex-col gap-2">
              {exp.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2">
                  <textarea
                    value={bullet}
                    onChange={(e) => updateBullet(exp.id, i, e.target.value)}
                    placeholder="Describe an accomplishment…"
                    rows={2}
                    className={`${inputClass} resize-y`}
                  />
                  <button
                    type="button"
                    onClick={() => removeBullet(exp.id, i)}
                    aria-label="Delete bullet"
                    className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <IconX size={16} stroke={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addBullet(exp.id)}
              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              <IconPlus size={16} stroke={1.5} />
              Add bullet
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addExperience}
        className="inline-flex items-center justify-center gap-1 self-start rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <IconPlus size={16} stroke={1.5} />
        Add experience
      </button>
    </div>
  );
}
