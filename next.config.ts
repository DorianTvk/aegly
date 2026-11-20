import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // logo ja bänneri üleslaadimine (kuni 2 MB pilt + vormi andmed)
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Turvapäised. Halduspaneeli ja kliendi lehti ei tohi teise lehe sisse (iframe) panna;
  // vidin (/w/…) peab aga töötama salongi/ettevõtte enda kodulehel.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
      {
        source: "/((?!w/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com https://connect.stripe.com" },
        ],
      },
      {
        source: "/w/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *; base-uri 'self'" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Sentry: lähtekoodi kaardid laetakse üles ainult siis, kui SENTRY_AUTH_TOKEN on olemas
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  telemetry: false,
});
