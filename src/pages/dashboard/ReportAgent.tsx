import ReportChatAgent from "@/components/ReportChatAgent";

export default function ReportAgent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Agent Train</h1>
      <ReportChatAgent
        description="Generate live training reports and search training data using your role-based access scope." />

    </div>);

}
