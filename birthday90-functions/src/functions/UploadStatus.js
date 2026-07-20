const { app } = require('@azure/functions');
const { getUploadStatus } = require('../auth');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

app.http('UploadStatus', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'upload-status',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }

        try {
            const status = getUploadStatus();
            return {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploadsOpen: status.allowed,
                    reason: status.reason,
                    opensAt: new Date(status.opensAt).toISOString(),
                    closesAt: new Date(status.closesAt).toISOString(),
                }),
            };
        } catch (error) {
            context.error('UploadStatus error:', error);
            return {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Upload status is unavailable' }),
            };
        }
    },
});