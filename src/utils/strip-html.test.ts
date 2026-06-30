import { describe, it, expect } from 'vitest';
import { stripHtmlTags } from './strip-html';

describe('stripHtmlTags', () => {
  it('returns empty string for empty input', () => {
    expect(stripHtmlTags('')).toBe('');
  });

  it('returns the same string when no HTML tags present', () => {
    expect(stripHtmlTags('hello world')).toBe('hello world');
  });

  it('strips simple opening and closing tags', () => {
    expect(stripHtmlTags('<p>hello</p>')).toBe('hello');
  });

  it('strips tags with attributes', () => {
    expect(stripHtmlTags('<div class="foo">content</div>')).toBe('content');
  });

  it('strips self-closing tags', () => {
    expect(stripHtmlTags('before<br/>after')).toBe('beforeafter');
    expect(stripHtmlTags('before<br />after')).toBe('beforeafter');
    expect(stripHtmlTags('<img src="test.png" />')).toBe('');
  });

  it('strips nested tags preserving all text content', () => {
    expect(stripHtmlTags('<div><p>hello <b>world</b></p></div>')).toBe(
      'hello world'
    );
  });

  it('handles multiple sibling tags', () => {
    expect(stripHtmlTags('<span>one</span> <span>two</span>')).toBe('one two');
  });

  it('is idempotent — applying twice gives same result as once', () => {
    const input = '<p>Hello <b>world</b></p>';
    const once = stripHtmlTags(input);
    const twice = stripHtmlTags(once);
    expect(twice).toBe(once);
  });

  it('handles tags with special characters in attributes', () => {
    expect(
      stripHtmlTags('<a href="https://example.com?a=1&b=2">link</a>')
    ).toBe('link');
  });

  it('returns empty string for null-like falsy input', () => {
    expect(stripHtmlTags(undefined as unknown as string)).toBe('');
    expect(stripHtmlTags(null as unknown as string)).toBe('');
  });
});
