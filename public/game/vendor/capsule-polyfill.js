// Polyfill for THREE.CapsuleGeometry (added in r142) — for r128
// IMPORTANT: in r128 BufferGeometry is an ES6 class — do NOT call it via .call().
// Build the capsule as a plain BufferGeometry from parametric rings (100% class-safe).
THREE.CapsuleGeometry = function (radius, length, capSegments, radialSegments) {
  radius = radius !== undefined ? radius : 1;
  length = length !== undefined ? length : 1;
  capSegments = capSegments !== undefined ? Math.max(1, Math.floor(capSegments)) : 4;
  radialSegments = radialSegments !== undefined ? Math.max(3, Math.floor(radialSegments)) : 8;

  var g = new THREE.BufferGeometry();
  g.type = 'CapsuleGeometry';

  var positions = [], normals = [], uvs = [], indices = [];
  var i, j;
  var rows = capSegments * 2 + 2; // ring count: top-cap + cylinder + bottom-cap
  for (j = 0; j <= rows; j++) {
    var t = j / rows; // 0 = top pole .. 1 = bottom pole
    var y, r, ny;
    if (t < 0.25) {
      var phi = (1 - t / 0.25) * (Math.PI / 2);
      y = Math.sin(phi) * radius + length / 2;
      r = Math.cos(phi) * radius;
      ny = Math.cos(phi);
    } else if (t > 0.75) {
      var phi2 = ((t - 0.75) / 0.25) * (Math.PI / 2);
      y = -Math.sin(phi2) * radius - length / 2;
      r = Math.cos(phi2) * radius;
      ny = -Math.cos(phi2);
    } else {
      var tt = (t - 0.25) / 0.5;
      y = length / 2 - tt * length;
      r = radius;
      ny = 0;
    }
    for (i = 0; i <= radialSegments; i++) {
      var th = (i / radialSegments) * Math.PI * 2 - Math.PI / 2;
      var cx = Math.cos(th), cz = Math.sin(th);
      var nx = cx * Math.sqrt(Math.max(0, 1 - ny * ny));
      var nz = cz * Math.sqrt(Math.max(0, 1 - ny * ny));
      positions.push(cx * r, y, cz * r);
      normals.push(nx, ny, nz);
      uvs.push(i / radialSegments, 1 - t);
    }
  }
  function normalsHelper(arr, x, y, z) { arr.push(x, y, z); }
  function normalsHelper(arr, x, y, z) { arr.push(x, y, z); }
  var cols = radialSegments + 1;
  for (j = 0; j < rows; j++) {
    for (i = 0; i < radialSegments; i++) {
      var a = j * cols + i, b = (j + 1) * cols + i;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals(); // accurate normals from geometry
  return g;
};
