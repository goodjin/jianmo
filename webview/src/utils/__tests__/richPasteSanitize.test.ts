import { describe, expect, it } from 'vitest';
import { RICH_PASTE_HTML_SCHEMA_VERSION, sanitizeRichPasteHtml } from '../richPasteSanitize';
import { MARKLY_PASTE_STRIP_SELECTOR } from '../pasteDenylist';

describe('richPasteSanitize (M13/M14)', () => {
  it('exports a schema version bump hook', () => {
    expect(typeof RICH_PASTE_HTML_SCHEMA_VERSION).toBe('number');
    expect(RICH_PASTE_HTML_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('strips script/template and event handler attributes', () => {
    const html =
      '<div onclick="alert(1)" data-ok="1"><p>Hi</p><script>bad()</script><template>x</template></div>';
    const out = sanitizeRichPasteHtml(html);
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('</script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('Hi');
  });

  it('documents strip selector surface for reviewers', () => {
    expect(MARKLY_PASTE_STRIP_SELECTOR).toContain('iframe');
    expect(MARKLY_PASTE_STRIP_SELECTOR).toContain('form');
  });
});
