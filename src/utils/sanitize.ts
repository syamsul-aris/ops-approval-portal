const UNSAFE_MARKUP_PATTERN =
  /<\s*\/?\s*[a-zA-Z][^>]*>|javascript\s*:|on[a-z]+\s*=/i;

/**
 * Checks whether user input contains HTML tags, script protocols, or inline event handlers.
 */
export function containsUnsafeMarkup(input: string): boolean {
  return UNSAFE_MARKUP_PATTERN.test(input);
}

/**
 * Strips control characters and HTML/script markup, trims whitespace,
 * and enforces a strict maximum character length.
 * Combined with React's default JSX text escaping, this provides defense-in-depth
 * against XSS in rendered audit logs.
 */
export function sanitizeTextInput(input: string, maxLength = 300): string {
  const withoutMarkup = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '');

  let cleaned = '';
  for (const ch of withoutMarkup) {
    const code = ch.charCodeAt(0);
    if ((code >= 32 && code !== 127) || ch === '\n' || ch === '\t') {
      cleaned += ch;
    }
  }

  return cleaned.trim().slice(0, maxLength);
}
