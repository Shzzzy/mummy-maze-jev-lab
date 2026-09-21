# DeepSeek + Jev 分职责评分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Jev 从方向选择器改为动作评分器，由 DeepSeek 生成中性事实，代码注入固定规则和评分维度并选择最高分动作。

**Architecture:** 新增 `server/analysis.js` 负责 DeepSeek 分析，新增 `server/decision.js` 负责固定规则、Jev score 请求、响应解析和最高分选择，新增 `/api/decide` 串联完整流程。浏览器只消费评分结果，不再使用旧的 `choice` 方向接口。

**Tech Stack:** Node.js 20、原生 ES Modules、Express 5、Node test runner、Canvas、OmniLabs OpenAI 兼容接口与 System One 接口。

**Spec:** `docs/superpowers/specs/2026-09-21-deepseek-jev-scoring-design.md`

## Global Constraints

- DeepSeek 只输出中性 facts，不得输出方向建议、动作排名或动作评分。
- `rules` 和 `scoringDimensions` 必须由代码提供权威版本。
- 每个合法动作使用一个独立 `score` 问题，键名为 `<direction>_score`。
- 代码只选择合法动作中的最高分；同分比较 confidence；仍同分按 `up, down, left, right`。
- 任何上游失败都不得触发本地 AI 或自动抢跑动作。
- 代码注释使用中文。
- 不删除现有文件；旧接口保留兼容，但前端切换到新接口。

---

### Task 1: DeepSeek 中性事实分析器

**Files:**
- Create: `server/analysis.js`
- Test: `test/analysis.test.js`

**Interfaces:**
- Produces: `buildDeepSeekMessages(snapshot): Array<{role, content}>`
- Produces: `parseDeepSeekFacts(content): object`
- Produces: `createDeepSeekAnalyzer(options?): (snapshot) => Promise<{ facts, usage }>`
- Consumes: `snapshot` 为当前游戏状态对象。

- [ ] **Step 1: 写失败测试**

测试正常 JSON、非法 JSON、方向建议字段、非 2xx、超时和 Key 不泄漏。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/analysis.test.js`
Expected: FAIL，模块或导出不存在。

- [ ] **Step 3: 实现分析器**

实现严格 JSON 提示词、响应解析、结构校验、禁止字段递归扫描、超时和错误映射。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/analysis.test.js`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add server/analysis.js test/analysis.test.js
git commit -m "feat: add DeepSeek neutral fact analysis"
```

### Task 2: 固定规则、评分维度和 Jev score 请求

**Files:**
- Create: `server/decision.js`
- Test: `test/decision.test.js`

**Interfaces:**
- Produces: `FIXED_RULES: string[]`
- Produces: `SCORING_DIMENSIONS: Array<{id, description}>`
- Produces: `SCORE_CRITERIA: string[]`
- Produces: `getLegalDirections(snapshot): string[]`
- Produces: `buildJevScorePayload(facts, legalDirections): object`
- Produces: `parseJevScoreResponse(response, legalDirections): { scores, usage }`
- Produces: `selectBestDirection(scores, legalDirections): { direction, score, confidence }`

- [ ] **Step 1: 写失败测试**

覆盖：墙和关闭闸门过滤、四方向 score 问题、非法响应、越界评分、最高分、同分置信度、同分顺序。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/decision.test.js`
Expected: FAIL，模块或导出不存在。

- [ ] **Step 3: 实现决策模块**

实现固定规则表、固定评分维度、合法性计算、Jev payload、响应解析和选择器。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/decision.test.js`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add server/decision.js test/decision.test.js
git commit -m "feat: add fixed scoring context and Jev score parsing"
```

### Task 3: `/api/decide` 集成端点

**Files:**
- Create: `server/decide-handler.js`
- Modify: `server/app.js`
- Modify: `server.js`
- Test: `test/decide-handler.test.js`

**Interfaces:**
- Produces: `createDecisionHandler({ analyze, score }): express.RequestHandler`
- Produces: `createJevScorer(options?): (payload) => Promise<{ scores, usage, model }>`
- Consumes: `createDeepSeekAnalyzer()`、`buildJevScorePayload()`、`parseJevScoreResponse()`、`selectBestDirection()`

- [ ] **Step 1: 写失败测试**

覆盖正常链路、Key 缺失、DeepSeek 错误、Jev 错误、无合法方向、Key 不泄漏。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/decide-handler.test.js`
Expected: FAIL，模块或路由不存在。

- [ ] **Step 3: 实现 handler 和路由**

在 `createApp` 中挂载 `/api/decide`，保留 `/api/jev/decide`；更新 `server.js` 使用新 handler。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/decide-handler.test.js`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add server/decide-handler.js server/app.js server.js test/decide-handler.test.js
git commit -m "feat: add DeepSeek and Jev decision pipeline"
```

### Task 4: 浏览器评分卡和最高分执行

**Files:**
- Modify: `src/ui/jev-client.js`
- Modify: `src/main.js`
- Modify: `src/ui/metrics.js`
- Modify: `public/index.html`
- Test: `test/metrics.test.js`

**Interfaces:**
- Consumes: `/api/decide` 返回 `{ direction, score, confidence, scores, facts, rules, scoringDimensions, analysisUsage, scoringUsage, latencyMs }`
- Produces: 导出记录包含 `scores`、`facts`、`analysisUsage`、`scoringUsage`。

- [ ] **Step 1: 写失败测试**

更新指标测试，要求导出保留四方向评分和两类 usage。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/metrics.test.js`
Expected: FAIL，旧导出缺少评分结构。

- [ ] **Step 3: 实现前端**

前端改调 `/api/decide`，显示四方向 score/confidence，执行最高分方向，历史记录展示评分分布，导出保留完整决策对象。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/metrics.test.js`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/jev-client.js src/main.js src/ui/metrics.js public/index.html test/metrics.test.js
git commit -m "feat: execute highest-scored action in browser"
```

### Task 5: 文档、全量验证和推送

**Files:**
- Modify: `README.md`
- Test: `test/*.test.js`

- [ ] **Step 1: 更新 README**

说明 DeepSeek 环境变量、Jev 评分流程和余额要求。

- [ ] **Step 2: 运行全套测试**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 3: 检查敏感信息**

Run: `git grep -n "OMNILABS_API_KEY=" -- . ':!package-lock.json'`
Expected: 只出现说明文字，不出现真实 Key。

- [ ] **Step 4: 提交并推送**

```bash
git add README.md docs/superpowers/specs/2026-09-21-deepseek-jev-scoring-design.md docs/superpowers/plans/2026-09-21-deepseek-jev-scoring.md
git commit -m "docs: document DeepSeek and Jev scoring pipeline"
git push origin main
```

## Self-Review

- Spec coverage：DeepSeek、固定规则、固定评分维度、Jev 独立评分、合法动作过滤、最高分选择、错误处理和导出均有对应任务。
- Placeholder scan：无 TBD、TODO 或待补细节。
- Type consistency：统一使用 `facts`、`legalDirections`、`scores`、`analysisUsage`、`scoringUsage`。
