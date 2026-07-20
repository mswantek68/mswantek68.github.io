const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { paginatePhotos } = require('../gallery');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'uploads';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

app.http('ListPhotos', {
    methods:   ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route:     'photos',
    handler:   async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }

        try {
            const credential        = new DefaultAzureCredential();
            const blobServiceClient = new BlobServiceClient(
                `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
                credential
            );
            const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);

            const photos = [];
            for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
                // Skip any blob whose name looks like a path traversal attempt.
                if (blob.name.includes('..') || blob.name.includes('\\')) {
                    context.warn('Skipping suspicious blob name:', blob.name);
                    continue;
                }

                let originalName = blob.name;
                const encodedOriginalName = blob.metadata &&
                    (blob.metadata.originalname || blob.metadata.originalName);
                if (encodedOriginalName) {
                    try {
                        originalName = Buffer.from(encodedOriginalName, 'base64').toString('utf8');
                    } catch {
                        originalName = encodedOriginalName;
                    }
                }

                const proxyUrl = new URL(
                    `/api/photo/${encodeURIComponent(blob.name)}`,
                    request.url
                ).toString();
                const thumbnailName = blob.metadata &&
                    (blob.metadata.thumbnailname || blob.metadata.thumbnailName);
                const thumbnailUrl = thumbnailName
                    ? new URL(`/api/thumbnail/${encodeURIComponent(thumbnailName)}`, request.url).toString()
                    : null;

                photos.push({
                    name:         blob.name,
                    proxyUrl,
                    thumbnailUrl,
                    contentType:  blob.properties.contentType || 'application/octet-stream',
                    size:         blob.properties.contentLength,
                    lastModified: blob.properties.lastModified,
                    originalName,
                });
            }

            photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            if (!request.query.has('page') && !request.query.has('pageSize')) {
                return {
                    status: 200,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify(photos),
                };
            }
            const result = paginatePhotos(
                photos,
                request.query.get('page'),
                request.query.get('pageSize')
            );

            return {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            };
        } catch (err) {
            context.error('ListPhotos error:', err);
            return {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Could not list photos', details: err.message }),
            };
        }
    },
});
