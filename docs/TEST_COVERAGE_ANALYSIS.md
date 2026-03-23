# Markly 编辑器测试覆盖分析

> 生成时间: 2026-03-23
> 分析范围: Webview 编辑器 UX 场景

## 1. 核心用户场景覆盖矩阵

### 初始化与加载场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 1.1 | 首次打开文档，Loading 正常显示后进入预览模式 | ✅ | webview.e2e.spec.ts |
| 1.2 | 重新打开已保存文档，恢复上次内容 | ❌ | 需补充：持久化状态测试 |
| 1.3 | 初始化失败重试机制（READY 重发）| ✅ | webview.e2e.spec.ts |
| 1.4 | VS Code API 只能获取一次的约束 | ✅ | webview.e2e.spec.ts |
| 1.5 | 大文件加载性能（>1MB）| ❌ | 需补充：性能测试 |

### 模式切换场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 2.1 | Source ↔ Preview 模式切换 | ✅ | webview.e2e.spec.ts |
| 2.2 | 模式切换时滚动位置保留 | ✅ | webview.e2e.spec.ts |
| 2.3 | 模式切换时内容同步（未保存的编辑）| ⚠️ | 部分覆盖，需加强 |
| 2.4 | 快速连续切换模式（防抖）| ❌ | 需补充 |

### 编辑操作场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 3.1 | 纯键盘输入文本 | ✅ | webview.e2e.spec.ts |
| 3.2 | 选中文本后应用格式（Bold/Italic/Strike）| ✅ | webview.e2e.spec.ts |
| 3.3 | 无选中文本时光标位置插入格式标记 | ✅ | webview.e2e.spec.ts |
| 3.4 | 多行选中批量格式化 | ❌ | 需补充 |
| 3.5 | 快捷键操作（Ctrl+B/I/K/Z/Shift+Z）| ⚠️ | UI 层覆盖，需验证快捷键触发 |
| 3.6 | 撤销/重做后焦点恢复 | ✅ | webview.e2e.spec.ts |
| 3.7 | 格式化后焦点恢复 | ✅ | webview.e2e.spec.ts |
| 3.8 | **光标位置保持（setContent 后）** | ❌ | **严重缺口：setContent 重置光标** |
| 3.9 | 长文本编辑性能（粘贴大段内容）| ❌ | 需补充 |

### 插入元素场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 4.1 | 插入链接 | ✅ | webview.e2e.spec.ts |
| 4.2 | 插入图片 | ⚠️ | 按钮存在，需测试文件选择流程 |
| 4.3 | 插入代码块 | ✅ | webview.e2e.spec.ts |
| 4.4 | 插入表格 | ✅ | webview.e2e.spec.ts |
| 4.5 | 插入数学公式 | ❌ | 需补充 |
| 4.6 | 插入后光标位置正确 | ❌ | 需补充 |
| 4.7 | 插入后输入内容包裹在标记内 | ❌ | 需补充 |

### 大纲导航场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 5.1 | 大纲面板显示/隐藏切换 | ✅ | webview.e2e.spec.ts |
| 5.2 | Preview 模式点击大纲跳转并滚动 | ✅ | webview.e2e.spec.ts |
| 5.3 | Source 模式点击大纲跳转到对应位置 | ✅ | webview.e2e.spec.ts |
| 5.4 | 大纲跟随滚动高亮当前章节 | ❌ | 需补充 |
| 5.5 | 大纲中文标题 ID 生成正确 | ⚠️ | 单元测试覆盖，E2E 未验证 |

### 预览模式场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 6.1 | Markdown 正确渲染为 HTML | ✅ | webview.e2e.spec.ts |
| 6.2 | 代码块语法高亮 | ❌ | 需补充 |
| 6.3 | 数学公式渲染（KaTeX）| ❌ | 需补充 |
| 6.4 | 图片点击放大预览 | ❌ | 需补充 |
| 6.5 | 图片右键打开编辑器 | ❌ | 需补充 |
| 6.6 | 预览中点击链接行为 | ❌ | 需补充 |
| 6.7 | 预览中内部锚点跳转 | ✅ | E2E 大纲跳转测试覆盖 |

### 查找替换场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 7.1 | 打开/关闭查找替换面板 | ⚠️ | UI 存在，功能为 TODO |
| 7.2 | 查找下一个/上一个 | ❌ | 未实现 |
| 7.3 | 替换单个 | ❌ | 未实现 |
| 7.4 | 替换全部 | ❌ | 未实现 |

### 保存与同步场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 8.1 | Ctrl+S 触发保存 | ❌ | 需补充：键盘模拟 |
| 8.2 | 保存时自动更新 TOC | ⚠️ | 代码存在，测试未覆盖 |
| 8.3 | 内容变更实时同步到 Extension | ✅ | webview.e2e.spec.ts |
| 8.4 | Extension 推送内容更新到 Webview | ✅ | webview.e2e.spec.ts |

