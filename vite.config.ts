import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackStart({ server: { entry: "server" } }), nitro(), react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    port: 8080,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "tanstack-vendor",
              test: /node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: "supabase-vendor",
              test: /node_modules[\\/](@supabase|@supabase-js)[\\/]/,
            },
            {
              name: "charts-vendor",
              test: /node_modules[\\/](recharts|victory)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
