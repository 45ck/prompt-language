const assert = require('node:assert');
const { compress, decompress } = require('./app');

// Test 1: Basic roundtrip with repeated characters
const input1 = 'aaabbc';
const compressed1 = compress(input1);
const result1 = decompress(compressed1);
assert.strictEqual(result1, input1, `Roundtrip failed for "${input1}": got "${result1}"`);

// Test 2: String with all unique characters
const input2 = 'abcdef';
const compressed2 = compress(input2);
const result2 = decompress(compressed2);
assert.strictEqual(result2, input2, `Roundtrip failed for "${input2}": got "${result2}"`);

// Test 3: String with characters in reverse order
const input3 = 'ccbbaa';
const compressed3 = compress(input3);
const result3 = decompress(compressed3);
assert.strictEqual(result3, input3, `Roundtrip failed for "${input3}": got "${result3}"`);

// Test 4: Mixed repeated and unique characters
const input4 = 'xaabyybz';
const compressed4 = compress(input4);
const result4 = decompress(compressed4);
assert.strictEqual(result4, input4, `Roundtrip failed for "${input4}": got "${result4}"`);

// Test 5: Empty string
const input5 = '';
const compressed5 = compress(input5);
const result5 = decompress(compressed5);
assert.strictEqual(result5, input5, 'Empty string roundtrip should work');

// Test 6: Single character
const input6 = 'z';
const compressed6 = compress(input6);
const result6 = decompress(compressed6);
assert.strictEqual(result6, input6, `Roundtrip failed for single char "${input6}"`);

console.log('All tests passed');
