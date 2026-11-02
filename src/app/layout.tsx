import type { Metadata } from "next";
import "./globals.css";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.location.search.includes("synced=1")) {
                  const u = new URL(window.location.href);
                  u.searchParams.delete("synced");
                  window.history.replaceState({}, "", u.pathname + (u.search ? u.search : ""));
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
