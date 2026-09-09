import { PurchasingView } from "@/features/commerce/purchasing-view";

export const metadata = {
  title: "Purchase Orders | Daily Command Center",
  description: "Purchase order management, inbound shipment tracking, and receiving status.",
};

export default function PurchasingPage() {
  return <PurchasingView />;
}
