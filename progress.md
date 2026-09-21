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
- 已直接调用 DeepSeek 官方接口验证成功，简单 3x3 局面可以返回合法 facts。

## Playwright 验证

- 运行目录：`output/web-game/run-2`
- 已执行向右、向上两个动作，共产生 3 个回合。
- 状态从玩家 `(2,5)` 变为 `(3,4)`，怪物位置同步更新。
- 最新截图：`shot-0.png`、`shot-1.png`。
- console error：已清零。

## 待解决问题

- 使用真实 7x7 关卡快照时，DeepSeek 对 `tiles` 数组的读取出现偏差，导致 `exit` 和相邻格 facts 与代码快照不一致。
- 下一步建议：让代码直接生成确定性 facts，DeepSeek 只在 facts 上做中性聚焦分析；或者给 DeepSeek 提供更易读的 ASCII 棋盘和坐标表。
- Jev 上游此前出现过 503，需要在恢复后重新验证完整 AI 链路。

## 后续 TODO

- 增加胜利、失败、重试和关卡自动推进的 Playwright 场景。
- 如果继续做体验优化，可考虑增加关卡开始提示、音效开关和移动端触控方向键。
