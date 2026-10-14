export function pgSsl(
  connectionString: string | undefined | null
): false | { rejectUnauthorized: boolean };
