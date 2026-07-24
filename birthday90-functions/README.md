---
title: Birthday90 Functions
description: Azure Functions API for private birthday photo and video uploads
ms.date: 2026-07-20
ms.topic: reference
---

## Overview

Azure Functions for the birthday90 photo/video upload app on mikeswantek.com.

## Functions

| Function | Route | Method | Description |
|---|---|---|---|
| `UploadPhoto` | `/api/upload` | POST | Receives multipart file upload, stores to Azure Blob Storage |
| `ListPhotos` | `/api/photos` | GET | Lists all uploaded photos/videos as JSON |
| `GetPhoto` | `/api/photo/{blobName}` | GET | Proxies a photo/video from Blob Storage to the browser |
| `AuthorizeUpload` | `/api/authorize` | POST | Issues a signed upload token while the upload window is open |
| `UploadStatus` | `/api/upload-status` | GET | Reports whether the configured upload window is open |
| `GetThumbnail` | `/api/thumbnail/{blobName}` | GET | Proxies a private WebP thumbnail to the browser |
| `AdminListPhotos` | `/api/admin/photos` | GET | Lists original media for administrators |
| `AdminDownloadPhoto` | `/api/admin/photos/{blobName}/download` | GET | Downloads an original file as an attachment |
| `AdminDeletePhoto` | `/api/admin/photos/{blobName}` | DELETE | Deletes an original and its generated thumbnail |

## Use the photo administration page

The administration page is available at
<https://mikeswantek.com/birthday90/admin/>. It is intentionally not linked
from the public birthday page. The Storage account can remain private because
the page sends requests through the VNet-integrated Function App.

The page requires the `ADMIN_ACCESS_KEY` Function App setting. The key is held
only in memory in the open browser tab. It is not committed to the site or
saved in browser storage.

### Retrieve the administration key in the Azure portal

