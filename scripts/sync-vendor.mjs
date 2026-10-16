// Copies third-party runtime files the page loads from /vendor. Run after `npm install`.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("vendor", { recursive: true });
copyFileSync("node_modules/gsap/dist/gsap.min.js", "vendor/gsap.min.js");
console.log("vendor/gsap.min.js updated");
