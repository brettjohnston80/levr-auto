import type { Metadata } from "next";
import { Matchmaker } from "@/components/matchmaker";
import { getLiveVehicleDataUpdatedAt, getLiveVehicles } from "@/lib/matchmaker-vehicles";

export const metadata: Metadata = {
  title: "Vehicle Matchmaker — LEVR Auto",
  description: "Answer a few quick questions and get matched with vehicles worth searching for.",
};

export default async function MatchmakerPage() {
  const [vehicles, dataUpdatedAt] = await Promise.all([getLiveVehicles(), getLiveVehicleDataUpdatedAt()]);
  return <Matchmaker vehicles={vehicles} dataUpdatedAt={dataUpdatedAt} />;
}
