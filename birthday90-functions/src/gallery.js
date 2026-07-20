const ALLOWED_PAGE_SIZES = new Set([25, 50]);

function paginatePhotos(photos, requestedPage, requestedPageSize) {
    const parsedPage = Number.parseInt(requestedPage || '1', 10);
    const parsedPageSize = Number.parseInt(requestedPageSize || '25', 10);
    const pageSize = ALLOWED_PAGE_SIZES.has(parsedPageSize) ? parsedPageSize : 25;
    const total = photos.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const page = Math.min(Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1), totalPages);
    const start = (page - 1) * pageSize;

    return {
        items: photos.slice(start, start + pageSize),
        page,
        pageSize,
        total,
        totalPages,
    };
}

module.exports = { paginatePhotos };