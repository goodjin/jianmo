/** 避免把 API key 等写进错误提示或日志片段（无 vscode 依赖，可被单测安全引用） */
export function redactAssistErrorSnippet(text: string): string {
  return String(text ?? '')
    .replace(/sk-[a-zA-Z0-9_-]{8,}/gi, 'sk-***')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***');
}
