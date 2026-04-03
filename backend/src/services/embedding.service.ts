import OpenAI from "openai"

// Use OpenAI embeddings; 768 dimensions to match existing DB vector(768)
const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
const TARGET_EMBEDDING_DIM = 768
const EMBEDDING_BATCH_SIZE = Math.min(
  parseInt(process.env.EMBEDDING_BATCH_SIZE ?? "100", 10),
  2048,
)
// text-embedding-3-small max 8192 tokens; truncate so we never exceed (≈2 chars/token)
const MAX_INPUT_CHARS = 8000

export class EmbeddingService {
  private client: OpenAI | null = null

  private getClient(): OpenAI {
    if (this.client) return this.client
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required for embeddings. Set it in your environment.",
      )
    }
    this.client = new OpenAI({ apiKey })
    return this.client
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const openai = this.getClient()
    const input =
      text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text
    const {
      data: [item],
    } = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
      dimensions: TARGET_EMBEDDING_DIM,
    })
    if (!item?.embedding) {
      throw new Error("OpenAI embeddings API returned no embedding")
    }
    if (item.embedding.length !== TARGET_EMBEDDING_DIM) {
      throw new Error(
        `Expected embedding dimension ${TARGET_EMBEDDING_DIM}, got ${item.embedding.length}`,
      )
    }
    return item.embedding
  }

  /**
   * Generate embeddings for multiple texts in batches (one API call per batch).
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    if (texts.length === 1) {
      return [await this.generateEmbedding(texts[0]!)]
    }
    const openai = this.getClient()
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE)
      const truncated = batch.map((t) =>
        t.length > MAX_INPUT_CHARS ? t.slice(0, MAX_INPUT_CHARS) : t,
      )
      const { data } = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: TARGET_EMBEDDING_DIM,
      })
      const ordered = data
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding)
      for (const emb of ordered) {
        if (emb.length !== TARGET_EMBEDDING_DIM) {
          throw new Error(
            `Expected embedding dimension ${TARGET_EMBEDDING_DIM}, got ${emb.length}`,
          )
        }
        results.push(emb)
      }
    }
    return results
  }
}
