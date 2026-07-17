# React Native Splash Screen - 测试计划

## 1. 测试策略概述

### 1.1 测试范围
- **单元测试**: 核心工具函数、配置解析、颜色处理
- **集成测试**: 插件构建流程、原生模块交互
- **端到端测试**: 完整的启动流程、API调用

### 1.2 测试环境
- Node.js 18+
- Expo SDK 54+
- iOS Simulator / Android Emulator

---

## 2. 现有测试分析

### 2.1 当前测试覆盖
现有 `tests/test-suite.yaml` 包含 18 个测试用例：

| 类别 | 数量 | 覆盖情况 |
|------|------|----------|
| WebView 模式 | 3 | 基础覆盖 |
| ResponsiveImage 模式 | 2 | 基础覆盖 |
| Normal 模式 | 3 | 基础覆盖 |
| Blend 模式 | 3 | 基础覆盖 |
| 跨模式测试 | 2 | 基础覆盖 |
| 平台特定测试 | 3 | 基础覆盖 |
| 错误处理 | 2 | 基础覆盖 |

### 2.2 缺失的测试场景

1. **边界条件测试**
   - 空HTML文件
   - 超大图片
   - 特殊字符路径
   - 极端颜色值

2. **性能测试**
   - 构建时间基准
   - 内存使用监控
   - 启动时间测量

3. **兼容性测试**
   - iOS 版本兼容性
   - Android API 级别兼容性
   - Expo SDK 版本兼容性

---

## 3. 补充测试用例

### 3.1 边界条件测试

| ID | 名称 | 描述 | 预期结果 |
|----|------|------|----------|
| BOUND_001 | 空HTML文件 | 使用空HTML文件 | 构建成功，显示空白 |
| BOUND_002 | 超大HTML文件 | 使用500KB+的HTML | 构建成功，无超时 |
| BOUND_003 | 空白背景色 | backgroundColor为空 | 使用默认白色 |
| BOUND_004 | 无效颜色格式 | 使用无效颜色值 | 回退到默认值 |
| BOUND_005 | 超大图片 | 使用4K图片 | 正确缩放 |
| BOUND_006 | 零宽度图片 | imageWidth设为0 | 使用默认宽度 |
| BOUND_007 | 负数宽度 | imageWidth设为负数 | 使用默认宽度 |
| BOUND_008 | 超长路径 | 使用255+字符路径 | 正确处理 |
| BOUND_009 | 特殊字符路径 | 路径包含中文/空格 | 正确处理 |
| BOUND_010 | 不存在的图片 | 指定不存在的图片 | 报错提示 |

### 3.2 异常处理测试

| ID | 名称 | 描述 | 预期结果 |
|----|------|------|----------|
| EXC_001 | 无效模式 | 使用不存在的模式 | 报错提示 |
| EXC_002 | 损坏的图片 | 使用损坏的图片文件 | 友好错误提示 |
| EXC_003 | 无效JSON配置 | app.json格式错误 | 报错提示 |
| EXC_004 | 缺少必要配置 | 缺少mode配置 | 使用默认模式 |
| EXC_005 | 文件权限问题 | 无写入权限 | 友好错误提示 |
| EXC_006 | 磁盘空间不足 | 模拟磁盘满 | 友好错误提示 |
| EXC_007 | 网络超时 | WebView加载超时 | 超时处理 |
| EXC_008 | 循环符号链接 | HTML路径循环引用 | 检测并报错 |

### 3.3 性能测试

| ID | 名称 | 描述 | 基准值 |
|----|------|------|--------|
| PERF_001 | Prebuild时间 | 测量prebuild耗时 | < 60s |
| PERF_002 | iOS构建时间 | 完整iOS构建 | < 5min |
| PERF_003 | Android构建时间 | 完整Android构建 | < 5min |
| PERF_004 | 启动画面显示时间 | 首次渲染时间 | < 500ms |
| PERF_005 | 内存使用 | Splash期间内存 | < 100MB |

### 3.4 兼容性测试

| ID | 名称 | 描述 | 范围 |
|----|------|------|------|
| COMPAT_001 | iOS版本兼容 | 不同iOS版本 | iOS 12+ |
| COMPAT_002 | Android API兼容 | 不同API级别 | API 21+ |
| COMPAT_003 | Expo SDK兼容 | 不同Expo版本 | Expo 48+ |
| COMPAT_004 | React Native版本 | 不同RN版本 | RN 0.70+ |
| COMPAT_005 | TypeScript支持 | TS类型定义 | 完整支持 |
| COMPAT_006 | 暗黑模式 | 系统暗黑模式 | 正确切换 |
| COMPAT_007 | 平板设备 | iPad/Android平板 | 正确显示 |
| COMPAT_008 | 横屏模式 | 横屏启动 | 正确显示 |

---

## 4. API 功能测试

### 4.1 preventAutoHideAsync

| ID | 测试场景 | 预期结果 |
|----|----------|----------|
| API_001 | 基本调用 | 返回 true |
| API_002 | 多次调用 | 幂等性，返回 true |
| API_003 | 在所有模式下 | 所有模式都支持 |

### 4.2 hideAsync

| ID | 测试场景 | 预期结果 |
|----|----------|----------|
| API_004 | 基本调用 | 返回 true，Splash隐藏 |
| API_005 | 无prevent直接hide | 正常隐藏 |
| API_006 | 隐藏后再次调用 | 返回 true |

### 4.3 内部API

| ID | 测试场景 | 预期结果 |
|----|----------|----------|
| API_007 | _internal_preventAutoHideAsync | 正确执行 |
| API_008 | _internal_maybeHideAsync | 正确执行 |

---

## 5. 测试执行配置

### 5.1 测试环境设置

```yaml
test_config:
  timeout: 300000  # 5分钟
  retry_count: 2
  parallel: true
  platforms:
    - ios
    - android
```

### 5.2 测试执行顺序

1. **阶段1**: 单元测试（快速反馈）
2. **阶段2**: 集成测试（构建验证）
3. **阶段3**: E2E测试（功能验证）
4. **阶段4**: 性能测试（基准验证）

---

## 6. 持续集成配置

### 6.1 CI 流程

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
```

### 6.2 测试报告

- 覆盖率报告: `coverage/`
- 测试结果: `test-results/`
- 性能基准: `benchmarks/`

---

## 7. 测试工具

### 7.1 推荐工具

| 用途 | 工具 |
|------|------|
| 单元测试 | Jest |
| E2E测试 | Detox / Maestro |
| 代码覆盖率 | Istanbul |
| 性能测试 | Lighthouse |

### 7.2 测试脚本

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "detox test",
    "test:coverage": "jest --coverage"
  }
}
```

---

*文档版本: 1.0*
*创建日期: 2026-03-10*
