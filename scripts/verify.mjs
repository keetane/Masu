import { promisify } from "node:util";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
const exec = promisify(execFile);
const url = "http://127.0.0.1:49831/";
async function waitReady() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok && (await response.text()).includes("Masu")) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Masu server did not become ready");
}
await exec("open", ["Masu.app"]);
await waitReady();
await exec("open", ["Masu.app"]);
const list = await exec("pgrep", ["-fl", "Masu.app/Contents/MacOS/Masu"]);
if (list.stdout.trim().split("\n").length !== 1)
  throw Error("duplicate launcher");
console.log("PASS repeat Launch Services open: one process");
const temp = await fs.mkdtemp("/tmp/Masu 日本語 test ");
await fs.cp("Masu.app", temp + "/Masu.app", { recursive: true });
const pid = Number(list.stdout.split(" ")[0]);
process.kill(pid, "SIGTERM");
await new Promise((r) => setTimeout(r, 500));
await exec("open", [temp + "/Masu.app"]);
await waitReady();
const res = await fetch(url);
if (!res.ok || !(await res.text()).includes("Masu"))
  throw Error("relocated launch failed");
console.log("PASS moved bundle, space and Japanese path, standalone resources");
const moved = await exec("pgrep", ["-fl", "Masu.app/Contents/MacOS/Masu"]);
process.kill(Number(moved.stdout.split(" ")[0]), "SIGTERM");
await new Promise((r) => setTimeout(r, 400));
await exec("open", [process.cwd() + "/Masu.app"]);
await waitReady();
console.log("PASS original restored");
