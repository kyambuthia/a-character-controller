#!/usr/bin/env node
// Headless probe for the active ragdoll standing/walking baseline.
//
// Launches the vite dev server, opens the demo in headless Chrome with
// ?player=ragdoll&debug=1&scenario=<scenario>, and samples
// window.__characterCtrlrActiveRagdollDebug over time so standing/gait
// behavior can be judged quantitatively instead of by eye.
//
// Usage:
//   node scripts/probe-active-ragdoll.mjs [--scenario spawn_idle_stability]
//       [--duration 8] [--interval 0.15] [--port 5199] [--player ragdoll]
//       [--shove x,y,z] [--shoveAt 4] [--query key=value&key2=value2]
//
// Exit code 0 means the probe ran (regardless of pass/fail verdict).

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((arg, index, all) => {
    if (arg.startsWith("--")) {
      return [arg.slice(2), all[index + 1] ?? ""];
    }
    return [arg, true];
  }),
);
const SCENARIO = ARGS.scenario ?? "spawn_idle_stability";
const DURATION_SECONDS = Number(ARGS.duration ?? 8);
const SAMPLE_INTERVAL_MS = Number(ARGS.interval ?? 0.15) * 1000;
const PORT = Number(ARGS.port ?? 5198);
const PLAYER = ARGS.player ?? "ragdoll";
// Optional push: --shove x,y,z (whole-body velocity change in m/s, z is forward) applied --shoveAt seconds in.
const SHOVE = ARGS.shove ? String(ARGS.shove).split(",").map(Number) : null;
const SHOVE_AT_SECONDS = Number(ARGS.shoveAt ?? 4);
// Extra URL parameters for the demo, e.g. --query skin=boxes or --query arena=flat&skin=boxes.
const EXTRA_QUERY = ARGS.query ? `&${ARGS.query}` : "";
const DEV_URL = `http://127.0.0.1:${PORT}/?player=${PLAYER}&debug=1&scenario=${SCENARIO}${EXTRA_QUERY}`;
const BASE_FLAGS = [
  "--headless=new",
  "--disable-gpu",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-default-apps",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1280,800",
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener(
        "error",
        (event) => reject(event.error ?? new Error("WebSocket connection failed")),
        { once: true },
      );
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
          return;
        }
        pending.resolve(message.result ?? {});
        return;
      }
      const handlers = this.listeners.get(message.method);
      if (!handlers) return;
      for (const handler of handlers) handler(message.params ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (!this.ws) return;
    this.ws.close();
    await sleep(50);
  }
}

