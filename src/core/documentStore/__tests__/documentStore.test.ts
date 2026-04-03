import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => {
  class MockEventEmitter {
    private listeners: Set<Function> = new Set();
    fire(data: any) { this.listeners.forEach(fn => fn(data)); }
    event = (listener: Function) => {
      this.listeners.add(listener);
      return { dispose: () => this.listeners.delete(listener) };
    };
    dispose() { this.listeners.clear(); }
  }
  return {
    Uri: {
      parse: (s: string) => ({ toString: () => s }),
    },
    EventEmitter: MockEventEmitter,
  };
});

import { DocumentStore, normalizeUri } from '../index';
import type { DocumentState } from '../../../types';

describe('normalizeUri', () => {
  it('returns a stable string from any uri input', () => {
    const u = normalizeUri('file:///path/to/file.md');
    expect(typeof u).toBe('string');
    expect(u.length).toBeGreaterThan(0);
  });
});

describe('DocumentStore', () => {
  let store: DocumentStore;

  const makeDoc = (uri = 'file:///test.md', content = 'hello'): DocumentState => ({
    uri,
    content,
    version: 1,
    isDirty: false,
  });

  beforeEach(() => {
    store = new DocumentStore();
  });

  it('setDocument + getDocument round-trip', () => {
    const doc = makeDoc();
    store.setDocument('file:///test.md', doc);
    const retrieved = store.getDocument('file:///test.md');
    expect(retrieved).toBeDefined();
    expect(retrieved!.content).toBe('hello');
  });

  it('hasDocument returns true after set, false after delete', () => {
    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    expect(store.hasDocument('file:///a.md')).toBe(true);
    store.deleteDocument('file:///a.md');
    expect(store.hasDocument('file:///a.md')).toBe(false);
  });

  it('updateContent increments version and sets isDirty', () => {
    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    store.updateContent('file:///a.md', 'new content');
    const doc = store.getDocument('file:///a.md')!;
    expect(doc.content).toBe('new content');
    expect(doc.version).toBe(2);
    expect(doc.isDirty).toBe(true);
  });

  it('updateContent throws for missing document', () => {
    expect(() => store.updateContent('file:///nope.md', 'x')).toThrow('Document not found');
  });

  it('markSaved clears isDirty and resets version', () => {
    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    store.updateContent('file:///a.md', 'changed');
    store.markSaved('file:///a.md');
    const doc = store.getDocument('file:///a.md')!;
    expect(doc.isDirty).toBe(false);
    expect(doc.version).toBe(0);
  });

  it('fires onChange with correct type on add/update/delete', () => {
    const events: { uri: string; type: string }[] = [];
    store.onChange((e) => events.push(e));

    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    store.updateContent('file:///a.md', 'v2');
    store.deleteDocument('file:///a.md');

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('add');
    expect(events[1].type).toBe('update');
    expect(events[2].type).toBe('delete');
  });

  it('deleteDocument does not fire if document did not exist', () => {
    const events: any[] = [];
    store.onChange((e) => events.push(e));
    store.deleteDocument('file:///ghost.md');
    expect(events).toHaveLength(0);
  });

  it('dispose clears all internal state', () => {
    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    store.dispose();
    expect(store.getDocument('file:///a.md')).toBeUndefined();
  });

  it('withLock serializes concurrent access', async () => {
    store.setDocument('file:///a.md', makeDoc('file:///a.md'));
    const order: number[] = [];

    const p1 = store.withLock('file:///a.md', async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });

    const p2 = store.withLock('file:///a.md', async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
