import { describe, it, expect } from 'vitest';
import {
  classifyExportDocumentIntent,
  classifyOpenExternalNavigationTarget,
} from '../webviewInboundRouting';
import { getExportFilters } from '../exportFilters';

describe('classifyOpenExternalNavigationTarget', () => {
  it('denies empty', () => {
    expect(classifyOpenExternalNavigationTarget('  ')).toEqual({ action: 'deny', reason: 'empty' });
  });

  it('allows https', () => {
    expect(classifyOpenExternalNavigationTarget('https://example.com/a?q=1')).toEqual({
      action: 'open',
      url: 'https://example.com/a?q=1',
    });
  });

  it('allows http', () => {
    expect(classifyOpenExternalNavigationTarget('http://localhost:3000/')).toMatchObject({
      action: 'open',
    });
  });

  it('denies non-http(s) schemes', () => {
    expect(classifyOpenExternalNavigationTarget('file:///etc/passwd')).toEqual({
      action: 'deny',
      reason: 'forbidden_scheme',
    });
  });

  it('denies invalid URL', () => {
    expect(classifyOpenExternalNavigationTarget('not a url')).toEqual({
      action: 'deny',
      reason: 'invalid_url',
    });
  });
});

describe('classifyExportDocumentIntent', () => {
  it('aborts when format missing', () => {
    expect(classifyExportDocumentIntent({}, { content: 'x' })).toEqual({
      kind: 'abort',
      reason: 'missing_format',
    });
    expect(classifyExportDocumentIntent({ format: '  ' }, { content: 'x' })).toEqual({
      kind: 'abort',
      reason: 'missing_format',
    });
  });

  it('aborts when document missing', () => {
    expect(classifyExportDocumentIntent({ format: 'html' }, undefined)).toEqual({
      kind: 'abort',
      reason: 'missing_document',
    });
  });

  it('returns preview with markdown', () => {
    expect(classifyExportDocumentIntent({ format: 'preview' }, { content: '# hi' })).toEqual({
      kind: 'preview',
      markdown: '# hi',
    });
  });

  it('returns persist for concrete format', () => {
    expect(classifyExportDocumentIntent({ format: 'pdf' }, { content: '' })).toEqual({
      kind: 'persist',
      format: 'pdf',
    });
  });
});

describe('getExportFilters', () => {
  it('matches known formats', () => {
    expect(getExportFilters('html')).toEqual({ HTML: ['html'] });
    expect(getExportFilters('markdown')).toEqual({ MARKDOWN: ['md', 'markdown'] });
  });

  it('uses wildcard for unknown format', () => {
    expect(getExportFilters('docx')).toEqual({ DOCX: ['*'] });
  });
});