async function waitForDebuggerTarget(port, expectedUrl, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const pageTarget = targets.find(
        (target) => target.type === "page" && String(target.url).startsWith(expectedUrl),
      );
      if (pageTarget?.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome may not have opened its debugging endpoint yet.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for debugger target for ${expectedUrl}`);
}

async function waitForSceneReady(cdp) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.bringToFront");

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const readyState = await cdp.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    });
    const title = await cdp.send("Runtime.evaluate", {
      expression: "document.title",
      returnByValue: true,
    });
    const debugState = await cdp.send("Runtime.evaluate", {
      expression: "window.__characterCtrlrActiveRagdollDebug !== undefined",
      returnByValue: true,
    });
    if (
      readyState.result?.value === "complete"
      && String(title.result?.value).includes("CharacterCtrlr")
      && debugState.result?.value === true
    ) {
      break;
    }
    await sleep(200);
  }
  await sleep(800);
}

function compactSample(debug) {
  if (!debug) return null;
  const jointError = (side) => {
    const angles = debug.legJointAngles ?? {};
    const targets = debug.legJointTargets ?? {};
    return (
      Math.abs((angles[`knee${side}`] ?? 0) - (targets[`knee${side}`] ?? 0))
      + Math.abs((angles[`hip${side}`] ?? 0) - (targets[`hip${side}`] ?? 0))
    ).toFixed(3);
  };
  const com = debug.centerOfMass ?? [];
  return {
    t: (debug.__probeT ?? 0).toFixed(2),
    grounded: debug.grounded ? "Y" : "N",
    support: debug.supportState ?? "?",
    recovery: debug.recoveryState ?? "?",
    mode: debug.movementMode ?? "?",
    gait: debug.gaitPhase ?? "?",
    contacts: `${debug.leftSupportContacts ?? 0}/${debug.rightSupportContacts ?? 0}`,
    rootY: debug.__probeRootY != null ? debug.__probeRootY.toFixed(2) : "-",
    hErr: debug.supportHeightError != null ? debug.supportHeightError.toFixed(3) : "-",
    latErr: debug.supportLateralError != null ? debug.supportLateralError.toFixed(3) : "-",
    fwdErr: debug.supportForwardError != null ? debug.supportForwardError.toFixed(3) : "-",
    yawErr: debug.yawError != null ? debug.yawError.toFixed(3) : "-",
    urgency: debug.captureUrgency != null ? debug.captureUrgency.toFixed(2) : "-",
    kerrL: jointError("Left"),
    kerrR: jointError("Right"),
    comY: com[1] != null ? com[1].toFixed(2) : "-",
    warnings: (debug.warnings ?? []).join(",") || "-",
  };
}

async function main() {
  const devServer = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { detached: true, stdio: "ignore" },
  );
  const profileDir = mkdtempSync(join(tmpdir(), "character-ctrlr-probe-"));
  let chrome = null;
  const killProcessGroup = (child) => {
    if (!child || child.pid === undefined) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  };

  try {
    // Wait for the dev server to accept requests.
    let serverReady = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/`);
        if (response.ok) {
          serverReady = true;
          break;
        }
      } catch {
        // not up yet
      }
      await sleep(250);
    }
    if (!serverReady) {
      throw new Error(`Vite dev server did not come up on port ${PORT}`);
    }

    chrome = spawn(
      "google-chrome",
      [
        ...BASE_FLAGS,
        "--remote-debugging-port=9224",
        `--user-data-dir=${profileDir}`,
        DEV_URL,
      ],
      { stdio: "ignore" },
    );

    const wsUrl = await waitForDebuggerTarget(9224, DEV_URL);
    const cdp = new CdpSession(wsUrl);
    await cdp.connect();

    try {
      await waitForSceneReady(cdp);
      console.log(`Probe: scenario=${SCENARIO} player=${PLAYER} duration=${DURATION_SECONDS}s`);
      console.log("t   gnd sup  recov    mode  gait          c/L c/R rootY  hErr   latErr fwdErr yawErr urg kerrL kerrR comY  warnings");
      console.log("---- --- ---- -------- ----- ------------- --- --- ----- ------ ------ ------ ------ --- ----- ----- ----- ----------");

      const startTime = Date.now();
      const samples = [];
      let lastRow = "";
      let shoved = false;
      while (Date.now() - startTime < DURATION_SECONDS * 1000) {
        if (SHOVE && !shoved && (Date.now() - startTime) / 1000 >= SHOVE_AT_SECONDS) {
          shoved = true;
          await cdp.send("Runtime.evaluate", {
            expression: `window.__characterCtrlrActiveRagdollShove?.(${SHOVE.join(",")})`,
          });
          console.log(`-- shove ${SHOVE.join(",")} m/s --`);
        }
        const result = await cdp.send("Runtime.evaluate", {
          expression:
            "JSON.stringify(window.__characterCtrlrActiveRagdollDebug ?? null)",
          returnByValue: true,
        });
        let debug = null;
        try {
          debug = JSON.parse(result.result?.value ?? "null");
        } catch {
          debug = null;
        }

        if (debug) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rootY = debug.pelvisPosition?.[1] ?? null;
          const annotated = { ...debug, __probeT: elapsed, __probeRootY: rootY };
          samples.push(annotated);
          const row = compactSample(annotated);
          const rowString = [
            row.t.padStart(4),
            row.grounded.padEnd(3),
            row.support.padEnd(4),
            row.recovery.padEnd(8),
            row.mode.padEnd(6),
            row.gait.padEnd(13),
            row.contacts.padEnd(5),
            row.rootY.padStart(5),
            row.hErr.padStart(6),
            row.latErr.padStart(6),
            row.fwdErr.padStart(6),
            row.yawErr.padStart(6),
            row.urgency.padStart(3),
            row.kerrL.padStart(5),
            row.kerrR.padStart(5),
            row.comY.padStart(5),
            ` ${row.warnings}`,
          ].join(" ");
          if (rowString !== lastRow) {
            console.log(rowString);
            lastRow = rowString;
          }
        }
        await sleep(SAMPLE_INTERVAL_MS);
      }

      // Fixed-step trace of the shove (the render loop is too slow to see it in the samples above).
      if (SHOVE) {
        const traceResult = await cdp.send("Runtime.evaluate", {
          expression: "JSON.stringify(window.__characterCtrlrActiveRagdollTrace ?? [])",
          returnByValue: true,
        });
        const trace = JSON.parse(traceResult.result?.value ?? "[]");
        const markerIndex = trace.findIndex((entry) => entry.marker);
        if (markerIndex >= 0) {
          const first = trace[markerIndex - 1] ?? trace[markerIndex + 1];
          console.log("\nshove trace (physics steps, 1/60 s each; every 6th):");
          console.log("step  pelvis xyz            vel xyz              support  grounded recovery");
          for (let i = markerIndex - 1; i < Math.min(trace.length, markerIndex + 240); i += 6) {
            const e = trace[i];
            if (!e.pelvis) continue;
            console.log(
              `${String(i - markerIndex).padStart(4)}  ${e.pelvis.map((v) => v.toFixed(2).padStart(6)).join(" ")}   ${e.vel.map((v) => v.toFixed(2).padStart(6)).join(" ")}   ${String(e.support).padEnd(7)} ${e.grounded ? "Y" : "N"}        ${e.recovery}`,
            );
          }
        }
      }

      // Verdict.
      if (samples.length === 0) {
        console.log("\nVERDICT: no debug samples captured");
        process.exitCode = 1;
        return;
      }
      const groundedRatio =
        samples.filter((s) => s.grounded).length / samples.length;
      const doubleRatio =
        samples.filter((s) => s.supportState === "double").length / samples.length;
      const warningCounts = {};
      for (const sample of samples) {
        for (const warning of sample.warnings ?? []) {
          warningCounts[warning] = (warningCounts[warning] ?? 0) + 1;
        }
      }
      const worstUrgency = Math.max(...samples.map((s) => s.captureUrgency ?? 0));
      const minRootY = Math.min(...samples.filter((s) => s.__probeRootY != null).map((s) => s.__probeRootY));
      const fallenSamples = samples.filter((s) => s.recoveryState === "fallen").length;
      const lastSample = samples[samples.length - 1];

      console.log("\n--- VERDICT ---");
      console.log(`samples: ${samples.length}`);
      console.log(`grounded ratio: ${(groundedRatio * 100).toFixed(1)}%`);
      console.log(`double-support ratio: ${(doubleRatio * 100).toFixed(1)}%`);
      console.log(`fallen samples: ${fallenSamples} (${(fallenSamples / samples.length * 100).toFixed(0)}%)`);
      console.log(`min pelvis y: ${minRootY.toFixed(2)}m (stand height 1.98m)`);
      const positioned = samples.filter((s) => s.pelvisPosition);
      if (positioned.length > 1) {
        const first = positioned[0].pelvisPosition;
        const last = positioned[positioned.length - 1].pelvisPosition;
        const drift = (p) => Math.hypot(p[0] - first[0], p[2] - first[2]);
        console.log(`pelvis drift: max ${Math.max(...positioned.map((s) => drift(s.pelvisPosition))).toFixed(2)}m, final ${drift(last).toFixed(2)}m`);
      }
      if (lastSample.simulatedTime != null) {
        const wallSeconds = lastSample.__probeT;
        const ratio = lastSample.simulatedTime / Math.max(wallSeconds, 1e-6);
        console.log(`simulated time: ${lastSample.simulatedTime.toFixed(2)}s over ${wallSeconds.toFixed(2)}s wall (${(ratio * 100).toFixed(0)}% real time)`);
      }
      console.log(`worst capture urgency: ${worstUrgency.toFixed(2)}`);
      console.log(`warnings: ${JSON.stringify(warningCounts)}`);
      console.log(`final state: grounded=${lastSample.grounded} support=${lastSample.supportState} recovery=${lastSample.recoveryState} mode=${lastSample.movementMode} hErr=${(lastSample.supportHeightError ?? 0).toFixed(3)}`);
    } finally {
      await cdp.close();
    }
  } finally {
    if (chrome) {
      killProcessGroup(chrome);
    }
    killProcessGroup(devServer);
    await sleep(250);
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
