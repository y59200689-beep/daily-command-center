import { TripDetail } from "@/features/life/trip-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <TripDetail id={(await params).id} />; }
