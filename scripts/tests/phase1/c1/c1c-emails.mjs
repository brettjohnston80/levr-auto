import { ROOT, LOGS } from "../lib/paths.mjs";
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { inviteEmail, resetEmail } from "../gen/real/agent-invite.mjs";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 300000, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "c1c-em-")) });
const p = await b.newPage(); await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
for (const [name, e] of [["01-invite-email", inviteEmail("Brett Johnston", "https://www.levrauto.com/agent/accept?token_hash=EXAMPLE&purpose=invite")], ["11-reset-email", resetEmail("https://www.levrauto.com/agent/accept?token_hash=EXAMPLE&purpose=reset")]]) {
  await p.setContent(`<html><body style="background:#fff;color:#111;font-family:-apple-system,Helvetica,Arial;margin:24px;max-width:640px;font-size:16px;line-height:1.5"><p style="color:#555;font-size:13px">Subject: <b style="color:#111">${e.subject}</b></p>${e.html}</body></html>`);
  for (const [vp, tag] of [[{ width: 1280, height: 500, deviceScaleFactor: 2 }, "desktop"], [{ width: 390, height: 700, deviceScaleFactor: 3 }, "phone"]]) { await p.setViewport(vp); await p.screenshot({ path: path.join(LOGS, "shots", `agent-1c-${name}-${tag}.png`) }); }
}
await b.close(); console.log("PASS  invite and reset emails rendered (screenshots in .test-logs/phase1/shots)"); console.log("1 passed, 0 failed");
