"use client";

import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

const INK = "#000000";
const RULE = "#9b9b9b";

export const resumeStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.3,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    textAlign: "center",
  },
  contact: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 3,
  },

  // Section
  section: { marginTop: 13 },
  sectionTitle: { fontSize: 11 },
  sectionRule: {
    marginTop: 2,
    marginBottom: 6,
    borderBottomWidth: 0.7,
    borderBottomColor: RULE,
  },

  // Skill
  skill: { fontSize: 10, marginBottom: 3 },

  // Subsection
  subsection: { marginBottom: 8 },
  subsectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  subsectionTitle: { fontSize: 10.5 },
  subsectionRight: { fontSize: 10.5 },

  // Bullet
  bulletRow: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 3 },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: INK,
    marginTop: 4,
    marginRight: 6,
  },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.3 },

  bold: { fontFamily: "Helvetica-Bold" },
});

// A titled section with a rule underneath (Skills, Experience, Projects).
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={resumeStyles.section}>
      <Text style={resumeStyles.sectionTitle}>{title}</Text>
      <View style={resumeStyles.sectionRule} />
      {children}
    </View>
  );
}

// A skill line: bold label followed by a comma list (Languages, Tools).
export function Skill({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Text style={resumeStyles.skill}>
      <Text style={resumeStyles.bold}>{label} </Text>
      {children}
    </Text>
  );
}

// A job/project: bold title (+ optional normal subtitle), a right-aligned date
// or link, and bullet-point children.
export function Subsection({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  children?: ReactNode;
}) {
  return (
    <View style={resumeStyles.subsection}>
      <View style={resumeStyles.subsectionHeader}>
        <Text style={resumeStyles.subsectionTitle}>
          <Text style={resumeStyles.bold}>{title}</Text>
          {subtitle ? <Text>{`, ${subtitle}`}</Text> : null}
        </Text>
        {right ? <Text style={resumeStyles.subsectionRight}>{right}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// A single hanging-indent bullet point.
export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={resumeStyles.bulletRow}>
      <View style={resumeStyles.bulletDot} />
      <Text style={resumeStyles.bulletText}>{children}</Text>
    </View>
  );
}
