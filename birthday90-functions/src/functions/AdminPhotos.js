const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const {
    contentDisposition,
    decodeOriginalName,
    isAdminKeyValid,
    isSafeBlobName,
} = require('../admin');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'uploads';
const THUMBNAIL_CONTAINER_NAME = process.env.THUMBNAIL_CONTAINER_NAME || 'thumbnails';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Admin-Key, Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
};

function jsonResponse(status, body) {
    return {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getContainers() {
    const credential = new DefaultAzureCredential();
    const serviceClient = new BlobServiceClient(
        `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
        credential
    );
    return {
        uploads: serviceClient.getContainerClient(BLOB_CONTAINER_NAME),
        thumbnails: serviceClient.getContainerClient(THUMBNAIL_CONTAINER_NAME),
    };
}

function isAuthorized(request) {
    return isAdminKeyValid(request.headers.get('x-admin-key'));
}

app.http('AdminListPhotos', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/photos',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }
        if (!isAuthorized(request)) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        try {
            const { uploads } = getContainers();
            const photos = [];
            for await (const blob of uploads.listBlobsFlat({ includeMetadata: true })) {
                if (!isSafeBlobName(blob.name)) {
                    context.warn('Skipping suspicious blob name:', blob.name);
                    continue;
                }
                photos.push({
                    name: blob.name,
                    originalName: decodeOriginalName(blob.name, blob.metadata),
                    contentType: blob.properties.contentType || 'application/octet-stream',
                    size: blob.properties.contentLength,
                    lastModified: blob.properties.lastModified,
                    thumbnailName: blob.metadata &&
                        (blob.metadata.thumbnailname || blob.metadata.thumbnailName) || null,
                });
            }
            photos.sort((left, right) => new Date(right.lastModified) - new Date(left.lastModified));
            return jsonResponse(200, photos);
        } catch (error) {
            context.error('AdminListPhotos error:', error);
            return jsonResponse(500, { error: 'Could not list photos' });
        }
    },
});

app.http('AdminDownloadPhoto', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/photos/{blobName}/download',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }
        if (!isAuthorized(request)) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const blobName = request.params.blobName;
        if (!isSafeBlobName(blobName)) {
            return jsonResponse(400, { error: 'Invalid blob name' });
        }

        try {
            const { uploads } = getContainers();
            const blobClient = uploads.getBlockBlobClient(blobName);
            const properties = await blobClient.getProperties();
            const download = await blobClient.download(0);
            const originalName = decodeOriginalName(blobName, properties.metadata);
            return {
                status: 200,
                headers: {
                    ...CORS_HEADERS,
                    'Content-Type': properties.contentType || 'application/octet-stream',
                    'Content-Length': String(properties.contentLength),
                    'Content-Disposition': contentDisposition(originalName),
                },
                body: download.readableStreamBody,
            };
        } catch (error) {
            if (error.statusCode === 404) {
                return jsonResponse(404, { error: 'Photo not found' });
            }
            context.error('AdminDownloadPhoto error for', blobName, ':', error);
            return jsonResponse(500, { error: 'Could not download photo' });
        }
    },
});

app.http('AdminDeletePhoto', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/photos/{blobName}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }
        if (!isAuthorized(request)) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const blobName = request.params.blobName;
        if (!isSafeBlobName(blobName)) {
            return jsonResponse(400, { error: 'Invalid blob name' });
        }

        try {
            const { uploads, thumbnails } = getContainers();
            const blobClient = uploads.getBlockBlobClient(blobName);
            const properties = await blobClient.getProperties();
            const thumbnailName = properties.metadata &&
                (properties.metadata.thumbnailname || properties.metadata.thumbnailName);

            if (thumbnailName && isSafeBlobName(thumbnailName)) {
                await thumbnails.getBlockBlobClient(thumbnailName).deleteIfExists({
                    deleteSnapshots: 'include',
                });
            }
            await blobClient.delete({ deleteSnapshots: 'include' });
            return { status: 204, headers: CORS_HEADERS };
        } catch (error) {
            if (error.statusCode === 404) {
                return jsonResponse(404, { error: 'Photo not found' });
            }
            context.error('AdminDeletePhoto error for', blobName, ':', error);
            return jsonResponse(500, { error: 'Could not delete photo' });
        }
    },
});