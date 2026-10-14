import type { S3Client, _Error as S3DeleteError } from "@aws-sdk/client-s3";

type EnvLike = Record<string, string | undefined>;

export function s3SilmeKapali(env?: EnvLike): boolean;

export function deleteObject(
  s3: S3Client,
  opts: { bucket: string; key: string; env?: EnvLike; log?: (msg: string) => void }
): Promise<{ skipped: boolean; deleted: number }>;

export function deleteObjects(
  s3: S3Client,
  opts: {
    bucket: string;
    keys: (string | undefined)[];
    env?: EnvLike;
    log?: (msg: string) => void;
    quiet?: boolean;
  }
): Promise<{ skipped: boolean; deleted: number; errors: S3DeleteError[] }>;
