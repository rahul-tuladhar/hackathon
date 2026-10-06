"use client";

import dynamic from "next/dynamic";
import { Group, Panel, Separator } from "react-resizable-panels";
import ExperienceForm from "./ExperienceForm";

// PDFViewer touches browser-only APIs, so load the preview client-side only.
const ResumePreview = dynamic(() => import("./ResumePreview"), { ssr: false });

export default function ResumePage() {
  return (
    <div className="flex min-h-0 flex-1">
      <Group orientation="horizontal" className="h-full w-full">
        <Panel defaultSize="50%" minSize="25%" className="overflow-y-auto">
          <div className="p-6">
            <ExperienceForm />
          </div>
        </Panel>

        <Separator className="w-px bg-zinc-200 dark:bg-zinc-800" />

        <Panel minSize="30%" className="min-w-0">
          <ResumePreview />
        </Panel>
      </Group>
    </div>
  );
}
