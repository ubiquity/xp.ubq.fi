import { existsSync, mkdirSync, symlinkSync } from "fs";
import { join } from "path";

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function createSymlink(target: string, linkPath: string) {
  if (existsSync(linkPath)) {
    console.log(`Symlink or file already exists: ${linkPath}`);
    return;
  }
  symlinkSync(target, linkPath);
  console.log(`Created symlink: ${linkPath} -> ${target}`);
}

const distDir = "dist";
ensureDir(distDir);

const staticFiles = [
  { src: "../src/index.html", dest: "index.html" },
  { src: "../src/style.css", dest: "style.css" },
  // Add more static files here if needed
];

for (const { src, dest } of staticFiles) {
  createSymlink(src, join(distDir, dest));
}

console.log("Symlinking complete. You can now develop with static assets linked in dist/.");
