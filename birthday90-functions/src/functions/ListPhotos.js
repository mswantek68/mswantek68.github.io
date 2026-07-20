const { app } = require('@azure/functions');
const { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const CONTAINER_NAME  = process.env.CONTAINER_NAME        || 'uploads';

// SAS tokens are valid for 24 hours so browsers can load photos directly
// from Azure Blob Storage without going through the Function App proxy.
const SAS_TTL_MS = 24 * 60 * 60 * 1000;

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

            // Obtain a user-delegation key once for all SAS tokens in this request.
            const now     = new Date();
            const expires = new Date(now.getTime() + SAS_TTL_MS);
            const userDelegationKey = await blobServiceClient.getUserDelegationKey(now, expires);

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

                // Generate a read-only SAS token so browsers can fetch the blob directly,
                // bypassing the Function App proxy (which may be on a private network).
                const sasQuery = generateBlobSASQueryParameters(
                    {
                        containerName: CONTAINER_NAME,
                        blobName:      blob.name,
                        permissions:   BlobSASPermissions.parse('r'),
                        startsOn:      now,
                        expiresOn:     expires,
                    },
                    userDelegationKey,
                    STORAGE_ACCOUNT
                ).toString();

                const proxyUrl =
                    `https://${STORAGE_ACCOUNT}.blob.core.windows.net` +
                    `/${CONTAINER_NAME}/${encodeURIComponent(blob.name)}?${sasQuery}`;

                photos.push({
                    name:         blob.name,
                    proxyUrl,
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
