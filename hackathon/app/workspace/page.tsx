import { DocumentView } from "@/components/DocumentView";
import { FlowOverlay } from "@/components/FlowOverlay";
import { JobTabs } from "@/components/JobTabs";
import { AssistantPane } from "@/components/AssistantPane";

export default function ResumeWorkspace() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <JobTabs />
        <DocumentView />
        <FlowOverlay />
      </main>
      <AssistantPane />
    </div>
  );
}
