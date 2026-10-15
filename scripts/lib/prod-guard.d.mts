type EnvLike = Record<string, string | undefined>;

export const CANLI_REF_SONEKLERI: string[];

export function refCikar(connectionString: string | undefined | null): string | null;
export function canliMi(connectionString: string | undefined | null): boolean;
export function refEtiketi(connectionString: string | undefined | null): string;

export function assertNotProd(
  connectionString: string | undefined | null,
  etiket?: string,
  opts?: {
    env?: EnvLike;
    log?: (msg: string) => void;
    warn?: (msg: string) => void;
    exit?: (code: number) => void;
  }
): "devam" | "izinli" | "durduruldu";
