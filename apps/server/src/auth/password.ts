import { hash, verify } from '@node-rs/argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

let dummyHash: Promise<string> | undefined;

/**
 * Checks a password. With no stored hash (unknown email) it still runs one argon2 verify,
 * so the response time doesn't tell an attacker which emails have an account.
 */
export async function verifyPassword(storedHash: string | undefined, password: string): Promise<boolean> {
  dummyHash ??= hash('not-a-real-password');
  const target = storedHash ?? (await dummyHash);
  const ok = await verify(target, password).catch(() => false);
  return ok && storedHash !== undefined;
}
