import { MeetingCapture } from "@/features/v4/meeting-capture";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <div className="domain-page"><header className="page-header"><div><p className="eyebrow">Meeting</p><h1>Capture outcome</h1><p>Review each outcome before creating selected records in your workspace.</p></div></header><MeetingCapture eventId={(await params).id}/></div>;
}
