// Browser smoke test (QA-03): drives ORBIT in a real Chromium-based browser through the demo-mode flows.
// Start the app in demo mode first, e.g. from the repo root:
//   ORBIT_DATABASE_URL=sqlite:///./e2e.db python scripts/dev.py --demo
// then: cd frontend && npm run e2e        (ORBIT_E2E_CHANNEL=chrome to use Chrome instead of Edge)
// It works on a temporary copy of examples/example-project and feeds the fake camera a video of marker #2.
import aruco from "js-aruco2";
import { chromium } from "playwright-core";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), "orbit-e2e-"));
const WORK = join(TMP, "example-project");
cpSync(resolve(HERE, "..", "..", "examples", "example-project"), WORK, { recursive: true });
writeFileSync(join(WORK, ".env"), "DEMO_SECRET=fake-but-hidden\n");
const SHOTS = join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.ORBIT_E2E_URL || "http://localhost:5173";
const CHANNEL = process.env.ORBIT_E2E_CHANNEL || "msedge";

/** A 1-second Y4M video of ArUco marker #2, for Chromium's fake camera. */
function markerVideo(id) {
  const dict = new aruco.AR.Dictionary("ARUCO_MIP_36h12");
  const bits = dict.codeList[id], size = dict.markSize - 2, cells = size + 4;
  const W = 640, H = 480, cell = 30, ox = (W - cells * cell) >> 1, oy = (H - cells * cell) >> 1;
  const Y = Buffer.alloc(W * H, 255);
  for (let cy = 1; cy < cells - 1; cy++) for (let cx = 1; cx < cells - 1; cx++) {
    const inner = cy > 1 && cy < cells - 2 && cx > 1 && cx < cells - 2;
    const v = inner && bits[(cy - 2) * size + (cx - 2)] === "1" ? 255 : 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) Y[(oy + cy * cell + y) * W + ox + cx * cell + x] = v;
  }
  const frame = Buffer.concat([Buffer.from("FRAME\n"), Y, Buffer.alloc((W * H) / 2, 128)]);
  const file = join(TMP, `marker${id}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`), ...Array(30).fill(frame)]));
  return file;
}

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, String(e).split("\n")[0].slice(0, 200)); } };

const browser = await chromium.launch({ channel: CHANNEL, headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${markerVideo(2)}`] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
const badResponses = [];
page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`); });
page.setDefaultTimeout(15000);

await step("local API token", async () => {
  check("direct API call without the token is rejected (401)", (await fetch("http://127.0.0.1:8000/api/memories")).status === 401);
  const cross = await fetch(`${BASE}/api/memories`, { headers: { "Sec-Fetch-Site": "cross-site", Origin: "http://evil.example" } });
  check("cross-site request through the dev proxy gets no token (401)", cross.status === 401);
  check("health stays public", (await fetch("http://127.0.0.1:8000/api/health")).status === 200);
});

await step("home", async () => {
  await page.goto(BASE);
  await page.getByText("Demo mode, no model").waitFor();
  check("home loads through the proxy with the demo badge", true);
  await page.keyboard.press("Tab");
  check("first Tab reaches the skip link", (await page.evaluate(() => document.activeElement?.textContent)) === "Skip to content");
});

