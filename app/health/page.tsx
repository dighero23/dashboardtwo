import type { Metadata } from "next";
import HealthModule from "./HealthModule";

export const metadata: Metadata = {
  title: "Health — JD Dashboard",
  description: "Family health events & appointments",
};

export default function HealthPage() {
  return <HealthModule />;
}
