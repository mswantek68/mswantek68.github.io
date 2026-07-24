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
    isSafeBlobName,
};