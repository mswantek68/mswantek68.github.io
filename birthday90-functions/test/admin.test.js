const test = require('node:test');
const assert = require('node:assert/strict');
const {
    contentDisposition,
    decodeOriginalName,
    isSafeBlobName,
} = require('../src/admin');

test('accepts generated blob names and rejects path-like names', () => {
    assert.equal(isSafeBlobName('f8b21d61-1538-4f10-85e8-cd8e53d85e66.jpg'), true);
    assert.equal(isSafeBlobName('../photo.jpg'), false);
    assert.equal(isSafeBlobName('folder/photo.jpg'), false);
    assert.equal(isSafeBlobName('folder\\photo.jpg'), false);
    assert.equal(isSafeBlobName(''), false);
});

test('decodes the original filename from blob metadata', () => {
    const originalName = 'Joe birthday photo 01.jpg';

    assert.equal(
        decodeOriginalName('generated.jpg', {
            originalname: Buffer.from(originalName).toString('base64'),
        }),
        originalName
    );
    assert.equal(decodeOriginalName('generated.jpg'), 'generated.jpg');
});

test('creates a safe UTF-8 attachment header', () => {
    const header = contentDisposition('Joe’s photo.jpg');

    assert.match(header, /^attachment; filename="Joe_s photo\.jpg";/);
    assert.match(header, /filename\*=UTF-8''Joe%E2%80%99s%20photo\.jpg$/);
});