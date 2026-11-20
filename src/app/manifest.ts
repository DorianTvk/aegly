import type { MetadataRoute } from "next";

/** "Lisa avakuvale" – tahvlil/telefonis avaneb Aegly täisekraanis nagu rakendus */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aegly",
    short_name: "Aegly",
    description: "Broneerimissüsteem teenusepakkujatele",
    start_url: "/toolaud",
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#1f2937",
    lang: "et",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vastuvõtt", url: "/vastuvott" },
      { name: "Kalender", url: "/kalender" },
      { name: "Uus broneering", url: "/broneeringud/uus" },
    ],
  };
}
