"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeProfile } from "@/lib/resume-profile";
import type { GeneratedCV, JobTarget } from "@/lib/types";

const INK = "#111111";
const MUTED = "#333333";

const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 34,
    paddingHorizontal: 43,
    fontFamily: "Times-Roman",
    color: INK,
    fontSize: 9.2,
    lineHeight: 1.16,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 18,
    lineHeight: 1.25,
    textAlign: "center",
  },
  contacts: {
    marginTop: 7,
    fontSize: 8.5,
    lineHeight: 1.2,
    textAlign: "center",
    color: MUTED,
  },
  summary: {
    marginTop: 0,
    marginBottom: 7,
    fontSize: 9.2,
    lineHeight: 1.17,
  },
  section: {
    marginBottom: 7,
  },
  sectionLabel: {
    fontFamily: "Times-Bold",
    fontSize: 10.6,
    marginBottom: 2.5,
  },
  skills: {
    fontSize: 9,
    lineHeight: 1.16,
  },
  experience: {
    marginBottom: 4,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 0.5,
  },
  company: {
    fontFamily: "Times-Bold",
    fontSize: 9.4,
    flexShrink: 1,
  },
  location: {
    fontSize: 9.2,
    flexShrink: 1,
  },
  dates: {
    fontSize: 9.2,
  },
  role: {
    fontFamily: "Times-Italic",
    fontSize: 9,
    marginBottom: 1,
  },
  bulletRow: {
    flexDirection: "row",
    marginLeft: 14,
    marginBottom: 1,
  },
  bulletDot: {
    width: 8,
    fontSize: 9,
    marginRight: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.2,
    lineHeight: 1.16,
  },
  detail: {
    fontSize: 9,
    lineHeight: 1.16,
    marginBottom: 1,
  },
});

function experienceGroups(profile: ResumeProfile, cv: GeneratedCV) {
  const groups = new Map<
    string,
    { company: string; location: string; title: string; dates: string; bullets: string[] }
  >();

  for (const bullet of cv.bullets) {
    const source = bullet.evidenceId
      ? profile.experienceByBulletId[bullet.evidenceId]
      : undefined;
    const company = source?.company ?? "Selected experience";
    const location = source?.location ?? "";
    const title = source?.title ?? "";
    const dates = source?.dates ?? "";
    const key = `${company}|${location}|${title}|${dates}`;
    const group = groups.get(key) ?? { company, location, title, dates, bullets: [] };
    group.bullets.push(bullet.text.replace(/\s+/g, " ").trim());
    groups.set(key, group);
  }

  const monthIndex: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const startDate = (value: string) => {
    const match = value.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(19|20)\d{2}/i);
    if (!match) return 0;
    const year = Number(value.slice(match.index! + match[0].length - 4, match.index! + match[0].length));
    return year * 12 + (monthIndex[match[1].slice(0, 3).toLowerCase()] ?? 0);
  };
  return [...groups.values()].sort((a, b) => startDate(b.dates) - startDate(a.dates));
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
  const groups = experienceGroups(profile, cv);
  const skills = cv.skills.slice(0, 14);

  return (
    <Document
      title={`${profile.name} - Resume`}
      author={profile.name}
      subject={job.title ? `Tailored for ${job.title}` : "Resume"}
      creator="Tailor"
    >
      <Page size="LETTER" style={styles.page}>
        <View>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.contacts.length > 0 && (
            <Text style={styles.contacts}>{profile.contacts.join(" | ")}</Text>
          )}
        </View>

        {cv.summary && (
          <Section label="Summary">
            <Text style={styles.summary}>{cv.summary.replace(/\s+/g, " ").replace(/↔/g, "and").trim()}</Text>
          </Section>
        )}

        {groups.length > 0 && (
          <Section label="Work Experience">
            {groups.map((group, index) => (
              <View key={`${group.company}-${index}`} style={styles.experience} wrap={false}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.company}>
                    {group.company}
                    {group.location ? <Text style={styles.location}> | {group.location}</Text> : null}
                  </Text>
                  {group.dates ? <Text style={styles.dates}> | {group.dates}</Text> : null}
                </View>
                {group.title ? <Text style={styles.role}>{group.title}</Text> : null}
                {group.bullets.map((text, bulletIndex) => (
                  <View style={styles.bulletRow} key={`${index}-${bulletIndex}`}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </Section>
        )}

        {profile.education.length > 0 && (
          <Section label="Education">
            {profile.education.slice(0, 3).map((item, index) => (
              <Text style={styles.detail} key={index}>{item}</Text>
            ))}
          </Section>
        )}

        {skills.length > 0 && (
          <Section label="Technical Skills">
            <Text style={styles.skills}>{skills.join(", ")}</Text>
          </Section>
        )}

        {profile.certifications.length > 0 && (
          <Section label="Certifications">
            <Text style={styles.detail}>{profile.certifications.slice(0, 3).join("; ")}</Text>
          </Section>
        )}
      </Page>
    </Document>
  );
}
