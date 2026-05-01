import fs from "fs";
import path from "path";

// paths
const examplePath = "example/index.html";
const distPath = "dist/index.html";

// read file
let html = fs.readFileSync(examplePath, "utf-8");

// replace import path
html = html.replace(
  'import "../src/gestro-image.js";',
  'import "./gestro-image.esm.js";'
);

// ensure dist exists
fs.mkdirSync("dist", { recursive: true });

// write modified file
fs.writeFileSync(distPath, html);

console.log("✔ example/index.html copied and transformed to dist/");