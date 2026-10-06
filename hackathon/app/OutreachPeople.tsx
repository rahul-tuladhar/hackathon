"use client";

import { useEffect, useState } from "react";
import {
  draftOutreachEmail,
  getOutreachEmails,
  getOutreachState,
  saveOutreachEmail,
  sendOutreachEmail,
  type OutreachEmail,
  type OutreachState,
  type PersonProfile,
} from "./actions";
import PersonCard from "./PersonCard";

type Email = OutreachEmail & { busy?: "drafting" | "sending"; error?: string };
type EmailState = Email | { error: string } | undefined;

const isEmail = (e: EmailState): e is Email => Boolean(e && "subject" in e);

// Researched people, each with an outreach email written for them. Emails can be
// edited here, saved as drafts in the AgentMail inbox, or sent to that inbox itself
// to see how they land. Nothing is ever sent to the contacts from the app.
export default function OutreachPeople({ jobId, people }: { jobId: number; people: PersonProfile[] }) {
  const [state, setState] = useState<OutreachState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, EmailState>>({});

  useEffect(() => {
    let cancelled = false;
    getOutreachState()
      .then((result) => !cancelled && setState(result))
      .catch((err) => !cancelled && setSetupError(err?.message ?? "AgentMail is not configured"));
    getOutreachEmails(jobId)
      .then((result) => !cancelled && setEmails(result))
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof Error ? err.message : "Could not write emails";
        setEmails(Object.fromEntries(people.map((p) => [p.profileUrl, { error }])));
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, people]);

  const patch = (profileUrl: string, update: Partial<Email>) =>
    setEmails((all) => {
      const current = all[profileUrl];
      return isEmail(current) ? { ...all, [profileUrl]: { ...current, ...update } } : all;
    });

  const edit = (profileUrl: string, fields: Pick<Email, "subject"> | Pick<Email, "text">) =>
    setEmails((all) => {
      const current = all[profileUrl];
      if (!isEmail(current)) return all;
      return { ...all, [profileUrl]: { ...current, ...fields, changed: current.drafted, error: undefined } };
    });

  // Keeps edits across reloads; the mailbox copy only changes when drafting.
  const save = (profileUrl: string) => {
    const e = emails[profileUrl];
    if (!isEmail(e)) return;
    saveOutreachEmail(jobId, profileUrl, e.subject, e.text).catch((err) =>
      patch(profileUrl, { error: err instanceof Error ? err.message : "Could not save" }),
    );
  };

  const draft = async (url: string) => {
    const e = emails[url];
    if (!isEmail(e)) return;
    patch(url, { busy: "drafting", error: undefined });
    try {
      const saved = await draftOutreachEmail(jobId, url, e.subject, e.text);
      // Keep anything typed while the request was out.
      setEmails((all) => {
        const current = all[url];
        if (!isEmail(current)) return all;
        const edited = current.subject !== e.subject || current.text !== e.text;
        return { ...all, [url]: { ...current, drafted: saved.drafted, changed: edited, busy: undefined } };
      });
    } catch (err) {
      patch(url, { busy: undefined, error: err instanceof Error ? err.message : "Could not draft" });
    }
  };

  const send = async (url: string) => {
    const e = emails[url];
    if (!isEmail(e)) return;
    patch(url, { busy: "sending", error: undefined });
    try {
      const saved = await sendOutreachEmail(jobId, url, e.subject, e.text);
      patch(url, { sentAt: saved.sentAt, busy: undefined });
    } catch (err) {
      patch(url, { busy: undefined, error: err instanceof Error ? err.message : "Could not send" });
    }
  };

  return (
    <>
      {setupError ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{setupError}</p>
      ) : (
        state && (
          <p className="mt-4 text-sm text-zinc-500">
            Drafts and sent emails go to {state.inbox}, never to the contacts.
          </p>
        )
      )}

      <div className="mt-5 flex flex-col gap-4">
        {people.map((person) => {
          const url = person.profileUrl;
          const e = emails[url];
          return (
            <PersonCard key={url} person={person}>
              {!e ? (
                <p className="mt-4 text-sm text-zinc-500">Writing email…</p>
              ) : !isEmail(e) ? (
                <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{e.error}</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                  <input
                    value={e.subject}
                    onChange={(ev) => edit(url, { subject: ev.target.value })}
                    onBlur={() => save(url)}
                    aria-label={`Subject of the email to ${person.name}`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <textarea
                    value={e.text}
                    onChange={(ev) => edit(url, { text: ev.target.value })}
                    onBlur={() => save(url)}
                    aria-label={`Email to ${person.name}`}
                    rows={8}
                    className="resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {e.error && <span className="text-xs text-amber-600 dark:text-amber-400">{e.error}</span>}
                    {e.sentAt && e.busy !== "sending" && (
                      <span className="text-sm text-zinc-500">
                        Sent to inbox {new Date(e.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {state && (
                      <>
                        {e.drafted && !e.changed && e.busy !== "drafting" ? (
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Draft saved</span>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(e.busy)}
                            onClick={() => draft(url)}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            {e.busy === "drafting" ? "Saving…" : e.drafted ? "Update draft" : "Save as draft"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={Boolean(e.busy)}
                          onClick={() => send(url)}
                          title={`Sends to ${state.inbox}, not to ${person.name}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {e.busy === "sending" ? "Sending…" : "Send"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </PersonCard>
          );
        })}
      </div>
    </>
  );
}
