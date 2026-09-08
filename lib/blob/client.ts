import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";

function getServiceClient(): BlobServiceClient {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set.");
  return BlobServiceClient.fromConnectionString(connStr);
}

function getContainerName(): string {
  return process.env.AZURE_STORAGE_CONTAINER_NAME ?? "freightcontrol";
}

/**
 * Upload a file to Azure Blob Storage.
 * Returns the blob name (key) — NOT the URL.
 * We store the key in DB, not the URL, so it stays portable.
 */
export async function blobPut(
  blobName: string,
  data: Buffer | ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const client = getServiceClient();
  const container = client.getContainerClient(getContainerName());
  await container.createIfNotExists(); // idempotent
  const blockBlob = container.getBlockBlobClient(blobName);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });
  return blobName;
}

/**
 * Download a blob by its name and return as Buffer.
 * Returns null if not found.
 */
export async function blobGet(blobName: string): Promise<Buffer | null> {
  try {
    const client = getServiceClient();
    const container = client.getContainerClient(getContainerName());
    const blockBlob = container.getBlockBlobClient(blobName);
    const download = await blockBlob.download(0);
    if (!download.readableStreamBody) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of download.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/**
 * Delete a blob by its name. Silently ignores errors.
 */
export async function blobDelete(blobName: string): Promise<void> {
  try {
    const client = getServiceClient();
    const container = client.getContainerClient(getContainerName());
    await container.getBlockBlobClient(blobName).deleteIfExists();
  } catch {
    // ignore
  }
}

/**
 * Get content type of a blob without downloading it.
 */
export async function blobContentType(blobName: string): Promise<string | null> {
  try {
    const client = getServiceClient();
    const container = client.getContainerClient(getContainerName());
    const props = await container.getBlockBlobClient(blobName).getProperties();
    return props.contentType ?? null;
  } catch {
    return null;
  }
}
