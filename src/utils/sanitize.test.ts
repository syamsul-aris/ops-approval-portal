import { describe, it, expect } from 'vitest';
import { containsUnsafeMarkup, sanitizeTextInput } from './sanitize';

describe('sanitize utilities', () => {
  it('detects HTML tags, script tags, and inline event handlers', () => {
    expect(containsUnsafeMarkup('<script>alert(1)</script>')).toBe(true);
    expect(containsUnsafeMarkup('<img src=x onerror=alert(1)>')).toBe(true);
    expect(containsUnsafeMarkup('javascript:alert(1)')).toBe(true);
    expect(containsUnsafeMarkup('Standard operational verification note.')).toBe(false);
  });

  it('strips HTML/script markup and enforces maxLength', () => {
    const cleaned = sanitizeTextInput('<b>Hello</b> <script>bad()</script>World', 20);
    expect(cleaned).toBe('Hello World');
    expect(sanitizeTextInput('a'.repeat(50), 12)).toHaveLength(12);
  });
});
