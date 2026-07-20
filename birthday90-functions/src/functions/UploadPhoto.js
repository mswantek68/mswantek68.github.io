const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const busboy = require('busboy');

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'birthday90photos';
const CONTAINER_NAME  = process.env.CONTAINER_NAME        || 'uploads';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

app.http('UploadPhoto', {
    methods:   ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route:     'upload',
    handler:   async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }

        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Expected multipart/form-data' }),
            };
        }

        const credential        = new DefaultAzureCredential();
        const blobServiceClient = new BlobServiceClient(
            `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
            credential
        );
        const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
        await containerClient.createIfNotExists();

        const bodyBuffer = Buffer.from(await request.arrayBuffer());

        return new Promise((resolve) => {
            const bb      = busboy({ headers: { 'content-type': contentType } });
            const uploads = [];

            bb.on('file', (_fieldname, file, info) => {
                const { filename, mimeType } = info;
                const safeName   = filename.replace(/[^a-zA-Z0-9._\-()\s]/g, '_');
                const blobName   = `${Date.now()}-${safeName}`;
                const blobClient = containerClient.getBlockBlobClient(blobName);

                const chunks = [];
                file.on('data',  (chunk) => chunks.push(chunk));
                file.on('end',   () => {
                    const buffer = Buffer.concat(chunks);
                    uploads.push(
                        blobClient.upload(buffer, buffer.length, {
                            blobHTTPHeaders: { blobContentType: mimeType },
                            metadata: {
                                originalName: Buffer.from(filename).toString('base64'),
                                uploadedAt:   new Date().toISOString(),
                            },
                        }).then(() => ({ blobName, filename, size: buffer.length }))
                    );
                });
            });

            bb.on('finish', async () => {
                try {
                    const results = await Promise.all(uploads);
                    resolve({
                        status: 200,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ success: true, uploaded: results }),
                    });
                } catch (err) {
                    context.error('Upload storage error:', err);
                    resolve({
                        status: 500,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Storage upload failed', details: err.message }),
                    });
                }
            });

            bb.on('error', (err) => {
                context.error('Busboy parse error:', err);
                resolve({
                    status: 400,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Could not parse upload request' }),
                });
            });

            bb.write(bodyBuffer);
            bb.end();
        });
    },
});
