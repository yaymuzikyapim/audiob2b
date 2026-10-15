type EnvLike = Record<string, string | undefined>;

export const YASAK: string[];
export function sizanlar(env?: EnvLike): string[];
export function kontrolEt(opts?: {
  env?: EnvLike;
  log?: (msg: string) => void;
  exit?: (code: number) => void;
}): "temiz" | "durduruldu";
