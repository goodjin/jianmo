import { describe, expect, it } from 'vitest';
import { pickNonConflictingFilename, pickNonConflictingFilenameAsync, splitStemExt } from '../image/imageFilenameCollision';

describe('imageFilenameCollision', () => {
  it('splitStemExt handles dotted names', () => {
    expect(splitStemExt('a.b.png')).toEqual({ stem: 'a.b', ext: '.png' });
    expect(splitStemExt('plain')).toEqual({ stem: 'plain', ext: '' });
  });

  it('pickNonConflictingFilename increments until free', () => {
    const taken = new Set(['x.png', 'x-2.png']);
    const out = pickNonConflictingFilename('x.png', (n) => taken.has(n));
    expect(out).toBe('x-3.png');
  });

  it('pickNonConflictingFilenameAsync increments until free', async () => {
    const taken = new Set(['z.png', 'z-2.png']);
    const out = await pickNonConflictingFilenameAsync('z.png', async (n) => taken.has(n));
    expect(out).toBe('z-3.png');
  });
});
