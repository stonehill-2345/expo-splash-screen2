# React Native Splash Screen - 优化计划

## 1. 执行摘要

本文档针对 React Native Splash Screen 库进行全面的代码质量分析，识别优化机会，并提供详细的实施计划。

### 代码规模概览
| 模块 | 文件 | 行数 |
|------|------|------|
| 主插件逻辑 | `plugin/src/index.ts` | 7,386 行 |
| Android模板 | `plugin/src/templates/android.ts` | 1,022 行 |
| iOS模板 | `plugin/src/templates/ios.ts` | 127 行 |
| iOS原生代码 | 4个Swift文件 | ~1,332 行 |
| Android原生代码 | 1个Kotlin文件 | 187 行 |
| Web/React Native接口 | 2个TypeScript文件 | ~138 行 |

---

## 2. 优化项列表（按优先级排序）

### P0 - 高优先级（影响维护性和稳定性）

#### 2.1 拆分巨型文件 `plugin/src/index.ts`

**问题描述**：
- 单文件 7,386 行代码，严重违反单一职责原则
- 混合了多种职责：配置解析、Android构建逻辑、iOS构建逻辑、HTML处理、颜色处理等
- 代码导航困难，IDE性能受影响
- 代码审查和测试困难

**预期收益**：
- 提高代码可读性和可维护性
- 降低认知负担
- 便于单元测试
- 减少合并冲突

**建议拆分结构**：
```
plugin/src/
  index.ts                 # 主入口，导出配置插件
  config/
    types.ts              # 类型定义
    parser.ts             # 配置解析
  utils/
    color.ts              # 颜色处理
    path.ts               # 路径处理
    html.ts               # HTML处理
  android/
    index.ts              # Android插件入口
    manifest.ts           # AndroidManifest修改
    styles.ts             # styles.xml修改
    mainActivity.ts       # MainActivity.kt修改
    resources.ts          # 资源文件处理
  ios/
    index.ts              # iOS插件入口
    appDelegate.ts        # AppDelegate修改
    plist.ts              # Info.plist修改
    xcode.ts              # Xcode项目修改
    resources.ts          # 资源文件处理
```

**实施步骤**：
1. 创建新的目录结构
2. 提取类型定义到 `config/types.ts`
3. 提取工具函数到 `utils/` 目录
4. 提取Android相关代码到 `android/` 目录
5. 提取iOS相关代码到 `ios/` 目录
6. 更新 `index.ts` 作为主入口
7. 运行测试确保功能完整

---

#### 2.2 消除代码重复

**问题描述**：
在 `index.ts` 中存在大量重复代码模式：

| 重复模式 | 出现次数 | 示例位置 |
|---------|---------|---------|
| HTML图片路径处理 | 2处 | `copyHtmlFile` (Android) vs `copyHtmlFileForIOS` |
| 图片路径提取和映射 | 2处 | 第750-978行 vs 第3713-3950行 |
| 颜色处理逻辑 | 多处 | `normalizeAndroidColor`, `addAlphaToColor` |
| MainActivity代码注入模式 | 3处 | `modifyMainActivity`, `modifyMainActivityForImageMode`, `modifyMainActivityForBlendMode` |
| onCreate方法解析 | 5处以上 | 大括号匹配逻辑重复 |

**预期收益**：
- 减少 ~800-1200 行代码
- 修复一处即修复所有
- 降低维护成本

**实施步骤**：
1. 创建共享的HTML处理模块
2. 统一Android/iOS的HTML复制逻辑
3. 提取通用的代码注入工具函数
4. 创建 `findMethodBounds()` 工具函数替代重复的大括号匹配逻辑

---

### P1 - 中优先级（提升代码质量）

#### 2.3 降低函数复杂度

**问题描述**：
多个函数圈复杂度过高：

| 函数名 | 行数 | 问题 |
|-------|------|------|
| `modifyMainActivity` | ~400行 | 过多条件分支 |
| `modifyMainActivityForBlendMode` | ~500行 | 嵌套层级过深 |
| `copyHtmlFile` | ~230行 | 单一职责违反 |
| `copyHtmlFileForIOS` | ~240行 | 与Android版本几乎相同 |

**预期收益**：
- 提高代码可读性
- 便于单元测试
- 降低bug引入风险

**实施步骤**：
1. 将大函数拆分为多个小函数
2. 使用策略模式处理不同模式的MainActivity修改
3. 提取HTML处理的通用流程

---

#### 2.4 改进错误处理

**问题描述**：
- 大量使用 `console.warn/log/error` 但没有统一的错误处理策略
- 某些关键错误被静默忽略
- 缺少错误类型分类

