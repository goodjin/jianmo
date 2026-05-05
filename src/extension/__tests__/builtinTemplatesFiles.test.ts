import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_DOCUMENT_TEMPLATES } from '../templates/builtinTemplates';

describe('M89 builtin template files', () => {
  it('every registered template id has a markdown file in repo templates/', () => {
    const templatesRoot = path.join(process.cwd(), 'templates');
    for (const t of BUILTIN_DOCUMENT_TEMPLATES) {
      const p = path.join(templatesRoot, `${t.id}.md`);
      expect(fs.existsSync(p), `expected ${p}`).toBe(true);
      expect(fs.readFileSync(p, 'utf-8').trim().length).toBeGreaterThan(30);
    }
  });
});
