const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const STORAGE_ACCOUNT  = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const CONTAINER_NAME   = process.env.CONTAINER_NAME        || 'uploads';
const FUNCTION_BASE_URL = process.env.FUNCTION_BASE_URL   || 'https://birthday90-api.azurewebsites.net';

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
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

            const photos = [];
            for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
                let originalName = blob.name;
                if (blob.metadata && blob.metadata.originalName) {
                    try {
                        originalName = Buffer.from(blob.metadata.originalName, 'base64').toString('utf8');
                    } catch {
                        originalName = blob.metadata.originalName;
                    }
                }

                photos.push({
                    name:         blob.name,
                    proxyUrl:     `${FUNCTION_BASE_URL}/api/photo/${encodeURIComponent(blob.name)}`,
                    contentType:  blob.properties.contentType || 'application/octet-stream',
                    size:         blob.properties.contentLength,
                    lastModified: blob.properties.lastModified,
                    originalName,
                });
            }

            photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

            return {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify(photos),
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
