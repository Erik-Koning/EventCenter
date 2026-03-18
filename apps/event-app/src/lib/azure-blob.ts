/**
 * Azure Blob Storage utility for session document uploads.
 *
 * Env vars:
 *   AZURE_STORAGE_CONNECTION_STRING
 *   AZURE_STORAGE_CONTAINER_NAME
 */

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  type ContainerClient,
} from "@azure/storage-blob";
import { getRequiredEnv } from "@/lib/environment";

let _containerClient: ContainerClient | null = null;

function sanitizeBlobFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/[^a-zA-Z0-9._-]/g, "") // remove other special chars
    .replace(/-+/g, "-"); // collapse multiple hyphens
}

function getContainerClient(): ContainerClient {
  if (_containerClient) return _containerClient;

  const connectionString = getRequiredEnv("AZURE_STORAGE_CONNECTION_STRING");
  const containerName = getRequiredEnv("AZURE_STORAGE_CONTAINER_NAME");

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  _containerClient = blobServiceClient.getContainerClient(containerName);
  return _containerClient;
}

/**
 * Upload a buffer to Azure Blob Storage.
 * Returns the full blob URL (without SAS token).
 */
export async function uploadBlob(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const container = getContainerClient();

  // Prefix with timestamp to avoid collisions
  const blobName = `session-documents/${Date.now()}-${sanitizeBlobFileName(fileName)}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Extract the blob name from a full Azure Blob Storage URL.
 * Handles both encoded and unencoded pathnames.
 */
function extractBlobName(blobUrl: string): string | undefined {
  const containerName = getRequiredEnv("AZURE_STORAGE_CONTAINER_NAME");
  const url = new URL(blobUrl);
  const pathname = decodeURIComponent(url.pathname);
  const prefix = `/${containerName}/`;
  const idx = pathname.indexOf(prefix);
  if (idx === -1) return undefined;
  return pathname.slice(idx + prefix.length);
}

/**
 * Delete a blob by its full URL.
 */
export async function deleteBlob(blobUrl: string): Promise<void> {
  const container = getContainerClient();
  const blobName = extractBlobName(blobUrl);

  if (!blobName) return;

  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * Generate a time-limited read-only SAS URL (1 hour).
 * Required for Microsoft Office Online viewer to access the file.
 */
export async function generateSasUrl(blobUrl: string): Promise<string> {
  const connectionString = getRequiredEnv("AZURE_STORAGE_CONNECTION_STRING");
  const containerName = getRequiredEnv("AZURE_STORAGE_CONTAINER_NAME");

  // Parse account name and key from connection string
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error("Invalid Azure Storage connection string");
  }

  const accountName = accountNameMatch[1];
  const accountKey = accountKeyMatch[1];

  const blobName = extractBlobName(blobUrl);

  if (!blobName) {
    throw new Error(
      `Could not extract blob name from URL: ${blobUrl} (container: ${containerName})`
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );

  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + 60 * 60 * 1000); // 1 hour

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  return `${blobUrl}?${sasToken}`;
}
