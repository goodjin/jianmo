import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  expandUserTemplateDirectoryInput,
  listMarkdownTemplatesInUserDirectory,
} from '../templates/userTemplateDirectory';

describe('userTemplateDirectory (M90)', () => {
  it('expandUserTemplateDirectoryInput normalizes and expands ~', () => {
    expect(expandUserTemplateDirectoryInput('')).toBe('');
    const home = os.homedir();
    expect(expandUserTemplateDirectoryInput('~/x/y')).toBe(path.join(home, 'x', 'y'));
  });

  it('listMarkdownTemplatesInUserDirectory returns sorted md files at top level', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'markly-utpl-'));
    fs.writeFileSync(path.join(root, 'b.md'), '# b');
    fs.writeFileSync(path.join(root, 'a.md'), '# a');
    fs.writeFileSync(path.join(root, 'skip.txt'), 'x');
    const list = listMarkdownTemplatesInUserDirectory(root);
    expect(list.map((x) => x.fileName)).toEqual(['a.md', 'b.md']);
    expect(list[0]?.labelStem).toBe('a');
  });
});
