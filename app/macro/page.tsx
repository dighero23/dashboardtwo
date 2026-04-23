import type { Metadata } from "next";
import MacroPulse from "./MacroPulse";

export const metadata: Metadata = {
  title: "Macro Pulse — JD Dashboard",
  description: "Economic indicators & market events",
};

export default function MacroPage() {
  return <MacroPulse />;
}
