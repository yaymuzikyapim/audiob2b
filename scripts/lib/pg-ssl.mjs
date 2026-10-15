/**
 * pg bağlantısı için SSL kararı.
 *
 * Supabase SSL zorunlu kılar; yerel geliştirme kümesi (PostgreSQL 17, port 5433)
 * SSL ile derlenmiş olsa da sertifikasız çalıştığı için bağlantıyı reddeder
 * ("The server does not support SSL connections"). Bu yüzden host'a bakıp
 * karar veriyoruz.
 *
 *   const pool = new pg.Pool({ connectionString: url, ssl: pgSsl(url) });
 */
export function pgSsl(connectionString) {
  const s = String(connectionString ?? "");
  const yerel = /(^|@|\/\/)(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/.test(s);
  return yerel ? false : { rejectUnauthorized: false };
}
