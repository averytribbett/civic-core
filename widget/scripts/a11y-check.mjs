import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const axeSource = await readFile(axePath, "utf8");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetRoot = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const rel = urlPath === "/" ? "/demo.html" : urlPath;
        const filePath = path.join(widgetRoot, rel.replace(/^\//, ""));
        if (!filePath.startsWith(widgetRoot)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        const body = await readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function runAxe(page, label) {
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
  });
  const violations = results.violations || [];
  if (violations.length) {
    console.error(`\n[${label}] ${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`  - ${v.id}: ${v.help} (${v.impact})`);
      for (const node of v.nodes.slice(0, 3)) {
        console.error(`      ${node.html}`);
      }
    }
  } else {
    console.log(`[${label}] No WCAG 2.1 AA violations found.`);
  }
  return violations;
}

async function main() {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    console.error("Install devDependencies first: yarn install");
    process.exit(1);
  }

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  let browser;
  try {
    browser = await puppeteer.default.launch({ headless: true });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/Could not find Chrome/i.test(msg)) {
      console.error(
        "Chrome for Puppeteer is missing. Install it once, then re-run:\n" +
          "  yarn puppeteer browsers install chrome\n" +
          "  yarn test:a11y"
      );
      process.exit(1);
    }
    throw err;
  }
  const page = await browser.newPage();

  let allViolations = [];

  try {
    await page.goto(`${base}/demo.html`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".civiccore-widget-btn", { timeout: 5000 });
    allViolations = allViolations.concat(await runAxe(page, "demo launcher"));

    await page.click(".civiccore-widget-btn");
    await page.waitForFunction(() => {
      const iframe = document.querySelector("iframe");
      return iframe && iframe.style.display !== "none";
    }, { timeout: 5000 });

    const iframeHandle = await page.$("iframe");
    const frame = await iframeHandle?.contentFrame();
    if (frame) {
      await frame.waitForSelector("#chat", { timeout: 5000 });
      allViolations = allViolations.concat(
        await runAxe(frame, "chat shell (iframe)")
      );
    } else {
      console.error("[chat shell] Could not access iframe content.");
      allViolations.push({ id: "iframe-access" });
    }

    await page.goto(`${base}/app/widget.html`, { waitUntil: "networkidle0" });
    allViolations = allViolations.concat(await runAxe(page, "widget shell standalone"));
  } finally {
    await browser.close();
    server.close();
  }

  if (allViolations.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
