/**
 * Appends the current locale date to the stored system prompt at request time.
 * Do not store the date in the database prompt text.
 */
export function renderSystemPrompt(
  promptTemplate: string,
  options?: { date?: Date },
): string {
  const date = options?.date ?? new Date()
  const dateStr = date.toLocaleDateString()
  return `${promptTemplate.trimEnd()}\n\nToday's date is ${dateStr}.`
}
