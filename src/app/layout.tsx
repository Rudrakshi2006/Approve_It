import type { Metadata } from "next";
import "./globals.css";
import { DevRoleBar } from "@/components/DevRoleBar";

export const metadata: Metadata = {
  title: "ApproveIt",
  description: "Paperless multi-step approvals with digital verification and live tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">
        <DevRoleBar />
        {children}
      </body>
    </html>
  );
}
