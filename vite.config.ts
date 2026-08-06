// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    router: { routeFileIgnorePattern: "\\.test\\.tsx?$" },
  },
  vite: {
    server: {
      port: 8087,
    },
    preview: {
      port: 8087,
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://ueazjqvxjlppgtkhcmut.supabase.co"),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYXpqcXZ4amxwcGd0a2hjbXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDg2MjgsImV4cCI6MjA5OTc4NDYyOH0.jyJjCPse3Woz3ghOs3exBEGMImG7SSsa69BTlCvVx50"),
    },
  },
});
