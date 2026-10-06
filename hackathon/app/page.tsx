import { Bootstrap } from "@/components/Bootstrap";
import { ContentsRail } from "@/components/ContentsRail";
import { DocumentView } from "@/components/DocumentView";
import { FlowOverlay } from "@/components/FlowOverlay";
import { JobTabs } from "@/components/JobTabs";
import { SplitPane } from "@/components/SplitPane";
import { TopBar } from "@/components/TopBar";
import { AssistantPane } from "@/components/AssistantPane";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <Bootstrap />
      <SplitPane
        side="right"
        storageKey="tailor.assistantWidth"
        defaultSize={340}
        min={280}
        max={480}
        fixedClassName="hidden xl:flex"
        a={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TopBar />
            <JobTabs />
            <SplitPane
              side="left"
              storageKey="tailor.railWidth"
              defaultSize={240}
              min={180}
              max={420}
              fixedClassName="hidden lg:flex"
              a={<ContentsRail />}
              b={<DocumentView />}
            />
            <FlowOverlay />
          </div>
        }
        b={<AssistantPane />}
      />
    </div>
  );
}
