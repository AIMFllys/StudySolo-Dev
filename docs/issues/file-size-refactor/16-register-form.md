<!-- 编码：UTF-8 -->

# #16 RegisterForm.tsx 拆分方案（364 行 → 目标 < 250 行）

## 当前问题

单个 `RegisterForm` 函数组件 364 行，包含：

1. **表单状态管理**（useState × 多个字段 + 验证逻辑）~60 行
2. **验证码逻辑**（发送 + 倒计时 + 滑块验证）~80 行
3. **注册提交**（API 调用 + 错误处理）~50 行
4. **JSX 渲染**（表单字段 + 验证码 + 协议勾选 + 按钮）~170 行

## 拆分策略

| 文件 | 内容 | 预估行数 |
|------|------|----------|
| `RegisterForm.tsx` | 主表单 JSX + 组合 hook | ~180 |
| `use-register-form.ts` | 表单状态 + 验证 + 提交逻辑 | ~120 |
| `RegisterCaptchaStep.tsx` | 验证码步骤 UI（如果是多步骤） | ~60 |

## 拆分后 Tree

```
frontend/src/features/auth/
├── forms/
│   ├── RegisterForm.tsx               # ~180 行：JSX 渲染
│   ├── LoginForm.tsx                  # 已有，保持
│   ├── ForgotPasswordFlow.tsx         # 已有，保持
│   └── index.ts                       # 已有，保持
├── hooks/
│   └── use-register-form.ts           # ~120 行：表单逻辑
├── components/
│   ├── slider-captcha/                # 已有，保持
│   ├── AuthBrandPanel.tsx             # 已有，保持
│   └── ...
└── constants.ts                       # 已有，保持
```

## 可复用识别

- 验证码倒计时逻辑已有 `use-verification-countdown.ts` hook，确认是否已复用
- 表单验证模式可与 ForgotPasswordFlow 共享

## 预估工作量

~1 小时
