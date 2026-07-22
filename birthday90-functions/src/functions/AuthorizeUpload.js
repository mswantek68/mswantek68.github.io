const { app } = require('@azure/functions');
const {
    getUploadStatus,
    issueUploadToken,
} = require('../auth');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://mikeswantek.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

app.http('AuthorizeUpload', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'authorize',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 204, headers: CORS_HEADERS };
        }

        try {
            const uploadStatus = getUploadStatus();
            if (!uploadStatus.allowed) {
                return jsonResponse(403, {
                    error: 'Uploads are not currently open',
                    reason: uploadStatus.reason,
                    opensAt: new Date(uploadStatus.opensAt).toISOString(),
                    closesAt: new Date(uploadStatus.closesAt).toISOString(),
                });
            }

            const { token, expiresAt } = issueUploadToken();
            return jsonResponse(200, {
                token,
                expiresAt: new Date(expiresAt).toISOString(),
                closesAt: new Date(uploadStatus.closesAt).toISOString(),
            });
        } catch (error) {
            context.error('AuthorizeUpload error:', error);
            return jsonResponse(500, { error: 'Upload authorization is unavailable' });
        }
    },
});

function jsonResponse(status, body) {
    return {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}