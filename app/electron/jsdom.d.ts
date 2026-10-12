/** 测试里用到的最小 jsdom 形状，避免再装一份 @types。 */
declare module 'jsdom' {
  export class JSDOM {
    window: Window & typeof globalThis;
    constructor(
      html?: string,
      options?: { runScripts?: 'dangerously' | 'outside-only'; url?: string }
    );
  }
}
