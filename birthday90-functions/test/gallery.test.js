const test = require('node:test');
const assert = require('node:assert/strict');
const { paginatePhotos } = require('../src/gallery');

const photos = Array.from({ length: 61 }, (_, index) => ({ name: `photo-${index}` }));

test('defaults to the first 25 photos', () => {
    const result = paginatePhotos(photos);
    assert.equal(result.items.length, 25);
    assert.equal(result.items[0].name, 'photo-0');
    assert.equal(result.totalPages, 3);
});

test('supports 50 items and clamps pages to the available range', () => {
    const result = paginatePhotos(photos, '99', '50');
    assert.equal(result.page, 2);
    assert.equal(result.items.length, 11);
    assert.equal(result.items[0].name, 'photo-50');
});

test('rejects unsupported page sizes', () => {
    assert.equal(paginatePhotos(photos, '1', '100').pageSize, 25);
});