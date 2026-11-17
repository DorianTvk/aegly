import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aegly", template: "%s · Aegly" },
  description: "Broneerimistarkvara ilu- ja heaolusalongidele",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="et" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
