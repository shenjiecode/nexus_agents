import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from './logger.js';

const client = new S3Client({
  region: 'cn-east-1',
  endpoint: process.env.OSS_ENDPOINT || 'https://s3.cn-east-1.jdcloud-oss.com',
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET || '',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.OSS_BUCKET || 'agent-resource';

/**
 * Upload a file to OSS
 */
export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ...(contentType && { ContentType: contentType }),
  });
  await client.send(command);
  logger.info({ key, bucket: BUCKET, size: body.length }, 'File uploaded to OSS');
}

/**
 * Download a file from OSS
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await client.send(command);
  if (!response.Body) throw new Error(`Empty response body for key: ${key}`);
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Delete a file from OSS
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await client.send(command);
  logger.info({ key, bucket: BUCKET }, 'File deleted from OSS');
}

/**
 * Get a presigned URL for temporary access (default 1 hour)
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}
