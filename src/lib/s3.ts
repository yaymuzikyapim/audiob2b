import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// Kitap bölümü için S3 key üret
export function chapterS3Key(bookId: string, chapterId: string, ext = "mp3") {
  return `books/${bookId}/chapters/${chapterId}.${ext}`;
}

// Kapak görseli için S3 key üret
export function coverS3Key(uid: string, ext = "jpg") {
  return `covers/${uid}.${ext}`;
}

// Şirket logosu için S3 key üret
export function logoS3Key(uid: string, ext = "png") {
  return `logos/${uid}.${ext}`;
}

// Admin: tarayıcıdan direkt S3'e yükleme için presigned PUT URL (15 dk geçerli)
export async function getUploadUrl(key: string, contentType = "audio/mpeg") {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

// Player: güvenli stream URL'i (1 saat geçerli)
export async function getPlayUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

// Dosya sil
export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
