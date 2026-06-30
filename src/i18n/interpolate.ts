/**
 * Replaces {token} placeholders in a template string with values from a params map.
 * Tokens with no corresponding value are left as-is in the output.
 *
 * @param template - The translation string with {token} placeholders
 * @param params - A record of token names to replacement values
 * @returns The interpolated string
 */
export function interpolate(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
}
