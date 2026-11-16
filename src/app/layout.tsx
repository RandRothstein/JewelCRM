import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "JewelCRM · Jewellery CRM + ERM", description: "Showroom, customer, stock and growth operations for modern jewellers.", applicationName: "JewelCRM" };
export const viewport: Viewport = { themeColor: "#a97926" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
