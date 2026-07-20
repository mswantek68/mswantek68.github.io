# birthday90-functions

Azure Functions for the birthday90 photo/video upload app on mikeswantek.com.

## Functions

| Function | Route | Method | Description |
|---|---|---|---|
| `UploadPhoto` | `/api/upload` | POST | Receives multipart file upload, stores to Azure Blob Storage |
| `ListPhotos` | `/api/photos` | GET | Lists all uploaded photos/videos as JSON |
| `GetPhoto` | `/api/photo/{blobName}` | GET | Proxies a photo/video from Blob Storage to the browser |

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
    BLOB_CONTAINER_NAME=uploads
```

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

> **Note:** `ListPhotos` returns Function App proxy URLs. The browser requests media through `GetPhoto`, and the Function App reads blobs from private storage using its managed identity and virtual network integration.


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
