import { MeetingCapture } from "@/features/v4/meeting-capture";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="domain-page">
      <header className="task-context-header">
        <div>
          <nav className="task-context-header__breadcrumb" aria-label="Breadcrumb">
            <span>Operate</span>
            <span>/</span>
            <span className="current">Meeting Capture</span>
          </nav>
          <div className="task-context-header__title-row">
            <h1>Capture outcome</h1>
          </div>
          <p className="task-context-header__description">
            Review each outcome before creating selected records in your workspace.
          </p>
        </div>
      </header>
      <MeetingCapture eventId={(await params).id}/>
    </div>
  );
}
