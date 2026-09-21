Original prompt: 调用 develop-web-game技能优化下游戏

## 当前进度

- 已安装并读取 openai-develop-web-game 技能。
- 已修复 `/public/styles.css` 404，页面样式现在从 `/styles.css` 正常加载。
- 已新增 `window.render_game_to_text`，可输出关卡、回合、玩家、怪物、出口、状态和最近一次 AI 评分。
- 已新增 `window.advanceTime` 组合钩子，兼容 Playwright 虚拟时间脚本。
- 已新增全屏切换：`f` 进入或退出全屏，`Esc` 退出。
- 已新增窄屏单列布局和全屏时隐藏侧栏的样式。
- 已新增 favicon，消除浏览器 favicon 404。

## Playwright 验证

- 运行目录：`output/web-game/run-2`
- 已执行向右、向上两个动作，共产生 3 个回合。
- 状态从玩家 `(2,5)` 变为 `(3,4)`，怪物位置同步更新。
- 最新截图：`shot-0.png`、`shot-1.png`。
- console error：已清零。

## 后续 TODO

- 在可用的 DeepSeek 余额和 Jev 上游恢复后，重新验证 AI 自动模式的完整链路。
- 增加胜利、失败、重试和关卡自动推进的 Playwright 场景。
- 如果继续做体验优化，可考虑增加关卡开始提示、音效开关和移动端触控方向键。
