const fs = require('fs');
const p = 'teenvape-vibes-2b19b85e-master-main/game/script.js';
let t = fs.readFileSync(p, 'utf8');
if (!t.includes('window.__lidHingesFixed')) {
  // verify hinges are still right after our replacement (lines 0.78 hinge positions)
  const hingeOK = t.includes('hinge.position.set(0, 0.78, hz)');
  console.log('hinges intact:', hingeOK);
}
// cleanup helper files
['fix-lid4.cjs', 'inspect.cjs', 'fix-lid3.cjs', 'fix-lid.cjs', 'fix-lid2.cjs', 'check-tags.cjs', 'check-umd.cjs', 'check-umd2.cjs', 'check-umd3.cjs', 'check-umd4.cjs'].forEach(f => {
  try { fs.unlinkSync('teenvape-vibes-2b19b85e-master-main/' + f); console.log('removed', f); } catch (e) { }
});
