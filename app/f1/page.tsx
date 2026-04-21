import type { Metadata } from "next";
import F1Module from "./F1Module";

export const metadata: Metadata = {
  title: "Formula 1 — JD Dashboard",
  description: "Race calendar, standings & results",
};

export default function F1Page() {
  return <F1Module />;
}
