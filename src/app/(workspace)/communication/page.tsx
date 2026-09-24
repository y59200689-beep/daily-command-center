import { CommunicationCenter } from "@/features/v4/action-centers";
import { CommunicationExtractor } from "@/features/founder-os/communication-extractor";
export const metadata = { title: "Communication" };
export default function Page() {
  return (
    <>
      <CommunicationCenter />
      <CommunicationExtractor />
    </>
  );
}

