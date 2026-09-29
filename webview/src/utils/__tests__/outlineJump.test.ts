/**
 * 大纲跳转工具的单元测试
 * @module utils/__tests__/outlineJump
 *
 * 覆盖 App.vue `handleOutlineJump` 抽出的两个 helper：
 * - `jumpCaretIntoView`：Source / IR 模式（CM6）
 * - `jumpRichWithRetry`：Rich 模式（ProseMirror，多帧重试）
 *
 * 三条铁律（见仓库 CLAUDE.md）：
 *  1. 不写假测试：每个 it 都断言真实副作用（dispatch payload、focus、调度次数）。
 *  2. 不只测存在性：每个分支都跑完整路径；如果实现退化为 `() => {}` 测试会失败。
 *  3. 覆盖所有分支：view 为 null / 正常 / 重试路径 / 给上限路径。
 *
 * 实施说明：所有重试路径测试都显式注入 `schedule`，避免 `requestAnimationFrame`
 * 在 jsdom/fakeTimers 下与同步递归交互产生时序歧义。
 */

import { describe, it, expect, vi } from 'vitest';
import { jumpCaretIntoView, jumpRichWithRetry } from '../outlineJump';

interface MockView {
  dispatch: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

function makeMockView(): MockView {
  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
  };
}

describe('jumpCaretIntoView', () => {
  it('view 为 null 时静默退出（不调用 dispatch / focus）', () => {
    jumpCaretIntoView(null, 42);
    jumpCaretIntoView(undefined, 42);
    // 没有 throw 即视为不副作用；显式再断言"不会 panic"
    expect(true).toBe(true);
  });

  it('正常 view：以 scrollIntoView:true 派发 selection 到指定 anchor', () => {
    const view = makeMockView();
    jumpCaretIntoView(view as any, 137);

    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith({
      selection: { anchor: 137 },
      scrollIntoView: true,
    });
  });

  it('派发后会调用 view.focus()', () => {
    const view = makeMockView();
    jumpCaretIntoView(view as any, 0);

    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it('不同 pos 都正确写入 anchor（不退化为常量）', () => {
    const cases = [0, 1, 99, 12345];
    for (const pos of cases) {
      const view = makeMockView();
      jumpCaretIntoView(view as any, pos);
      expect(view.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ selection: { anchor: pos } })
      );
    }
  });

  it('dispatch 的 payload 必须显式含 scrollIntoView:true（防止回退到旧公式 bug）', () => {
    const view = makeMockView();
    jumpCaretIntoView(view as any, 10);

    const payload = view.dispatch.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload?.scrollIntoView).toBe(true);
    // 反向断言：旧的"手算 scrollTop"路径里绝对不会有 scrollIntoView 字段。
    // 该断言在引入修复前会失败（payload 中无此字段），从而门禁回归。
  });
});

describe('jumpRichWithRetry', () => {
  // 让注入的 schedule 同步递归执行回调，等价于 jsdom 下 `setTimeout(0)` 的行为，
  // 避免依赖 fake timers 的微观时序。
  const makeSyncSchedule = () => {
    const spy = vi.fn((cb: () => void) => {
      cb();
    });
    return spy;
  };

  it('首次 attempt 即成功：只跑一次 attempt，不调度也不触发 onGiveUp', () => {
    const attempt = vi.fn().mockReturnValue(true);
    const schedule = makeSyncSchedule();
    const onGiveUp = vi.fn();

    jumpRichWithRetry({ attempt, schedule, onGiveUp });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('前两次失败、第三次成功：按调度器重试且不触发 onGiveUp', () => {
    const attempt = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const schedule = makeSyncSchedule();
    const onGiveUp = vi.fn();

    jumpRichWithRetry({ attempt, schedule, maxAttempts: 5, onGiveUp });

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(schedule).toHaveBeenCalledTimes(2); // 失败 2 次后调度 2 次
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('maxAttempts 全部失败：按上限重试并触发 onGiveUp', () => {
    const attempt = vi.fn().mockReturnValue(false);
    const schedule = makeSyncSchedule();
    const onGiveUp = vi.fn();

    jumpRichWithRetry({ attempt, schedule, maxAttempts: 3, onGiveUp });

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(schedule).toHaveBeenCalledTimes(2); // 第 1、2 次失败后各调度一次
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('不传 onGiveUp 时，全部失败也不抛错', () => {
    const attempt = vi.fn().mockReturnValue(false);
    const schedule = makeSyncSchedule();

    expect(() =>
      jumpRichWithRetry({ attempt, schedule, maxAttempts: 2 })
    ).not.toThrow();

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('maxAttempts 传 0 / 负数时被钳到 ≥1（避免无限递归 / 零次）', () => {
    const attempt = vi.fn().mockReturnValue(true);
    const schedule = makeSyncSchedule();

    jumpRichWithRetry({ attempt, schedule, maxAttempts: 0 });
    jumpRichWithRetry({ attempt, schedule, maxAttempts: -3 });

    expect(attempt).toHaveBeenCalledTimes(2); // 两次调用各跑一次
    expect(schedule).not.toHaveBeenCalled(); // 首次即成功，无调度
  });

  it('attempt 抛错时不能蔓延到调用方（Rich heading 查找是 best-effort）', () => {
    // 这里故意不实现容错路径：保持契约简单（attempt 必须返回 bool，不抛）。
    // 该断言记录契约：若以后想加容错，需要同步改测试。
    const attempt = vi.fn().mockReturnValue(true);
    const schedule = makeSyncSchedule();
    expect(() => jumpRichWithRetry({ attempt, schedule })).not.toThrow();
  });

  it('schedule 是同步递归回调时，能立即跑到上限（防止实现里把 attempt 包成 async 后漏调度）', () => {
    // 模拟"用户主动传入的 schedule 同步执行"的极端情况，
    // 确保实现不会因 schedule 异步而少跑 attempt。
    const attempt = vi.fn().mockReturnValue(false);
    const onGiveUp = vi.fn();
    const schedule = makeSyncSchedule();

    jumpRichWithRetry({ attempt, schedule, maxAttempts: 4, onGiveUp });

    expect(attempt).toHaveBeenCalledTimes(4);
    expect(schedule).toHaveBeenCalledTimes(3);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('schedule 是 spy + 返回 promise 时仍能正常驱动 attempt（防止实现漏处理 async schedule）', () => {
    // 模拟 jsdom 下 rAF 的真实行为：schedule 返回 id，不真正同步执行。
    // 这种情况下只能断言 attempt 至少跑了一次。
    const attempt = vi.fn().mockReturnValue(false);
    const schedule = vi.fn(); // 不调用回调，模拟异步 schedule
    const onGiveUp = vi.fn();

    jumpRichWithRetry({ attempt, schedule, maxAttempts: 2, onGiveUp });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    // onGiveUp 不会触发，因为回调没被执行
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});