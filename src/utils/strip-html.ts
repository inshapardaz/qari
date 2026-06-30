/**
 * Utility for stripping HTML tags from strings.
 * Used primarily by the Wiktionary provider to clean definition text.
 */

/**
 * Remove all HTML tags from a string while preserving text content.
 *
 * Handles:
 * - Opening tags (e.g., <p>, <div class="...">)
 * - Closing tags (e.g., </p>, </div>)
 * - Self-closing tags (e.g., <br/>, <img src="..." />)
 * - Nested tags at any depth
 * - Empty strings (returns empty string)
 *
 * This function is idempotent — applying it multiple times
 * produces the same result as applying it once.
 *
 * @param input - The string potentially containing HTML tags
 * @returns The input string with all HTML tags removed
 */
export function stripHtmlTags(input: string): string {
  if (!input) {
    return '';
  }

  return input.replace(/<[^>]*>/g, '');
}
