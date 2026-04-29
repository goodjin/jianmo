# M26 真实文档兼容性样例

这份文档混合了技术文档里最常见的元素：表格、任务列表、代码、数学公式、HTML、图片和长链接。

## Checklist

- [x] Rich 可以打开
- [ ] 保存后结构不应继续漂移
- [ ] Source 往返后关键内容还在

## 表格

| 模块 | 状态 | 说明 |
| --- | :---: | ---: |
| Rich | ready | 主编辑体验 |
| Source | fallback | 兜底 |

## 代码与公式

```ts
export const total = '$not_math_inside_code';
```

行内公式 $E=mc^2$ 和块级公式：

$$
\frac{a}{b}
$$

## 图片、链接和 HTML

![diagram](./assets/diagram.png)

[带查询参数的链接](https://example.com/docs?a=1&b=2#section)

<details>
<summary>更多信息</summary>
这里保留 HTML 兼容内容。
</details>

