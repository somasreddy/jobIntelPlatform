import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Radar | Demand, Salary & Skills Intelligence",
  description:
    "Track live demand for your target role, benchmark salary percentiles against the market, and see which skills are trending or declining for your profile.",
};

export default function MarketRadarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
