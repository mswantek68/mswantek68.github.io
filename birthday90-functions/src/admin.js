const crypto = require('node:crypto');

function isAdminKeyValid(providedKey, configuredKey = process.env.ADMIN_ACCESS_KEY) {
    if (!providedKey || !configuredKey) {
        return false;
    }

    const provided = Buffer.from(providedKey);
    const configured = Buffer.from(configuredKey);
    return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

function isSafeBlobName(blobName) {
    return typeof blobName === 'string' &&
        blobName.length > 0 &&
        blobName.length <= 1024 &&
        !blobName.includes('/') &&
        !blobName.includes('..') &&
        !blobName.includes('\\');
}

function decodeOriginalName(blobName, metadata = {}) {
    const encodedName = metadata.originalname || metadata.originalName;
    if (!encodedName) {
        return blobName;
    }

    try {
        return Buffer.from(encodedName, 'base64').toString('utf8') || blobName;
    } catch {
        return blobName;
    }
}

function contentDisposition(filename) {
    const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

module.exports = {
    contentDisposition,
    decodeOriginalName,
    isAdminKeyValid,
    isSafeBlobName,
};