const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getUploadStatus,
    issueUploadToken,
    verifyUploadToken,
} = require('../src/auth');

const opensAt = Date.parse('2026-07-25T16:00:00Z');
const closesAt = Date.parse('2026-08-09T03:59:00Z');
const env = {
    UPLOADS_OPEN_AT: new Date(opensAt).toISOString(),
    UPLOADS_CLOSE_AT: new Date(closesAt).toISOString(),
    UPLOAD_TOKEN_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
    UPLOAD_TOKEN_TTL_SECONDS: '43200',
};

test('reports upload window status at each boundary', () => {
    assert.equal(getUploadStatus(opensAt - 1, env).reason, 'not_open');
    assert.equal(getUploadStatus(opensAt, env).reason, 'open');
    assert.equal(getUploadStatus(closesAt, env).reason, 'open');
    assert.equal(getUploadStatus(closesAt + 1, env).reason, 'closed');
});

test('issues and validates an upload token', () => {
    const now = opensAt + 1000;
    const { token, expiresAt } = issueUploadToken(now, env);

    assert.equal(expiresAt, now + 43200000);
    assert.equal(verifyUploadToken(token, now, env), true);
    assert.equal(verifyUploadToken(`${token}x`, now, env), false);
    assert.equal(verifyUploadToken(token, expiresAt + 1, env), false);
});

test('caps token expiry at the upload window close', () => {
    const now = closesAt - 1000;
    const { token, expiresAt } = issueUploadToken(now, env);

    assert.equal(expiresAt, closesAt);
    assert.equal(verifyUploadToken(token, closesAt, env), true);
});