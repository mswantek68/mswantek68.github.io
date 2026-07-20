const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { parseByteRange } = require('../httpRange');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'uploads';

app.http('GetPhoto', {
    methods:   ['GET'],
    authLevel: 'anonymous',
    route:     'photo/{blobName}',
    handler:   async (request, context) => {
        const blobName = request.params.blobName;
        if (!blobName) {
            return { status: 400, body: 'Missing blobName parameter' };
        }

        // Basic path traversal guard
        if (blobName.includes('/') || blobName.includes('..') || blobName.includes('\\')) {
            return { status: 400, body: 'Invalid blobName' };
        }

        try {
            const credential        = new DefaultAzureCredential();
            const blobServiceClient = new BlobServiceClient(
                `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
                credential
            );
            const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);
            const blobClient      = containerClient.getBlockBlobClient(blobName);
            const properties = await blobClient.getProperties();
            const contentLength = properties.contentLength;
            const rangeHeader = request.headers.get('range');
            const range = parseByteRange(rangeHeader, contentLength);

            if (rangeHeader && !range) {
                return {
                    status: 416,
                    headers: {
                        'Content-Range': `bytes */${contentLength}`,
                        'Access-Control-Allow-Origin': '*',
                    },
                };
            }

            const downloadResponse = range
                ? await blobClient.download(range.start, range.length)
                : await blobClient.download(0);
            const contentType = properties.contentType || 'application/octet-stream';
            const headers = {
                'Content-Type': contentType,
                'Content-Length': String(range ? range.length : contentLength),
                'Cache-Control': 'public, max-age=86400',
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
            };
            if (range) {
                headers['Content-Range'] = `bytes ${range.start}-${range.end}/${contentLength}`;
            }

            return {
                status: range ? 206 : 200,
                headers,
                body: downloadResponse.readableStreamBody,
            };
        } catch (err) {
            if (err.statusCode === 404) {
                return { status: 404, body: 'Photo not found' };
            }
            context.error('GetPhoto error for', blobName, ':', err);
            return { status: 500, body: 'Error retrieving photo' };
        }
    },
});
