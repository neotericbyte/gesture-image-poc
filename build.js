import { build } from "esbuild";

await build({
  entryPoints: ["src/gestro-image.js"],
  outfile: "dist/gestro.esm.js",
  bundle: true,
  format: "esm",
  minify: true,
  treeShaking: true,
});

await build({
  entryPoints: ["src/gestro-image.js"],
  outfile: "dist/gestro.umd.js",
  bundle: true,
  format: "iife",
  minify: true,
  treeShaking: true,
});