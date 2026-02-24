import * as vscode from 'vscode';
import type { ExtensionConfig } from '@types';

export class ConfigurationStore implements vscode.Disposable {
  private config: ExtensionConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  getConfig(): ExtensionConfig {
    return this.config;
  }

  reload(): void {
    this.config = this.loadConfig();
  }

  private loadConfig(): ExtensionConfig {
    const vsConfig = vscode.workspace.getConfiguration('mdEditor');

    return {
      editor: {
        theme: vsConfig.get('editor.theme', 'auto'),
        fontSize: vsConfig.get('editor.fontSize', 14),
        fontFamily: vsConfig.get('editor.fontFamily', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"),
      },
      image: {
        saveDirectory: vsConfig.get('image.saveDirectory', './assets'),
        compressThreshold: vsConfig.get('image.compressThreshold', 512000),
        compressQuality: vsConfig.get('image.compressQuality', 0.8),
      },
      export: {
        pdf: {
          format: vsConfig.get('export.pdf.format', 'A4'),
          margin: vsConfig.get('export.pdf.margin', {
            top: 25,
            right: 20,
            bottom: 25,
            left: 20,
          }),
        },
      },
    };
  }

  dispose(): void {
    // Cleanup if needed
  }
}