### 主题与配置场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 9.1 | 亮/暗主题切换 | ✅ | useTheme.test.ts |
| 9.2 | 系统主题自动跟随 | ⚠️ | 代码存在，未验证 |
| 9.3 | tabSize 配置生效 | ❌ | 需补充 |
| 9.4 | 字体大小配置 | ❌ | 需补充 |

### 异常与边界场景
| # | 场景 | 覆盖状态 | 测试文件 |
|---|------|---------|----------|
| 10.1 | 空文档编辑 | ⚠️ | 部分覆盖 |
| 10.2 | 仅含 frontmatter 的文档 | ❌ | 需补充 |
| 10.3 | 含有 TOC 标记的文档保存 | ⚠️ | 代码存在，E2E 未覆盖 |
| 10.4 | 网络断开/Extension 崩溃后恢复 | ❌ | 需补充 |
| 10.5 | 内存泄漏（长时间运行）| ❌ | 需补充 |

## 2. 未覆盖场景优先级（风险排序）

| 优先级 | 场景 | 风险说明 | 建议测试类型 |
|-------|------|---------|-------------|
| P0 | **光标位置保持（setContent/模式切换）** | **严重：导致用户无法编辑** | E2E |
| P0 | **点击移动光标** | **严重：编辑器无法使用** | E2E |
| P0 | 图片插入与预览流程 | 用户高频操作，当前仅按钮存在 | E2E |
| P0 | 快捷键实际操作验证 | 当前只测了按钮点击 | E2E |
| P1 | 代码块语法高亮 | 技术文档核心功能 | E2E + 视觉回归 |
| P1 | 数学公式渲染 | 技术文档核心功能 | E2E |
| P1 | Ctrl+S 保存触发 | 最基础的保存操作 | E2E |
| P1 | 快速模式切换防抖 | 可能导致状态混乱 | E2E |
| P2 | 大文件性能 | 影响用户体验 | 性能测试 |
| P2 | 大纲实时高亮跟随 | 交互体验 | E2E |
| P2 | 持久化状态恢复 | 用户期望行为 | E2E |
| P3 | 链接点击行为 | 安全性考量 | E2E |

## 3. 建议补充的测试用例清单

### 高优先级（P0-P1）

```typescript
// P0 - 光标位置保持（严重缺口，已导致生产问题）
should preserve cursor position after setContent call
should preserve cursor position when switching modes
should preserve cursor position after CONTENT_UPDATE
should allow clicking to move cursor in editor

// 1. 图片插入与预览
should insert image through toolbar and render in preview
should open image preview modal on click
should close preview modal on ESC or close button

// 2. 快捷键验证
should apply bold with Ctrl+B shortcut
should apply italic with Ctrl+I shortcut
should insert link with Ctrl+K shortcut
should undo with Ctrl+Z and redo with Ctrl+Shift+Z
should save with Ctrl+S shortcut

// 3. 代码块高亮
should render code block with syntax highlighting in preview
should copy code from code block

// 4. 数学公式
should render inline math with KaTeX
should render block math with KaTeX

// 5. 防抖与性能
should debounce rapid mode switches
should handle paste of large text without freezing
```

### 中优先级（P2）

```typescript
// 6. 大纲增强
should highlight current section in outline on scroll
should sync outline highlight when switching modes

// 7. 持久化
should restore scroll position on reopening document
should remember last used mode (source/preview)

// 8. 边界情况
should handle empty document gracefully
should handle document with only frontmatter
should update TOC on save when TOC marker exists
```

## 4. 测试覆盖度统计

| 类别 | 覆盖度 | 已覆盖 | 未覆盖 | 说明 |
|------|--------|--------|--------|------|
| 核心编辑 | 80% | 12 | 3 | 格式化、插入、撤销重做已覆盖 |
| 模式切换 | 90% | 9 | 1 | 切换逻辑和滚动保留已覆盖 |
| 大纲导航 | 85% | 5 | 1 | 跳转已覆盖，跟随高亮未覆盖 |
| 预览渲染 | 40% | 2 | 5 | 基础渲染覆盖，高级特性未覆盖 |
| 文件操作 | 30% | 2 | 5 | 仅消息验证，无真实保存流程 |
| 键盘交互 | 10% | 1 | 9 | 主要依赖按钮点击 |
| 图片/媒体 | 5% | 1 | 5 | 仅按钮存在 |
| 异常处理 | 40% | 2 | 3 | 重试机制覆盖，其他未覆盖 |
| **总计** | **48%** | **34** | **37** | - |

## 5. 测试策略建议

### 短期（本周）
1. 补充 P0 级 E2E 测试（图片、快捷键）
2. 为代码块高亮添加视觉回归测试

### 中期（本月）
1. 建立性能测试基线（大文件、长文档）
2. 补充异常场景测试（网络断开、内存泄漏）

### 长期
1. 考虑引入 Component Testing 替代部分 E2E
2. 建立视觉回归测试体系

---

*本文档作为测试覆盖率判断依据，需定期更新*
