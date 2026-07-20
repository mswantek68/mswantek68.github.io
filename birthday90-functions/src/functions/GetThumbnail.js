const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const THUMBNAIL_CONTAINER_NAME = process.env.THUMBNAIL_CONTAINER_NAME || 'thumbnails';

app.http('GetThumbnail', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'thumbnail/{blobName}',
    handler: async (request, context) => {
        const blobName = request.params.blobName;
        if (!isSafeBlobName(blobName)) {
            return { status: 400, body: 'Invalid blobName' };
        }

        try {
            const credential = new DefaultAzureCredential();
            const blobServiceClient = new BlobServiceClient(
                `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
                credential
            );
            const thumbnailClient = blobServiceClient
                .getContainerClient(THUMBNAIL_CONTAINER_NAME)
                .getBlockBlobClient(blobName);
            const properties = await thumbnailClient.getProperties();
            const downloadResponse = await thumbnailClient.download(0);

            return {
                status: 200,
                headers: {
                    'Content-Type': properties.contentType || 'image/webp',
                    'Content-Length': String(properties.contentLength),
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*',
                },
                body: downloadResponse.readableStreamBody,
            };
        } catch (error) {
            if (error.statusCode === 404) {
                return { status: 404, body: 'Thumbnail not found' };
            }
            context.error('GetThumbnail error for', blobName, ':', error);
            return { status: 500, body: 'Error retrieving thumbnail' };
        }
    },
});

function isSafeBlobName(blobName) {
    return Boolean(blobName) &&
        !blobName.includes('/') &&
        !blobName.includes('..') &&
        !blobName.includes('\\');
}