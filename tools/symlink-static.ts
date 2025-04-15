import { existsSync, mkdirSync, symlinkSync, readdirSync, lstatSync } from "fs";
import { join, resolve } from "path";

// Recursively symlink all non-.ts files from src/ into dist/, preserving structure
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function createSymlink(target: string, linkPath: string) {
  if (existsSync(linkPath)) {
    // Already exists (file or symlink)
    return;
  }
  symlinkSync(target, linkPath);
  console.log(`Created symlink: ${linkPath} -> ${target}`);
}

function symlinkStaticRecursive(srcDir: string, distDir: string) {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const distPath = join(distDir, entry.name);

    if (entry.isDirectory()) {
      ensureDir(distPath);
      symlinkStaticRecursive(srcPath, distPath);
    } else if (
      !entry.name.endsWith(".ts") && // skip TypeScript source
      !entry.name.endsWith(".map") // skip source maps
    ) {
      createSymlink(resolve(srcPath), distPath);
    }
  }
}

const distDir = "dist";
ensureDir(distDir);

// Symlink all static assets from src/ recursively (excluding .ts/.tsx/.map)
symlinkStaticRecursive("src", distDir);

console.log("Symlinking complete. All static assets from src/ are now linked in dist/.");
