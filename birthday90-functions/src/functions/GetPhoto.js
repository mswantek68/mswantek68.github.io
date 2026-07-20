const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const CONTAINER_NAME  = process.env.CONTAINER_NAME        || 'uploads';

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
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
            const blobClient      = containerClient.getBlockBlobClient(blobName);

            const downloadResponse = await blobClient.download(0);
            const contentType = downloadResponse.contentType || 'application/octet-stream';

            const chunks = [];
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);

            return {
                status: 200,
                headers: {
                    'Content-Type':                contentType,
                    'Cache-Control':               'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*',
                },
                body: buffer,
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
