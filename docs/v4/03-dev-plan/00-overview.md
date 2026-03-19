# 开发计划总览 - Markly v4

## 文档信息
- **项目名称**: Markly - CodeMirror 6 Markdown Editor
- **版本**: v1.0
- **对应架构**: docs/v4/02-architecture/
- **创建日期**: 2026-03-18

---

## 1. 项目概述

Markly v4 是一个基于 CodeMirror 6 的 VS Code Markdown 编辑器扩展，采用 Vue 3 + TypeScript 技术栈，实现所见即所得的 Markdown 编辑体验。

### 1.1 开发目标

- 实现三种编辑模式：即时渲染、源码编辑、分屏预览
- 完整的 GFM 支持（表格、任务列表、删除线等）
- 数学公式（KaTeX）和图表（Mermaid）支持
- 大纲导航、查找替换、工具栏等功能
- VS Code 主题同步和配置集成

### 1.2 技术栈

| 层次 | 技术 | 版本 |
|-----|------|------|
| 前端框架 | Vue 3 | 3.4.x |
| 编辑器核心 | CodeMirror 6 | 6.x |
| 构建工具 | Vite | 5.x |
| 语言 | TypeScript | 5.x |
| 样式 | CSS Variables | - |
| 数学渲染 | KaTeX | 0.16.x |
| 图表渲染 | Mermaid | 10.x |

---

## 2. 模块开发计划

### 2.1 开发批次

| 批次 | 模块 | 优先级 | 任务数 | 预估工时 | 状态 |
|-----|------|-------|-------|---------|------|
| 1 | MOD-001 Editor Core | P0 | 6 | 2天 | 待开发 |
| 1 | MOD-011 VS Code Integration | P0 | 5 | 1.5天 | 待开发 |
| 2 | MOD-003 Decorator System | P0 | 8 | 2.5天 | 待开发 |
| 2 | MOD-010 Theme System | P0 | 4 | 1天 | 待开发 |
| 3 | MOD-006 Outline Navigation | P0 | 5 | 1.5天 | 待开发 |
| 3 | MOD-007 Toolbar | P0 | 6 | 2天 | 待开发 |
| 4 | MOD-009 Find/Replace | P0 | 5 | 1.5天 | 待开发 |
| 4 | MOD-008 Image Handler | P0 | 4 | 1.5天 | 待开发 |
| 5 | MOD-004 Math Support | P1 | 4 | 1天 | 待开发 |
| 5 | MOD-005 Diagram Support | P1 | 4 | 1天 | 待开发 |

### 2.2 开发顺序

```
第1批（基础层）
├── MOD-001 Editor Core
│   └── 编辑器核心、模式管理
└── MOD-011 VS Code Integration
    └── 扩展入口、通信协议

第2批（渲染层）
├── MOD-003 Decorator System
│   └── WYSIWYG 装饰器
└── MOD-010 Theme System
    └── 主题管理、CSS变量

第3批（功能组件层）
├── MOD-006 Outline Navigation
│   └── 大纲解析、跳转
└── MOD-007 Toolbar
    └── 工具栏、格式操作

第4批（高级功能）
├── MOD-009 Find/Replace
│   └── 查找替换、高亮
└── MOD-008 Image Handler
    └── 图片粘贴、上传

第5批（扩展功能）
├── MOD-004 Math Support
│   └── 数学公式渲染
└── MOD-005 Diagram Support
    └── Mermaid 图表
```

---

## 3. 开发计划文档清单

