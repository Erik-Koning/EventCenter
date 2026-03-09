import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = localFont({
  src: [
    { path: "../../public/fonts/Inter-Variable.woff2", style: "normal" },
    { path: "../../public/fonts/Inter-Variable-Italic.woff2", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Convene",
  description: "Hub for your Events and Conventions",
  icons: {
    icon: "/scotia_logo.png",
  }
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
