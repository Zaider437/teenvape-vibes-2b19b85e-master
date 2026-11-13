export default async function run(page, ui) {
  await page.goto("http://localhost:8087/game/index.html?main=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  // Write result into DOM from MAIN world (evaluate may run isolated)
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "mainWorldProbe";
    d.textContent = "THREE=" + typeof THREE + " fogStrips=" + (typeof window.__groundFogStrips) + " overlayKids=" + document.getElementById("overlayInner").childElementCount;
    document.body.appendChild(d);
  });
  const probeText = await page.evaluate(() => document.getElementById("mainWorldProbe")?.textContent);
  const shot = "C:/Users/User/Downloads/teenvape-vibes-2b19b85e-master-main/teenvape-vibes-2b19b85e-master-main/game_new.png";
  await page.screenshot({ path: shot });
  return { probeText };
}
