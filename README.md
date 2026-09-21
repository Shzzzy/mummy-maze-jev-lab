# -jev

---

## 木乃伊迷宫 · Jev 实验室

### 启动

1. 安装 Node.js 20 或更高版本。
2. 执行 `npm install`。
3. 在项目根目录创建 `.env`：

```text
OMNILABS_API_KEY=你的本地测试密钥
OMNILABS_BASE_URL=https://omnilabs.vibeadmin.cn
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

4. 执行 `npm start`。
5. 浏览器打开 `http://127.0.0.1:4173`。

### AI 决策流程

- DeepSeek 只分析局面并输出中性事实，不给出方向建议。
- 代码注入固定游戏规则和固定评分维度。
- Jev 对每个合法方向分别评分并返回置信度。
- 代码在合法动作中选择最高分方向并执行。

DeepSeek 调用需要有效的 DeepSeek API Key 和余额；Jev 调用免费。

### 操作

- 方向键：移动一格并触发怪物回合。
- `AI 自动`：由 DeepSeek 分析局面、Jev 评分，再由代码执行最高分方向。
- `重开本关`：恢复当前关初始状态。
- `导出 JSON`：导出完整局面事实、Jev 四方向评分和响应指标。

### 安全

真实 API Key 只保存在本地 `.env`，该文件已被 Git 忽略。不要把 `.env` 发送或提交到任何仓库。
