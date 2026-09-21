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

## AI 链路修复

- 代码通过 `buildCanonicalFacts` 生成确定性的 player、monsters、exit、doorsOpen、adjacentTiles。
- DeepSeek 只输出中性 analysis summary 和 keyPoints，不再负责抄写基础事实。
- Jev 继续对合法方向评分，代码选择最高分并执行。
- 真实 DeepSeek + 真实 Jev 的 `/api/decide` 已成功返回 200。
- Jev 上游偶发 503 时会自动重试，当前退避序列为 500ms、1500ms、3000ms、6000ms。
- 503 重试耗尽后显示“Jev 服务暂时不可用，请稍后重试”，并允许用户重新点击 AI 自动。
- AI 按钮点击后会立即显示“分析中…”，状态栏显示“DeepSeek 分析中”。

## 怪物动画修复

- `animateEvents` 从行动前状态开始播放。
- 每个 move 事件只推进目标角色，其他怪物保持原位置。
- 新增 `applyMoveEvent` 单元测试。
- Playwright 中间帧截图确认白木乃伊处于两个格子之间。

## 验证结果

- `npm test`：59/59 通过。
- 真实 `/api/decide` 已返回 200。
- 右侧浏览器实际点击 AI 自动后，DeepSeek 分析、Jev 评分和动作执行均正常；测试中 AI 两回合后失败，属于评分策略问题，不是链路故障。
- Jev 上游若持续返回 503，AI 会暂停并提示稍后重试。

## 后续 TODO

- AI 目前可能因为评分策略本身而输掉关卡，这属于模型决策质量，不是链路故障。
- 增加胜利、失败、重试和关卡自动推进的 Playwright 场景。
- 如果继续做体验优化，可考虑增加关卡开始提示、音效开关和移动端触控方向键。
