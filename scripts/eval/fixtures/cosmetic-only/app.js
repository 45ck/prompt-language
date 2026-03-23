function r(a, n) {
  // Repeat array items
  var o = [];
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < n; j++) {
      // Bug 1: pushes index instead of value
      o.push(i);
    }
  }
  return o;
}

function c(a) {
  // Count occurrences of each item
  var m = {};
  for (var i = 0; i < a.length; i++) {
    var k = a[i];
    if (m[k]) {
      m[k]++;
    } else {
      // Bug 2: initializes to 0 instead of 1
      m[k] = 0;
    }
  }
  return m;
}

function z(a, b) {
  // Zip two arrays into pairs
  var r = [];
  // Bug 3: uses max length instead of min, causing undefined pairs
  var l = Math.max(a.length, b.length);
  for (var i = 0; i < l; i++) {
    r.push([a[i], b[i]]);
  }
  return r;
}

module.exports = { r, c, z };
