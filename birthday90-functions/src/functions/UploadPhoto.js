const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const busboy = require('busboy');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { verifyUploadToken } = require('../auth');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'uploads';
const THUMBNAIL_CONTAINER_NAME = process.env.THUMBNAIL_CONTAINER_NAME || 'thumbnails';
const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 75 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
]);
const SUPPORTED_VIDEO_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm',
]);

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

app.http('UploadPhoto', {
    methods:   ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route:     'upload',
    handler:   async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }

        const authorization = request.headers.get('authorization') || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!verifyUploadToken(token)) {
            return jsonResponse(401, { error: 'A valid party upload session is required' });
        }

        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return jsonResponse(400, { error: 'Expected multipart/form-data' });
        }

        const maxImageBytes = getPositiveInteger('MAX_IMAGE_BYTES', DEFAULT_MAX_IMAGE_BYTES);
        const maxVideoBytes = getPositiveInteger('MAX_VIDEO_BYTES', DEFAULT_MAX_VIDEO_BYTES);
        const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > maxVideoBytes + (1024 * 1024)) {
            return jsonResponse(413, { error: 'The upload is too large' });
        }

        const credential        = new DefaultAzureCredential();
        const blobServiceClient = new BlobServiceClient(
            `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
            credential
        );
        const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);
        const thumbnailContainerClient = blobServiceClient.getContainerClient(THUMBNAIL_CONTAINER_NAME);
        await Promise.all([
            containerClient.createIfNotExists(),
            thumbnailContainerClient.createIfNotExists(),
        ]);

        return new Promise((resolve) => {
            const bb = busboy({
                headers: { 'content-type': contentType },
                limits: { files: 2, fileSize: maxVideoBytes, fields: 5, parts: 7 },
            });
            const uploads = [];
            const createdBlobClients = [];
            let rejectedResponse = null;
            let originalBlobClient = null;
            let originalMetadata = null;
            let originalResult = null;
            let thumbnailStored = false;

            bb.on('file', (fieldname, file, info) => {
                const { filename, mimeType } = info;

                if (fieldname === 'thumbnail') {
                    if (!originalResult || mimeType !== 'image/webp') {
                        context.warn('Skipping unsupported optional thumbnail:', mimeType);
                        file.resume();
                        return;
                    }

                    const limiter = new ByteLimitTransform(MAX_THUMBNAIL_BYTES);
                    const thumbnailClient = thumbnailContainerClient.getBlockBlobClient(
                        `${originalResult.blobName}.webp`
                    );
                    createdBlobClients.push(thumbnailClient);
                    uploads.push(
                        thumbnailClient.uploadStream(file.pipe(limiter), 256 * 1024, 1, {
                            blobHTTPHeaders: { blobContentType: 'image/webp' },
                        }).then(() => {
                            thumbnailStored = true;
                        })
                    );
                    return;
                }

                if (fieldname !== 'file' || originalResult) {
                    rejectedResponse = jsonResponse(400, { error: 'Expected one original file' });
                    file.resume();
                    return;
                }

                const isImage = SUPPORTED_IMAGE_TYPES.has(mimeType);
                const isVideo = SUPPORTED_VIDEO_TYPES.has(mimeType);
                if (!isImage && !isVideo) {
                    rejectedResponse = jsonResponse(415, { error: 'This file type is not supported' });
                    file.resume();
                    return;
                }

                const maxBytes = isImage ? maxImageBytes : maxVideoBytes;
                const safeName = filename.replace(/[^a-zA-Z0-9._\-()\s]/g, '_');
                const blobName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
                const blobClient = containerClient.getBlockBlobClient(blobName);
                createdBlobClients.push(blobClient);
                const limiter = new ByteLimitTransform(maxBytes);
                originalMetadata = {
                    originalname: Buffer.from(filename).toString('base64'),
                    uploadedat: new Date().toISOString(),
                    processingstatus: isImage ? 'pending' : 'notApplicable',
                };
                originalBlobClient = blobClient;
                originalResult = { blobName, filename, size: 0, isImage };

                file.on('limit', () => {
                    rejectedResponse = jsonResponse(413, { error: 'The upload is too large' });
                });

                const upload = blobClient.uploadStream(file.pipe(limiter), 4 * 1024 * 1024, 2, {
                    blobHTTPHeaders: { blobContentType: mimeType },
                    metadata: originalMetadata,
                }).then(() => {
                    originalResult.size = limiter.bytesRead;
                    return originalResult;
                });
                uploads.push(upload);
            });

            bb.on('finish', async () => {
                try {
                    const results = await Promise.all(uploads);
                    if (rejectedResponse) {
                        await cleanupBlobs(createdBlobClients, context);
                        resolve(rejectedResponse);
                        return;
                    }
                    if (!originalResult) {
                        resolve(jsonResponse(400, { error: 'No file was provided' }));
                        return;
                    }
                    if (originalResult.isImage) {
                        originalMetadata.processingstatus = thumbnailStored ? 'ready' : 'unavailable';
                        if (thumbnailStored) {
                            originalMetadata.thumbnailname = `${originalResult.blobName}.webp`;
                        }
                        await originalBlobClient.setMetadata(originalMetadata);
                    }
                    resolve(jsonResponse(200, {
                        success: true,
                        uploaded: [originalResult],
                        thumbnailStored,
                    }));
                } catch (err) {
                    context.error('Upload storage error:', err);
                    await cleanupBlobs(createdBlobClients, context);
                    const status = err.code === 'FILE_TOO_LARGE' ? 413 : 500;
                    const message = status === 413 ? 'The upload is too large' : 'Storage upload failed';
                    resolve(jsonResponse(status, { error: message }));
                }
            });

            bb.on('error', async (err) => {
                context.error('Busboy parse error:', err);
                await Promise.allSettled(uploads);
                await cleanupBlobs(createdBlobClients, context);
                resolve(jsonResponse(400, { error: 'Could not parse upload request' }));
            });

            Readable.fromWeb(request.body).pipe(bb);
        });
    },
});

async function cleanupBlobs(blobClients, context) {
    const results = await Promise.allSettled(
        blobClients.map((blobClient) => blobClient.deleteIfExists())
    );
    for (const result of results) {
        if (result.status === 'rejected') {
            context.error('Upload cleanup error:', result.reason);
        }
    }
}

class ByteLimitTransform extends Transform {
    constructor(maxBytes) {
        super();
        this.maxBytes = maxBytes;
        this.bytesRead = 0;
    }

    _transform(chunk, _encoding, callback) {
        this.bytesRead += chunk.length;
        if (this.bytesRead > this.maxBytes) {
            const error = new Error('File too large');
            error.code = 'FILE_TOO_LARGE';
            callback(error);
            return;
        }
        callback(null, chunk);
    }
}

function getPositiveInteger(name, fallback) {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function jsonResponse(status, body) {
    return {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
