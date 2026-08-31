import type { Metadata } from "next";
import { Matchmaker } from "@/components/matchmaker";
import { getLiveVehicles } from "@/lib/matchmaker-vehicles";

export const metadata: Metadata = {
  title: "Vehicle Matchmaker — LEVR Auto",
  description: "Answer a few quick questions and get matched with vehicles worth searching for.",
};

export default async function MatchmakerPage() {
  const vehicles = await getLiveVehicles();
  return <Matchmaker vehicles={vehicles} />;
}
