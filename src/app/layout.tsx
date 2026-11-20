import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aegly", template: "%s · Aegly" },
  description: "Broneerimissüsteem teenusepakkujatele – broneeringud otse sinu kodulehel",
  appleWebApp: { capable: true, title: "Aegly", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1f2937" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="et" className="h-full antialiased">
      {/* suppressHydrationWarning: brauserilaiendused (nt ColorZilla) lisavad body-le atribuute */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
