# 紫城服饰仓库管理系统 - 项目说明

## 项目概述

面向手机端的仓库管理 Web 应用，用于管理服装货品的入库、出库、转仓、库存查询和统计分析。

- **项目名称**：紫城服饰仓库管理系统
- **目标平台**：移动端浏览器（手机优先）
- **数据存储**：浏览器 localStorage（后续迁移到后端数据库）

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 + Vite | 前端框架 + 构建工具 |
| TypeScript | 强类型语言 |
| Tailwind CSS v4 | 原子化 CSS，移动端优先 |
| Zustand | 轻量状态管理 |
| React Router v7 | SPA 路由 |
| Recharts | 图表库（折线图） |
| dayjs | 日期处理 |

---

## 项目目录结构

```
warehouse-app/
├── CLAUDE.md                    # 项目说明（本文件）
├── index.html                   # 入口 HTML
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
│
├── src/
│   ├── main.tsx                 # 应用入口
│   ├── App.tsx                  # 路由 + 认证 + 布局
│   ├── index.css                # 全局样式 + Tailwind
│   │
│   ├── types/
│   │   └── index.ts             # 所有类型定义 + 枚举常量
│   │
│   ├── store/
│   │   └── index.ts             # Zustand Store（状态管理 + localStorage）
│   │
│   ├── utils/
│   │   ├── id.ts                # ID 生成
│   │   ├── date.ts              # 日期工具
│   │   └── stats.ts             # 统计计算
│   │
│   ├── components/
│   │   ├── BottomTabNav.tsx     # 底部导航
│   │   ├── WarehouseSwitcher.tsx# 仓库切换器
│   │   ├── ProductPicker.tsx    # 货品选择器
│   │   ├── StatCard.tsx         # 统计卡片
│   │   ├── OperationLogList.tsx # 操作记录列表
│   │   ├── LogDetailModal.tsx   # 操作详情弹窗
│   │   └── Toast.tsx            # 轻提示
│   │
│   └── pages/
│       ├── LoginPage.tsx        # 登录/注册
│       ├── DashboardPage.tsx    # 仪表盘首页
│       ├── InventoryPage.tsx    # 库存查询
│       ├── InboundPage.tsx      # 批量入库
│       ├── OutboundPage.tsx     # 批量出库
│       ├── TransferPage.tsx     # 批量转仓
│       └── ReviewPage.tsx       # 审核管理
│
└── public/
    └── logo.png                 # Logo 图片
```

---

## 核心功能

### 用户系统
- 管理员账号（admin）：所有操作直接生效，可审核他人操作
- 普通操作员：入库/出库需提交审核，管理员通过后才更新库存

### 仓库管理（2 个仓库）
- **TK备货仓**（warehouse-a）
- **1688预留仓**（warehouse-b）

### 批量操作
- 批量入库：表格行模式，支持粘贴 Excel 数据导入
- 批量出库：仅从库存点选
- 批量转仓：仓库间调拨

### 货品分类
裙套装 / 裤套装 / 连衣裙 / 单上衣 / 单裤 / 单裙 / 其他

### 统计分析
- 总库存量 + 库存总价值（按仓库细分）
- 出库统计（今日/昨日/本周/上周/本月/上月/今年）
- 出库趋势对比图（日/周/月/半年/年，自动对比上期）

---

## 数据模型

```
Product（货品）
├── id, sku, category, color, size, price, image, createdAt

Inventory（库存）
├── warehouseId, productId, quantity

OperationLog（操作记录）
├── id, operator, type, documentId, summary, timestamp, detail

PendingDoc（待审核单据）
├── id, type, status, username, warehouseId, items, createdAt

User（用户）
├── id, username, password, role
```

---

## 开发约定

1. 所有代码使用 TypeScript
2. 组件使用 React 函数组件 + Hooks
3. 样式使用 Tailwind CSS utility class
4. 数据持久化走 Zustand Store → localStorage
5. Git 提交信息使用中文
6. 提交前运行 `/code-review` 检查代码质量
7. 手机端优先，默认以 640px 以下宽度设计
