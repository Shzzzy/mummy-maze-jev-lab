Original prompt: 调用 develop-web-game技能优化下游戏

## 当前进度

- 已安装并读取 openai-develop-web-game 技能。
- 已修复 `/public/styles.css` 404，页面样式现在从 `/styles.css` 正常加载。
- 已新增 `window.render_game_to_text`，可输出关卡、回合、玩家、怪物、出口、状态和最近一次 AI 评分。
- 已新增 `window.advanceTime` 组合钩子，兼容 Playwright 虚拟时间脚本。
- 已新增全屏切换：`f` 进入或退出全屏，`Esc` 退出。
- 已新增窄屏单列布局和全屏时隐藏侧栏的样式。
- 已新增 favicon，消除浏览器 favicon 404。
- 已将 DeepSeek API Key 写入本地 `.env`，`.env` 仍被 Git 忽略。
- 已让代码优先读取 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL`。

## 本轮三个问题的修复

### 1. DeepSeek 读取 tiles 坐标偏差

- 代码现在通过 `buildCanonicalFacts` 直接生成确定性的 player、monsters、exit、doorsOpen、adjacentTiles。
- DeepSeek 不再负责抄写基础事实，只输出中性分析 summary 和 keyPoints。
- 真实 DeepSeek + 真实 Jev 的 `/api/decide` 已返回 200，评分和最高分动作选择正常。

### 2. 怪物角色行动闪跳

- `animateEvents` 现在从行动前状态开始播放。
- 每个 move 事件只推进目标角色，其他怪物保持原位置，直到自己的事件开始。
- 新增 `applyMoveEvent` 单元测试。
- Playwright 中间帧截图确认白木乃伊处于两个格子之间，没有直接跳到最终位置。

### 3. AI 自动按钮无反馈

- 点击后按钮立即显示“分析中…”，并禁用避免重复点击。
- `ai-status` 同步显示“DeepSeek 分析中”。
- 请求失败时错误信息增加红色高亮。
- Playwright 点击 AI 自动后，真实链路完成决策并执行，console error 为 0。

## 验证结果

- `npm test`：58/58 通过。
- Playwright AI 点击测试：`output/web-game/ai-click-fixed`，无 console error。
- Playwright 动画中间帧：`output/web-game/animation-check`，怪物位置正确。
- 真实 `/api/decide`：返回 200，DeepSeek 分析、Jev 评分、代码选择动作均正常。

## 后续 TODO

- AI 目前仍可能因为评分策略本身而输掉关卡，这属于模型决策质量，不是链路故障。
- 增加胜利、失败、重试和关卡自动推进的 Playwright 场景。
- 如果继续做体验优化，可考虑增加关卡开始提示、音效开关和移动端触控方向键。
