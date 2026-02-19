import ReportChatAgent from "@/components/ReportChatAgent";

export default function ReportAgent() {
  return (
    <div className="space-y-6">
      <h1 className="font-bold text-foreground text-4xl">Agent Train</h1>
      <ReportChatAgent
        title="Agent Train"
        description="Generate live training reports and search training data using your role-based access scope." />

    </div>);

}