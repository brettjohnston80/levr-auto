import type { Metadata } from "next";
import { Matchmaker } from "@/components/matchmaker";

export const metadata: Metadata = {
  title: "Vehicle Matchmaker — LEVR Auto",
  description: "Answer a few quick questions and get matched with vehicles worth searching for.",
};

export default function MatchmakerPage() {
  return <Matchmaker />;
}
