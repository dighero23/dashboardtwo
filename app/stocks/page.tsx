import { Metadata } from "next";
import StockTracker from "./StockTracker";

export const metadata: Metadata = {
  title: "Stock Tracker — Personal Dashboard",
};

export default function StocksPage() {
  return <StockTracker />;
}
