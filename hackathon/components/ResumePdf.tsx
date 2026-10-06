"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeProfile } from "@/lib/resume-profile";
import type { GeneratedCV, JobTarget } from "@/lib/types";

const ACCENT = "#2563eb";
const INK = "#18181b";
const MUTED = "#52525b";
const RULE = "#e4e4e7";

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 42,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    color: INK,
    fontSize: 9,
    lineHeight: 1.35,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    letterSpacing: -0.3,
    color: INK,
  },
  contacts: {
    marginTop: 6,
    fontSize: 8.5,
    color: MUTED,
  },
  rule: {
    marginTop: 12,
    marginBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  headline: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: ACCENT,
    marginBottom: 6,
  },
  summary: {
    fontSize: 9,
    color: "#3f3f46",
    marginBottom: 11,
  },
  section: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 6,
  },
  skills: {
    fontSize: 8.8,
    color: INK,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3.5,
  },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ACCENT,
    marginTop: 5.5,
    marginRight: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.8,
    color: "#27272a",
    lineHeight: 1.3,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 2,
  },
  company: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: INK,
  },
  dates: {
    fontSize: 8,
    color: MUTED,
  },
  role: {
    fontSize: 8.2,
    color: MUTED,
    marginBottom: 2,
  },
  detail: {
    fontSize: 8.2,
    color: "#3f3f46",
    marginBottom: 2,
  },
  tailored: {
    marginTop: 2,
    fontSize: 8,
    color: "#a1a1aa",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#a1a1aa",
  },
});

function shorten(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cutoff = clean.lastIndexOf(" ", max - 1);
  return `${clean.slice(0, cutoff > max * 0.75 ? cutoff : max).trimEnd()}…`;
}

function experienceGroups(profile: ResumeProfile, cv: GeneratedCV) {
  const groups = new Map<
    string,
    { company: string; title: string; dates: string; bullets: string[] }
  >();

  for (const bullet of cv.bullets.slice(0, 6)) {
    const source = bullet.evidenceId
      ? profile.experienceByBulletId[bullet.evidenceId]
      : undefined;
    const company = source?.company ?? "Selected experience";
    const title = source?.title ?? "";
    const dates = source?.dates ?? "";
    const key = `${company}|${title}|${dates}`;
    const group = groups.get(key) ?? { company, title, dates, bullets: [] };
    group.bullets.push(shorten(bullet.text, 250));
    groups.set(key, group);
  }

  return [...groups.values()];
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function ResumePdf({
  profile,
  cv,
  job,
}: {
  profile: ResumeProfile;
  cv: GeneratedCV;
  job: JobTarget;
}) {
  return (
    <Document
      title={`${profile.name} — Resume`}
      author={profile.name}
      subject={job.title ? `Tailored for ${job.title}` : "Resume"}
      creator="Tailor"
    >
      <Page size="A4" style={styles.page} wrap={false}>
        <View>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.contacts.length > 0 && (
            <Text style={styles.contacts}>{profile.contacts.join("   ·   ")}</Text>
          )}
        </View>

        <View style={styles.rule} />

        <Text style={styles.headline}>{cv.headline}</Text>
        <Text style={styles.summary}>{shorten(cv.summary, 380)}</Text>

        {cv.skills.length > 0 && (
          <Section label="Skills">
            <Text style={styles.skills}>{cv.skills.slice(0, 12).join("  ·  ")}</Text>
          </Section>
        )}

        {cv.bullets.length > 0 && (
          <Section label="Experience">
            {experienceGroups(profile, cv).map((group, index) => (
              <View key={`${group.company}-${index}`} wrap={false}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.company}>{group.company}</Text>
                  {group.dates ? <Text style={styles.dates}>{group.dates}</Text> : null}
                </View>
                {group.title ? <Text style={styles.role}>{group.title}</Text> : null}
                {group.bullets.map((text, bulletIndex) => (
                  <View style={styles.bulletRow} key={`${index}-${bulletIndex}`}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </Section>
        )}

        {profile.education.length > 0 && (
          <Section label="Education">
            {profile.education.slice(0, 2).map((item, index) => (
              <Text style={styles.detail} key={index}>{shorten(item, 170)}</Text>
            ))}
          </Section>
        )}

        {profile.certifications.length > 0 && (
          <Section label="Certification">
            <Text style={styles.detail}>{profile.certifications.slice(0, 3).join(" · ")}</Text>
          </Section>
        )}

        <View style={styles.footer} fixed>
          <Text>{profile.name}</Text>
          {job.title ? <Text style={styles.tailored}>Tailored for {job.title}{job.company ? ` · ${job.company}` : ""}</Text> : <Text />}
        </View>
      </Page>
    </Document>
  );
}
