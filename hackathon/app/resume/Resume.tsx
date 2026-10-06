"use client";

import { Document, Page, Text } from "@react-pdf/renderer";
import {
  Bullet,
  Section,
  Skill,
  Subsection,
  resumeStyles,
} from "./resume-components";
import type { ResumeData } from "./resume-types";

// Resume factory: renders any resume described by a ResumeData JSON.
export default function Resume({ data }: { data: ResumeData }) {
  return (
    <Document title={`${data.name} Resume`}>
      <Page size="LETTER" style={resumeStyles.page}>
        <Text style={resumeStyles.name}>{data.name}</Text>
        <Text style={resumeStyles.contact}>{data.contact}</Text>

        {data.sections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.type === "skills"
              ? section.skills.map((skill) => (
                  <Skill key={skill.label} label={skill.label}>
                    {skill.items}
                  </Skill>
                ))
              : section.entries.map((entry, i) => (
                  <Subsection
                    key={`${entry.title}-${i}`}
                    title={entry.title}
                    subtitle={entry.subtitle}
                    right={entry.right}
                  >
                    {entry.bullets.map((bullet, j) => (
                      <Bullet key={j}>{bullet}</Bullet>
                    ))}
                  </Subsection>
                ))}
          </Section>
        ))}
      </Page>
    </Document>
  );
}
