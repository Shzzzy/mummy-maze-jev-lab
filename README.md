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
```

4. 执行 `npm start`。
5. 浏览器打开 `http://127.0.0.1:4173`。

### 操作

- 方向键：移动一格并触发怪物回合。
- `AI 自动`：由 Jev 逐回合选择方向。
- `重开本关`：恢复当前关初始状态。
- `导出 JSON`：导出完整 Jev 判断和响应指标。

### 安全

真实 API Key 只保存在本地 `.env`，该文件已被 Git 忽略。不要把 `.env` 发送或提交到任何仓库。
