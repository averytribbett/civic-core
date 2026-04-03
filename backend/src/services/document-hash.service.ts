import crypto from "crypto"

export class DocumentHashService {
  /**
   * Deterministic hash for change detection. Uses normalized fields only so
   * re-fetches of the same content produce the same hash.
   */
  makeDocumentHash(input: { url: string; text: string }): string {
    const { url, text } = input
    // NFC so equivalent Unicode (e.g. é vs e + combining acute) hashes the same
    const normalized = [url, text].map((s) => s.normalize("NFC")).join("||")

    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex")
  }
}
