import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const HASH_PREFIX = "scrypt";

// Hash pré-computado para mitigar timing attack quando o e-mail não existe
export const DUMMY_PASSWORD_HASH =
  "scrypt$00112233445566778899aabbccddeeff$" + "00".repeat(SCRYPT_KEYLEN);

function deriveKey(password: string, saltHex: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      Buffer.from(saltHex, "hex"),
      SCRYPT_KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const saltHex = randomBytes(16).toString("hex");
  const derivedKey = await deriveKey(password, saltHex);
  return `${HASH_PREFIX}$${saltHex}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const [, saltHex, hashHex] = parts;
  if (
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]+$/i.test(hashHex) ||
    hashHex.length !== SCRYPT_KEYLEN * 2
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(hashHex, "hex");
  const actualBuffer = await deriveKey(password, saltHex);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
