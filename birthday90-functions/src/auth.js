const crypto = require('crypto');

const TOKEN_VERSION = 1;

function getUploadWindow(env = process.env) {
    const opensAt = Date.parse(env.UPLOADS_OPEN_AT || '');
    const closesAt = Date.parse(env.UPLOADS_CLOSE_AT || '');

    if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || opensAt >= closesAt) {
        throw new Error('Upload window is not configured correctly');
    }

    return { opensAt, closesAt };
}

function getUploadStatus(now = Date.now(), env = process.env) {
    const { opensAt, closesAt } = getUploadWindow(env);

    if (now < opensAt) {
        return { allowed: false, reason: 'not_open', opensAt, closesAt };
    }
    if (now > closesAt) {
        return { allowed: false, reason: 'closed', opensAt, closesAt };
    }

    return { allowed: true, reason: 'open', opensAt, closesAt };
}

function signToken(payload, secret) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
}

function issueUploadToken(now = Date.now(), env = process.env) {
    const status = getUploadStatus(now, env);
    if (!status.allowed) {
        throw new Error('Uploads are not open');
    }

    const secret = env.UPLOAD_TOKEN_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
        throw new Error('Upload token secret is not configured correctly');
    }

    const requestedTtl = Number.parseInt(env.UPLOAD_TOKEN_TTL_SECONDS || '43200', 10);
    const ttlSeconds = Number.isFinite(requestedTtl) && requestedTtl > 0 ? requestedTtl : 43200;
    const expiresAt = Math.min(now + (ttlSeconds * 1000), status.closesAt);

    return {
        token: signToken({ v: TOKEN_VERSION, iat: now, exp: expiresAt }, secret),
        expiresAt,
    };
}

function verifyUploadToken(token, now = Date.now(), env = process.env) {
    const status = getUploadStatus(now, env);
    const secret = env.UPLOAD_TOKEN_SECRET;
    if (!status.allowed || !secret || typeof token !== 'string') {
        return false;
    }

    const [encodedPayload, suppliedSignature, extra] = token.split('.');
    if (!encodedPayload || !suppliedSignature || extra) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(encodedPayload)
        .digest();
    let actualSignature;
    try {
        actualSignature = Buffer.from(suppliedSignature, 'base64url');
    } catch {
        return false;
    }

    if (actualSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
        return false;
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        return payload.v === TOKEN_VERSION &&
            Number.isFinite(payload.iat) &&
            Number.isFinite(payload.exp) &&
            payload.iat <= now &&
            payload.exp >= now &&
            payload.exp <= status.closesAt;
    } catch {
        return false;
    }
}

module.exports = {
    getUploadStatus,
    issueUploadToken,
    verifyUploadToken,
};