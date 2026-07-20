const test = require('node:test');
const assert = require('node:assert/strict');
const { parseByteRange } = require('../src/httpRange');

test('parses closed, open, and suffix byte ranges', () => {
    assert.deepEqual(parseByteRange('bytes=0-99', 1000), { start: 0, end: 99, length: 100 });
    assert.deepEqual(parseByteRange('bytes=900-', 1000), { start: 900, end: 999, length: 100 });
    assert.deepEqual(parseByteRange('bytes=-50', 1000), { start: 950, end: 999, length: 50 });
});

test('rejects unsupported or unsatisfiable ranges', () => {
    assert.equal(parseByteRange('items=0-2', 1000), undefined);
    assert.equal(parseByteRange('bytes=1000-', 1000), undefined);
    assert.equal(parseByteRange('bytes=100-50', 1000), undefined);
});