import * as vscode from 'vscode';
import type { DocumentState } from '@types';

export class DocumentStore implements vscode.Disposable {
  private documents = new Map<string, DocumentState>();
  private readonly onChangeEmitter = new vscode.EventEmitter<string>();

  public readonly onChange = this.onChangeEmitter.event;

  getDocument(uri: string): DocumentState | undefined {
    return this.documents.get(uri);
  }

  setDocument(uri: string, state: DocumentState): void {
    this.documents.set(uri, state);
    this.onChangeEmitter.fire(uri);
  }

  updateContent(uri: string, content: string): void {
    const doc = this.documents.get(uri);
    if (doc) {
      doc.content = content;
      doc.version++;
      doc.isDirty = true;
      this.onChangeEmitter.fire(uri);
    }
  }

  markSaved(uri: string): void {
    const doc = this.documents.get(uri);
    if (doc) {
      doc.isDirty = false;
    }
  }

  hasDocument(uri: string): boolean {
    return this.documents.has(uri);
  }

  deleteDocument(uri: string): void {
    this.documents.delete(uri);
  }

  dispose(): void {
    this.documents.clear();
    this.onChangeEmitter.dispose();
  }
}