| 序号 | 文档 | 模块 | 类型 | 任务数 | 工时 |
|-----|------|------|------|-------|------|
| 01 | [01-mod-001-editor-core.md](./01-mod-001-editor-core.md) | MOD-001 | 核心 | 6 | 2天 |
| 02 | [02-mod-011-vscode-integration.md](./02-mod-011-vscode-integration.md) | MOD-011 | 核心 | 5 | 1.5天 |
| 03 | [03-mod-003-decorator-system.md](./03-mod-003-decorator-system.md) | MOD-003 | 核心 | 8 | 2.5天 |
| 04 | [04-mod-010-theme-system.md](./04-mod-010-theme-system.md) | MOD-010 | 核心 | 4 | 1天 |
| 05 | [05-mod-006-outline-navigation.md](./05-mod-006-outline-navigation.md) | MOD-006 | 功能 | 5 | 1.5天 |
| 06 | [06-mod-007-toolbar.md](./06-mod-007-toolbar.md) | MOD-007 | 功能 | 6 | 2天 |
| 07 | [07-mod-009-find-replace.md](./07-mod-009-find-replace.md) | MOD-009 | 功能 | 5 | 1.5天 |
| 08 | [08-mod-008-image-handler.md](./08-mod-008-image-handler.md) | MOD-008 | 功能 | 4 | 1.5天 |
| 09 | [09-mod-004-math-support.md](./09-mod-004-math-support.md) | MOD-004 | 扩展 | 4 | 1天 |
| 10 | [10-mod-005-diagram-support.md](./10-mod-005-diagram-support.md) | MOD-005 | 扩展 | 4 | 1天 |

---

## 4. 覆盖映射

| 架构模块 | 开发计划 | 任务覆盖 | 状态 |
|---------|---------|---------|------|
| MOD-001 Editor Core | 01-mod-001-editor-core.md | API-001~007, API-035~037, API-041~043 | ✅ |
| MOD-003 Decorator System | 03-mod-003-decorator-system.md | API-010~015 | ✅ |
| MOD-004 Math Support | 09-mod-004-math-support.md | API-013~015 | ✅ |
| MOD-005 Diagram Support | 10-mod-005-diagram-support.md | API-016~018 | ✅ |
| MOD-006 Outline Navigation | 05-mod-006-outline-navigation.md | API-020~022 | ✅ |
| MOD-007 Toolbar | 06-mod-007-toolbar.md | API-023~025 | ✅ |
| MOD-008 Image Handler | 08-mod-008-image-handler.md | API-026~028 | ✅ |
| MOD-009 Find/Replace | 07-mod-009-find-replace.md | API-029~031 | ✅ |
| MOD-010 Theme System | 04-mod-010-theme-system.md | API-032~034 | ✅ |
| MOD-011 VS Code Integration | 02-mod-011-vscode-integration.md | API-038~040 | ✅ |

---

## 5. 开发规范

### 5.1 代码规范

- **命名**: 使用 PascalCase 组件名，camelCase 函数名，UPPER_SNAKE_CASE 常量
- **类型**: 所有函数参数和返回值必须显式声明类型
- **注释**: 复杂逻辑需添加注释，Hook 需添加 JSDoc
- **导入**: 使用绝对路径导入，按类型分组（第三方库、内部模块、相对路径）

### 5.2 提交规范

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

类型: `feat` | `fix` | `docs` | `style` | `refactor` | `test` | `chore`

### 5.3 测试规范

- 所有 composables 必须有单元测试
- 所有组件必须有组件测试
- 核心功能必须有 E2E 测试
- 测试覆盖率 ≥ 80%

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 所有模块开发完成
- [ ] 所有接口实现完成
- [ ] 所有测试通过
- [ ] 无阻塞性 Bug

### 6.2 质量验收

- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 TypeScript 错误
- [ ] 无 ESLint 警告
- [ ] 性能满足要求（首屏 < 2s）

### 6.3 文档验收

- [ ] API 文档完整
- [ ] 代码注释完整
- [ ] 使用说明文档

---

## 7. 风险评估

| 风险项 | 可能性 | 影响 | 缓解措施 |
|-------|-------|------|---------|
| CodeMirror 6 学习曲线 | 中 | 中 | 预留缓冲时间 |
| 装饰器性能问题 | 中 | 高 | 提前做性能测试 |
| VS Code API 限制 | 低 | 中 | 使用稳定 API |

---

## 8. 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|-----|------|---------|------|
| 1.0 | 2026-03-18 | 初始版本 | AI |
