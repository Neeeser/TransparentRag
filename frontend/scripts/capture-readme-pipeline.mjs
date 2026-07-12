import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const PROCESS_MS = 550;
const TRAVEL_MS = 400;
const HOLD_MS = 800;
const PORT = 3417;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(frontendDir, "..");
const fixturePath = path.join(frontendDir, "src/components/readme/readme-pipelines.generated.json");
const assetDir = path.join(repoRoot, "docs/assets");
const gifPath = path.join(assetDir, "pipeline-flow.gif");
const posterPath = path.join(assetDir, "pipeline-flow.png");

export const captureDurationMs = (stepCount) =>
  stepCount * PROCESS_MS + Math.max(0, stepCount - 1) * TRAVEL_MS + HOLD_MS;

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed.`);
  }
  return result.stdout.trim();
};

const waitForServer = async (url, server) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Next.js exited before capture started.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the README capture page.");
};

const probeDuration = (videoPath) =>
  Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]),
  );

const recordScene = async (browser, kind, tempDir, capturePoster) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: "dark",
    reducedMotion: "no-preference",
    recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(`http://127.0.0.1:${PORT}/readme-pipeline-capture?kind=${kind}`);
  const capture = page.locator(`[data-readme-capture="${kind}"]`);
  await capture.waitFor();
  await page
    .locator("nextjs-portal")
    .evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  const stepCount = Number(await capture.getAttribute("data-step-count"));
  if (!Number.isInteger(stepCount) || stepCount < 1) {
    throw new Error(`Invalid playback step count for ${kind}.`);
  }
  await page.waitForTimeout(700);
  if (capturePoster) await capture.screenshot({ path: posterPath });
  await page.waitForTimeout(captureDurationMs(stepCount));
  await context.close();
  if (!video) throw new Error(`Playwright did not record the ${kind} scene.`);
  return video.path();
};

const encodeAnimation = (ingestionVideo, retrievalVideo, tempDir) => {
  const combinedPath = path.join(tempDir, "pipeline-flow.mp4");
  const fadeSeconds = 0.35;
  const fadeOffset = Math.max(0, probeDuration(ingestionVideo) - fadeSeconds);
  run("ffmpeg", [
    "-y",
    "-i",
    ingestionVideo,
    "-i",
    retrievalVideo,
    "-filter_complex",
    `[0:v]fps=10,drawbox=x=0:y=ih-80:w=100:h=80:color=0x05060a:t=fill,format=yuv420p[v0];[1:v]fps=10,drawbox=x=0:y=ih-80:w=100:h=80:color=0x05060a:t=fill,format=yuv420p[v1];[v0][v1]xfade=transition=fade:duration=${fadeSeconds}:offset=${fadeOffset}[v]`,
    "-map",
    "[v]",
    "-an",
    combinedPath,
  ]);
  run("ffmpeg", [
    "-y",
    "-i",
    combinedPath,
    "-filter_complex",
    "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop",
    "0",
    gifPath,
  ]);
};

const main = async () => {
  run("ffmpeg", ["-version"]);
  run("uv", ["run", "python", "-m", "scripts.export_readme_pipelines", "--output", fixturePath], {
    cwd: repoRoot,
  });
  run("npx", ["prettier", "--write", fixturePath], { cwd: frontendDir });

  const tempDir = await mkdtemp(path.join(tmpdir(), "ragworks-readme-"));
  const server = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
    cwd: frontendDir,
    env: { ...process.env, README_CAPTURE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/readme-pipeline-capture`, server);
    const browser = await chromium.launch();
    try {
      const ingestionVideo = await recordScene(browser, "ingestion", tempDir, true);
      const retrievalVideo = await recordScene(browser, "retrieval", tempDir, false);
      encodeAnimation(ingestionVideo, retrievalVideo, tempDir);
    } finally {
      await browser.close();
    }
    const { size } = await stat(gifPath);
    if (size > MAX_ASSET_BYTES) {
      throw new Error(`Generated GIF is ${(size / 1024 / 1024).toFixed(1)} MB; limit is 8 MB.`);
    }
    process.stdout.write(
      `Updated ${path.relative(repoRoot, gifPath)} and poster (${size} bytes).\n`,
    );
  } catch (error) {
    if (serverOutput) process.stderr.write(serverOutput);
    throw error;
  } finally {
    server.kill("SIGTERM");
    await rm(tempDir, { recursive: true, force: true });
  }
};

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