await step("projects", async () => {
  await page.goto(`${BASE}/projects`);
  await page.getByLabel("Absolute folder path").fill(WORK);
  await page.getByRole("button", { name: "Authorize folder" }).click();
  await page.getByText("Project overview").waitFor();
  const files = await page.getByRole("navigation", { name: "Project files" }).textContent();
  check("authorized folder lists app.py and hides .env", files.includes("app.py") && !files.includes(".env"));
  await page.getByRole("navigation", { name: "Project files" }).getByRole("button", { name: /app\.py/ }).click();
  await page.getByText("demo-token-not-a-real-secret-1234").waitFor();
  check("file preview shows the file", true);

  await page.getByRole("button", { name: "Draft with AI" }).click();
  await page.getByLabel("Ask ORBIT to edit app.py").fill("Add a short module comment");
  await page.getByRole("button", { name: "Draft change" }).click();
  await page.getByText("AI draft", { exact: true }).first().waitFor();
  check("AI draft becomes a proposal with a diff", await page.getByText("ORBIT demo draft").first().isVisible());
  await page.getByRole("button", { name: "Reject" }).first().click();

  await page.getByLabel("Goal").fill("Explain how app.py greets people");
  await page.getByRole("button", { name: "Suggest files" }).first().click();
  await page.getByRole("checkbox", { name: /app\.py/ }).check();
  await page.getByRole("button", { name: "Run project agent" }).click();
  await page.getByText("Remember project context.").waitFor();
  check("project agent shows all five steps", (await page.getByText(/Read authorized files\.|Analyze\.|Draft notes\.|Propose the file\./).count()) === 4);
  check("nothing written before approval", !existsSync(join(WORK, "ORBIT_NOTES.md")));
  await page.getByRole("button", { name: "Review and approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve and write" }).click();
  await page.getByText("Write access is disabled").first().waitFor();
  check("approval is refused while write access is off", !existsSync(join(WORK, "ORBIT_NOTES.md")));
  await page.getByRole("button", { name: "Run project agent" }).click();
  await page.getByText("Remember project context.").waitFor();
  await page.getByRole("button", { name: "Allow writes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Allow writes" }).click();
  await page.getByRole("button", { name: "Turn off write access" }).waitFor();
  await page.getByRole("button", { name: "Review and approve" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve and write" }).click();
  await page.getByText("applied and verified").first().waitFor().catch(() => {});
  await page.getByRole("button", { name: /Show \d+ decided change/ }).click().catch(() => {});
  const notes = existsSync(join(WORK, "ORBIT_NOTES.md")) ? readFileSync(join(WORK, "ORBIT_NOTES.md"), "utf8") : "";
  check("approved notes file is written to disk", notes.startsWith("# Notes: Explain how app.py greets people"));
  await page.getByRole("button", { name: "Confirm memory" }).click();
  await page.getByText("Confirmed. ORBIT will use it").waitFor();
  check("agent memory suggestion can be confirmed", true);
  await page.screenshot({ path: join(SHOTS, "projects-1280.png"), fullPage: true });
});

await step("chat", async () => {
  await page.goto(`${BASE}/chat`);
  await page.getByLabel("Message").fill("Explain Kubernetes like I'm a beginner, then give me a diagram, real-world example, and interview questions.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Skill: learn_topic").waitFor();
  check("Kubernetes lesson routes to learn_topic and shows a diagram", await page.getByText("Diagram", { exact: true }).first().isVisible());
  await page.getByLabel("Message").fill("Plan how to launch my side project in 4 weeks");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Send to Tasks and Plans" }).click();
  await page.getByRole("button", { name: "Sent to Tasks and Plans" }).waitFor();
  await page.getByLabel("Message").fill("Describe the architecture of this project");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("Skill: project_overview").waitFor();
  check("project question with an active workspace routes to project_overview", true);
  await page.screenshot({ path: join(SHOTS, "chat-1280.png"), fullPage: true });
});

await step("tasks and memory", async () => {
  await page.goto(`${BASE}/tasks`);
  await page.getByText(/Proposed by ORBIT \(\d+\)/).waitFor();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Start" }).first().waitFor();
  check("proposed tasks can be approved", true);
  await page.goto(`${BASE}/memory`);
  await page.getByLabel("What should ORBIT remember?").fill("I deploy with Docker on Hetzner");
  await page.getByRole("button", { name: "Save memory" }).click();
  await page.getByText("I deploy with Docker on Hetzner").waitFor();
  await page.getByLabel("Filter by source").selectOption("suggested");
  check("memory filter shows agent suggestions only, without duplicates", (await page.getByText("I deploy with Docker on Hetzner").count()) === 0 && (await page.getByText(/\[example-project\]/).count()) === 1);
});

await step("visual learning", async () => {
  await page.goto(`${BASE}/visual`);
  await page.locator("canvas").first().waitFor();
  await page.getByText("Loading 3D scene…").waitFor({ state: "detached" });
  check("3D scene renders with WebGL (no error alert)", (await page.getByRole("alert").count()) === 0);
  await page.screenshot({ path: join(SHOTS, "visual-1280.png") });
  await page.getByRole("button", { name: "Load balancer" }).click();
  await page.getByRole("button", { name: "Explain more with AI" }).click();
  await page.getByText("Curated text (no model)").waitFor();
  check("component explanation is labeled curated in demo mode", true);
  await page.getByRole("button", { name: "Start camera" }).click();
  await page.getByText(/Camera on/).waitFor();
  check("camera starts with a visible indicator", true);
  await page.getByLabel("Detect printed markers").check();
  await page.getByText(/Marker #2 recognized/).waitFor({ timeout: 20000 });
  check("printed marker #2 seen by the camera switches to the serverless scene", (await page.getByRole("tab", { name: /Event-driven serverless/ }).getAttribute("aria-selected")) === "true");
  await page.screenshot({ path: join(SHOTS, "visual-marker.png") });
  await page.getByRole("button", { name: "Stop camera" }).click();
  await page.getByText("Camera is off. Nothing is being captured.").waitFor();
  check("stopping the camera turns it off", true);
  await page.goto(`${BASE}/visual/markers`);
  await page.getByText("Marker #2").waitFor();
  check("markers page shows two printable markers", (await page.locator("figure svg").count()) === 2);
});

await step("responsive layout", async () => {
  const routes = ["/", "/chat", "/projects", "/visual", "/memory", "/skills", "/tasks", "/settings"];
  const overflow = [];
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const r of routes) {
      await page.goto(BASE + r);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      const wide = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
      if (wide > 0) overflow.push(`${r}@${width}:+${wide}px`);
      if (width === 360) await page.screenshot({ path: join(SHOTS, `m${r.replace(/\//g, "_") || "_home"}-360.png`), fullPage: true });
    }
  }
  check("no horizontal page scroll at 360, 768 and 1280 px on any screen", overflow.length === 0, overflow.join(", "));
  await page.setViewportSize({ width: 1280, height: 860 });
});

// The refused approval (write access off) is a deliberate 403; the browser logs every failed request as an error.
const expected = (r) => /^403 POST \/api\/changes\/\d+\/approve$/.test(r);
console.log("HTTP errors seen:", badResponses.join(", ") || "none");
check("no unexpected HTTP errors or console errors", badResponses.filter((r) => !expected(r)).length === 0 && consoleErrors.filter((e) => !e.includes("403")).length === 0, consoleErrors.filter((e) => !e.includes("403")).slice(0, 3).join(" | ").slice(0, 300));

await step("webgl disabled", async () => {
  const b2 = await chromium.launch({ channel: CHANNEL, headless: true, args: ["--disable-webgl", "--disable-3d-apis"] });
  const p2 = await (await b2.newContext()).newPage();
  await p2.goto(`${BASE}/visual`);
  await p2.getByRole("alert").waitFor();
  check("without WebGL the studio shows a clear message", (await p2.getByRole("alert").textContent()).includes("may not support WebGL"));
  await b2.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
