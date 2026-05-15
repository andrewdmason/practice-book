import { JournalHeader } from "@/components/journal/header";
import { TimezoneProvider } from "@/components/timezone-provider";
import { AgentChatProvider } from "@/components/journal/agent-chat-context";
import { AgentChatSidebar } from "@/components/journal/agent-chat-sidebar";
import { latestAgentChatAt } from "@/app/(journal)/journal/actions";

export default async function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLatestAt = await latestAgentChatAt();
  return (
    <AgentChatProvider initialLatestAt={initialLatestAt}>
      <div className="flex min-h-full flex-1 flex-col">
        <TimezoneProvider />
        <JournalHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <AgentChatSidebar />
      </div>
    </AgentChatProvider>
  );
}
