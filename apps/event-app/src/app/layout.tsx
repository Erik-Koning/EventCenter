import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Executive Leadership Offsite 2026",
  description: "3-day executive offsite event planner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
