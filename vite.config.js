import { licenseBundleAudit } from "./scripts/license-policy.mjs";
export default {
  base: "./",
  esbuild: { jsx: "automatic" },
  build: { reportCompressedSize: true },
  plugins: [licenseBundleAudit()],
};
