import * as vscode from 'vscode';
import type { DocumentState } from '@types';

export type DocumentChangeType = 'add' | 'update' | 'delete';

export interface DocumentChangeEvent {
  uri: string;
  type: DocumentChangeType;
}

/**
 * Normalize URI for consistent key matching.
 * Handles case differences, trailing slashes, and other variations.
 */
export function normalizeUri(uri: string): string {
  // Use VSCode's URI parsing for proper normalization
  const parsed = vscode.Uri.parse(uri);
  return parsed.toString();
}

export class DocumentStore implements vscode.Disposable {
  private documents = new Map<string, DocumentState>();
  private readonly onChangeEmitter = new vscode.EventEmitter<DocumentChangeEvent>();

  public readonly onChange = this.onChangeEmitter.event;

  private emitChange(uri: string, type: DocumentChangeType): void {
    this.onChangeEmitter.fire({ uri, type });
  }

  getDocument(uri: string): DocumentState | undefined {
    return this.documents.get(normalizeUri(uri));
  }

  setDocument(uri: string, state: DocumentState): void {
    const normalizedUri = normalizeUri(uri);
    const isNew = !this.documents.has(normalizedUri);
    this.documents.set(normalizedUri, state);
    this.emitChange(normalizedUri, isNew ? 'add' : 'update');
  }

  updateContent(uri: string, content: string): void {
    const normalizedUri = normalizeUri(uri);
    const doc = this.documents.get(normalizedUri);
    if (doc) {
      doc.content = content;
      doc.version++;
      doc.isDirty = true;
      this.emitChange(normalizedUri, 'update');
    }
  }

  markSaved(uri: string): void {
    const normalizedUri = normalizeUri(uri);
    const doc = this.documents.get(normalizedUri);
    if (doc) {
      doc.isDirty = false;
    }
  }

  hasDocument(uri: string): boolean {
    return this.documents.has(normalizeUri(uri));
  }

  deleteDocument(uri: string): void {
    const normalizedUri = normalizeUri(uri);
    const existed = this.documents.has(normalizedUri);
    this.documents.delete(normalizedUri);
    if (existed) {
      this.emitChange(normalizedUri, 'delete');
    }
  }

  dispose(): void {
    this.documents.clear();
    this.onChangeEmitter.dispose();
  }
}
