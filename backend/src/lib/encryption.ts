import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32
const KEY_LENGTH = 32

function getKey(): Buffer {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY
  if (!keyHex || typeof keyHex !== "string") {
    throw new Error("MESSAGE_ENCRYPTION_KEY is not configured")
  }
  const key = Buffer.from(keyHex, "hex")
  if (key.length !== KEY_LENGTH) {
    throw new Error("MESSAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
  }
  return key
}

function isEncryptionEnabled(): boolean {
  return !!process.env.MESSAGE_ENCRYPTION_KEY
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:encrypted (or plaintext if encryption disabled).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext
  if (!isEncryptionEnabled()) return plaintext

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

/**
 * Decrypts ciphertext produced by encrypt().
 * Returns plaintext or throws if invalid.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  if (!isEncryptionEnabled()) return ciphertext

  const key = getKey()
  const buf = Buffer.from(ciphertext, "base64")
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload")
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final("utf8")
}
