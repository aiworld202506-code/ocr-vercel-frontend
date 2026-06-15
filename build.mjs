import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(frontendDir, "src");
const outputDir = resolve(frontendDir, "dist");
const configuredApiUrl = process.env.OCR_API_BASE_URL || "";
let apiBaseUrl = "";

try {
  const parsedApiUrl = new URL(configuredApiUrl);
  if (
    parsedApiUrl.protocol !== "https:" ||
    parsedApiUrl.username ||
    parsedApiUrl.password ||
    parsedApiUrl.pathname !== "/" ||
    parsedApiUrl.search ||
    parsedApiUrl.hash
  ) {
    throw new Error("not an HTTPS origin");
  }
  apiBaseUrl = parsedApiUrl.origin;
} catch {
  throw new Error(
    "OCR_API_BASE_URL must be a public HTTPS origin with no path, " +
    "for example https://ocr-api.example.com"
  );
}

await rm(outputDir, { recursive: true, force: true });
const staticOutputDir = resolve(outputDir, "static");
await mkdir(staticOutputDir, { recursive: true });
await cp(sourceDir, staticOutputDir, { recursive: true, force: true });

const sourceIndexPath = resolve(staticOutputDir, "index.html");
const indexHtml = await readFile(sourceIndexPath, "utf8");
const configuredHtml = indexHtml.replace(
  '<meta name="api-base-url" content="">',
  `<meta name="api-base-url" content="${apiBaseUrl}">`
);
await writeFile(resolve(outputDir, "index.html"), configuredHtml, "utf8");
await rm(sourceIndexPath);

console.log(`Built frontend for ${apiBaseUrl}`);
