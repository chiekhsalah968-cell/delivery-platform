import { Algorithm, hash, verify } from '@node-rs/argon2';

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}

let dummyHash: Promise<string> | null = null;

/** A cached hash used to equalize login timing when the account does not exist. */
export function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = hash('timing-equalization-dummy', OPTIONS);
  return dummyHash;
}