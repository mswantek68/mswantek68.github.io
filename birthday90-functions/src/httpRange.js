function parseByteRange(header, contentLength) {
    if (!header) {
        return null;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || contentLength <= 0) {
        return undefined;
    }

    let start;
    let end;
    if (match[1] === '') {
        const suffixLength = Number.parseInt(match[2], 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
            return undefined;
        }
        start = Math.max(contentLength - suffixLength, 0);
        end = contentLength - 1;
    } else {
        start = Number.parseInt(match[1], 10);
        end = match[2] === '' ? contentLength - 1 : Number.parseInt(match[2], 10);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= contentLength || end < start) {
        return undefined;
    }

    end = Math.min(end, contentLength - 1);
    return { start, end, length: end - start + 1 };
}

module.exports = { parseByteRange };