**建议改进**：
```typescript
enum SplashErrorType {
  CONFIG_ERROR,
  FILE_ERROR,
  BUILD_ERROR,
}

class SplashError extends Error {
  constructor(type: SplashErrorType, message: string, cause?: Error) {
    super(message);
    this.type = type;
    this.cause = cause;
  }
}
```

---

#### 2.5 添加类型安全

**问题描述**：
- 部分函数使用 `any` 类型
- 配置对象缺少严格的类型定义

**实施步骤**：
1. 完善类型定义
2. 消除 `any` 类型
3. 启用更严格的 TypeScript 配置

---

### P2 - 低优先级（改进开发体验）

#### 2.6 优化日志系统

**建议改进**：
```typescript
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const logger = {
  error: (msg: string) => console.error(`[expo-splash-screen2] ${msg}`),
  warn: (msg: string) => console.warn(`[expo-splash-screen2] ${msg}`),
  info: (msg: string) => logLevel >= LogLevel.INFO && console.log(`[expo-splash-screen2] ${msg}`),
  debug: (msg: string) => logLevel >= LogLevel.DEBUG && console.log(`[expo-splash-screen2] ${msg}`),
};
```

---

#### 2.7 提取常量配置

**问题描述**：
硬编码的常量散布在代码各处

**建议改进**：
```typescript
export const CONSTANTS = {
  ANDROID: {
    CUSTOM_ACTIVITY_NAME: 'SplashScreen2Activity',
    LOGO_RESOURCE_NAME: 'splashscreen_logo',
    DEFAULT_BACKGROUND_COLOR: '#ffffff',
  },
  IOS: {
    STORYBOARD_PATH: './SplashScreen.storyboard',
    IMAGE_ID: 'EXPO-SplashScreen',
  },
};
```

---

## 3. 技术债务清单

### 3.1 代码层面

| ID | 债务描述 | 影响 | 优先级 |
|----|---------|------|-------|
| TD-001 | 单文件7386行，需要拆分 | 维护困难 | 高 |
| TD-002 | Android/iOS HTML处理代码重复 | 维护成本高 | 高 |
| TD-003 | 函数复杂度过高 | 理解困难 | 中 |
| TD-004 | 错误处理不完善 | 调试困难 | 中 |
| TD-005 | 类型定义不完整 | IDE支持差 | 中 |
| TD-006 | 硬编码常量 | 配置不灵活 | 低 |
| TD-007 | 缺少单元测试 | 回归风险 | 高 |
| TD-008 | 日志系统不统一 | 调试困难 | 低 |

### 3.2 架构层面

| ID | 债务描述 | 影响 | 优先级 |
|----|---------|------|-------|
| TD-A01 | 缺少抽象层，平台代码耦合 | 扩展困难 | 中 |
| TD-A02 | 配置验证不严格 | 运行时错误 | 中 |
| TD-A03 | 缺少插件生命周期钩子 | 功能受限 | 低 |

---

## 4. 代码规范建议

### 4.1 命名规范

```typescript
// 函数命名：动词开头，camelCase
function generateSplashActivity() {}
function modifyMainActivity() {}

// 常量：UPPER_SNAKE_CASE
const CUSTOM_SPLASH_ACTIVITY_NAME = 'SplashScreen2Activity';

// 接口：PascalCase
interface SplashConfig {}
```

### 4.2 函数设计

```typescript
// 推荐：使用对象参数提高可读性
interface CopyHtmlOptions {
  projectRoot: string;
  targetDir: string;
  htmlPath: string;
}
function copyHtmlFile(options: CopyHtmlOptions): void {}
```

### 4.3 注释规范

```typescript
/**
 * 规范化Android颜色格式
 * @param color - 输入颜色值（支持 #RGB, #RRGGBB, #AARRGGBB）
 * @returns 规范化后的颜色值
 * @example
 * normalizeAndroidColor('#fff') // '#FFFFFF'
 */
function normalizeAndroidColor(color: string): string {}
```

---

## 5. 实施路线图

### 第一阶段（1-2周）
1. **TD-001**: 拆分 index.ts
2. **TD-002**: 消除代码重复
3. **TD-004**: 改进错误处理

### 第二阶段（2-3周）
1. **TD-003**: 降低函数复杂度
2. **TD-005**: 完善类型定义
3. **TD-007**: 添加单元测试

### 第三阶段（1周）
1. **TD-006**: 提取常量
2. **TD-008**: 优化日志系统

---

## 6. 代码质量指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 最大文件行数 | 7,386 | < 500 |
| 最大函数行数 | ~500 | < 100 |
| 圈复杂度 | > 50 | < 20 |
| 代码重复率 | ~15% | < 5% |
| 测试覆盖率 | 0% | > 80% |
| TypeScript严格模式 | 部分 | 完全 |

---

*文档版本: 1.0*
*创建日期: 2026-03-10*
