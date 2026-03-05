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
  const blobName = `session-documents/${Date.now()}-${fileName}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Delete a blob by its full URL.
 */
export async function deleteBlob(blobUrl: string): Promise<void> {
  const container = getContainerClient();
  const url = new URL(blobUrl);
  // The blob name is everything after the container name in the path
  const containerName = getRequiredEnv("AZURE_STORAGE_CONTAINER_NAME");
  const blobName = url.pathname.split(`/${containerName}/`)[1];

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

  const url = new URL(blobUrl);
  const blobName = url.pathname.split(`/${containerName}/`)[1];

  if (!blobName) {
    throw new Error("Could not extract blob name from URL");
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