1. Sign in to the [Azure portal](https://portal.azure.com).
2. Open resource group `rg-birthday90`.
3. Open Function App `birthday90-api`.
4. Select **Environment variables** under **Settings**.
5. Find the app setting named `ADMIN_ACCESS_KEY`.
6. Reveal and copy its value.
7. Open <https://mikeswantek.com/birthday90/admin/> in a private browser window.
8. Paste the key into **Admin access key**, then select **Open photos**.

The equivalent Azure CLI command retrieves the existing key without changing
Storage networking:

```powershell
az functionapp config appsettings list `
  --name birthday90-api `
  --resource-group rg-birthday90 `
  --query "[?name=='ADMIN_ACCESS_KEY'].value | [0]" `
  --output tsv
```

> [!IMPORTANT]
> Treat this host key like a password. Do not send it by email, place it in a
> URL, commit it to Git, or save it in a shared password field. Select **Lock**
> and close the browser tab when administration is complete.

### Delete test photos before the event

1. Open the administration page and enter the host key.
2. Confirm that each displayed filename and preview belongs to a test upload.
3. Select **Download** first for anything that might need to be retained.
4. Select **Delete** on one item.
5. Confirm the permanent deletion prompt.
6. Repeat for the remaining test files.
7. Select **View gallery** and confirm that only the intended files remain.
8. Return to the administration page, select **Lock**, and close the tab.

Deleting an item removes the original from the `uploads` container and its
generated image from the `thumbnails` container. The action cannot be undone
through the administration page. Azure Storage soft delete may provide a
separate recovery window if it is enabled on the account.

### Download and archive the event photos

1. Open the administration page and enter the host key.
2. Select **Download** to save one original at a time.
3. To save several originals, select their checkboxes and choose
   **Download selected**.
4. Allow multiple downloads if the browser asks for permission.
5. Verify the downloaded file count, names, sizes, and a sample of the media.
6. Copy the verified files to the destination, such as OneDrive, SharePoint,
   another Azure Storage account, or an external drive.
7. Keep the Azure originals until the destination copy has been verified.
8. Delete Azure copies only after the archive is complete and independently
   backed up.

`Download selected` downloads each original separately rather than creating a
ZIP archive. For a large collection, download in smaller groups and confirm
each group before continuing.

### End access after the event

Rotate `ADMIN_ACCESS_KEY` after the archive is complete. In the Azure portal,
open **Environment variables** for `birthday90-api`, replace the setting with a
new random value, and apply the change. The old value stops working after the
Function App restarts.

The upload window is controlled separately by `UPLOADS_OPEN_AT` and
`UPLOADS_CLOSE_AT`. Closing uploads does not remove existing media and does not
disable administration.

### Troubleshoot administration

* **The admin access key was not accepted**: Retrieve the current
  `ADMIN_ACCESS_KEY` app setting and try again.
* **The photo list could not be loaded**: Check that `birthday90-api` is
  running and that the administration Functions have been deployed.
* **A download does not start**: Allow downloads and multiple downloads for
  `mikeswantek.com`, then retry the item individually.
* **A deleted photo remains visible**: Refresh the administration page and the
  gallery. The API responses disable caching, but a previously loaded browser
  image can remain on screen until refresh.
* **Azure Portal cannot browse the container**: This is expected while public
  Storage networking is disabled. Use the administration page, which reaches
  Blob Storage through the Function App's managed identity and private network.

## Pre-deployment checklist

### 1. Assign roles to the managed identity

Run these commands to give the Function App's managed identity access to the storage account:

```powershell
$STORAGE_ID = az storage account show --name birthday90photos --resource-group rg-birthday90 --query id --output tsv
$IDENTITY_ID = az identity show --name birthday90-api-identity --resource-group rg-birthday90 --query principalId --output tsv

# Storage Blob Data Contributor (read/write blobs)
az role assignment create --assignee $IDENTITY_ID --role "Storage Blob Data Contributor" --scope $STORAGE_ID

```

### 2. Assign the managed identity to the Function App

```powershell
az functionapp identity assign `
  --name birthday90-api `
  --resource-group rg-birthday90 `
  --identities $(az identity show --name birthday90-api-identity --resource-group rg-birthday90 --query id --output tsv)
```

### 3. Set application settings

```powershell
az functionapp config appsettings set `
  --name birthday90-api `
  --resource-group rg-birthday90 `
  --settings `
    STORAGE_ACCOUNT_NAME=birthday90photos `
    BLOB_CONTAINER_NAME=uploads `
    THUMBNAIL_CONTAINER_NAME=thumbnails `
    UPLOADS_OPEN_AT=2026-07-25T16:00:00Z `
    UPLOADS_CLOSE_AT=2026-08-09T03:59:00Z `
    UPLOAD_TOKEN_TTL_SECONDS=43200 `
    MAX_IMAGE_BYTES=20971520 `
    MAX_VIDEO_BYTES=78643200
```

  Configure `UPLOAD_TOKEN_SECRET` separately and do not commit its value. The secret must
  contain at least 32 random bytes.

### 4. Configure CORS

```powershell
az functionapp cors add `
  --name birthday90-api `
  --resource-group rg-birthday90 `
  --allowed-origins https://mikeswantek.com
```

### 5. Create the blob container

```powershell
az storage container create `
  --name uploads `
  --account-name birthday90photos `
  --auth-mode login
```

> **Note:** `ListPhotos` returns Function App proxy URLs. Gallery cards use private WebP thumbnails when available. The lightbox requests original media through `GetPhoto`, and the Function App reads both containers using its managed identity and virtual network integration.


```powershell
cd birthday90-functions
npm install
func azure functionapp publish birthday90-api --javascript
```

> Requires [Azure Functions Core Tools](https://docs.microsoft.com/azure/azure-functions/functions-run-local) v4 installed.

## Verify deployment

```powershell
# List photos (should return empty array [])
curl https://birthday90-api.azurewebsites.net/api/photos

# Check function app is running
az functionapp show --name birthday90-api --resource-group rg-birthday90 --query state
```
