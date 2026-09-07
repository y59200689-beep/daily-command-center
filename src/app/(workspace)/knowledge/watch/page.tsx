import type { Metadata } from "next";
import { Watchlist } from "@/features/knowledge/watchlist";

export const metadata: Metadata = {
  title: "Watchlist · Knowledge",
  description: "Track competitors, markets, and external signals. Record your own sourced observations.",
};

export default function WatchPage() {
  return <Watchlist />;
}
