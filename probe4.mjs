export default async function run(page, ui) {
  // minimal test: blank page + script tag pointing at three
  await page.goto("http://localhost:8087/game/index.html?x=" + Date.now(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  // Try injecting a script into THIS page (loaded) to see if tags can execute at all
  const res = await page.evaluate(() => new Promise((resolve) => {
    const results = [];
    const srcs = ["vendor/capsule-polyfill.js", "vendor/three.min.js"];
    let i = 0;
    function next() {
      if (i >= srcs.length) { resolve({ results, THREE: typeof THREE }); return; }
      const s = document.createElement("script");
      s.src = srcs[i];
      s.onload = () => { results.push(srcs[i] + " OK, THREE=" + typeof THREE); i++; next(); };
      s.onerror = () => { results.push(srcs[i] + " ERROR"); i++; next(); };
      document.head.appendChild(s);
    }
    next();
  }));
  return res;
}
