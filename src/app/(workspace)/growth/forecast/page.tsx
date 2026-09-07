import type { Metadata } from "next";
import { GrowthForecast } from "@/features/growth/growth-forecast";
export const metadata: Metadata = { title: "Growth · Forecast" };
export default function GrowthForecastPage() { return <GrowthForecast />; }
