# whale-purse 🐋

一只住在 DeepSeek Harness（DSH）里的桌宠，帮你盯着 DeepSeek 账户余额和当前会话的用量/花费。点她弹出用量明细面板，拖她换位置（按方向播奔跑动画），位置自动记住；余额 30s、花费 3s 自动刷新，后台会话运行时头顶还会悬浮实时进度卡。

桌宠形象为 8×9 精灵表（9 态动画 + 活动触发）的 deepseek 宠物二创形象，由 JS 播放器逐帧驱动。

![deepseek 精灵表](assets/deepseek-sprite.webp)

## 特性

- 🐋 **鲸鱼娘桌宠**：8×9 精灵表悬浮在页面上，逐帧动画、脚底带投影
- 🎬 **动作模组**：9 态精灵动画（idle / running-left / running-right / waving / jumping / failed / waiting / running / review），帧时长按精灵表时序精确对齐
- 🏃 **拖拽奔跑**：按住拖动时按水平方向播放 running-left / running-right 奔跑帧动画；位置 `localStorage` 记忆，点击开面板
- ⚡ **活动触发状态机**：会话开始 / 收到新任务 → jumping 蹦跳；执行工具 → running；read/grep/glob 类工具 → review 翻阅；等待用户输入（询问）→ waiting；工具失败 → failed；任务完成 → waving 挥手 + 「任务完成啦」气泡（点击直达会话）
- 📊 **运行进程进度**：后台会话运行时，桌宠头顶实时悬浮「进度卡」——任务标题、当前动作（正在执行的工具 + 描述 / 思考中 / 输出中 / 工具失败）、任务清单进度条（todo 完成数）、目标轮次徽章（第 X/Y 轮）、已运行时长 / token / 步数；子任务带「子任务」徽章。点击卡片直达对应会话。数据经 `/api` 的 `session.history` RPC 读取，每 2s 刷新，无需重启 DSH 即生效
- 💰 **余额监视**：DeepSeek 官方 `Get User Balance` 接口，30s 轮询 + 并发去重
- 🧮 **会话用量**：读 `sessionProjections` 的 `tokenUsage` 投影，按官方价格折算花费（输入/缓存读/缓存写/输出分桶）
- ⚡ **峰谷定价**：北京 9:00-12:00 / 14:00-18:00 高峰价自动切换；官方定价页每 6h 自动抓取
- 🌗 **主题适配**：面板颜色跟随 DSH 浅色/深色主题（`--dsw-alias-*` token）
- 🖥️ **多屏适配**：外接大屏/笔记本切换时自动把桌宠夹回视口内，不会丢
- 🛡️ **友好错误**：余额/定价请求超时显示「请求超时」而非英文 `This operation was aborted`
- 🧩 **兼容 [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)**：适配其 Explorer 面板的浮层层级，桌宠拖进面板区域也不会被遮挡

## 安装

1. 把本仓库软链进你的 DSH web profile 依赖：

   ```bash
   # macOS / Linux
   ln -s /path/to/whale-purse ~/.dsh/profiles/web/node_modules/whale-purse

   # Windows（管理员终端）
   mklink /D %USERPROFILE%\.dsh\profiles\web\node_modules\whale-purse D:\path\to\whale-purse
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 里加一条 insert：

   ```yaml
   - insert:
       - id: whale-purse
         name: 'whale-purse'
         config:
           model: pro            # pro | flash
           refreshIntervalSeconds: 30
   ```

3. 保存后刷新浏览器即可（`Cmd+Shift+R` / `Ctrl+Shift+R`）。

余额接口需要能解析到 `DEEPSEEK_API_KEY`（凭据缝 → 启动环境 → `process.env`，逐层回退）。

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `model` | `pro` | 计价模型：`pro` / `flash` |
| `refreshIntervalSeconds` | `30` | 余额轮询间隔（秒） |
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | API key 的环境变量名 |
| `baseUrl` | `https://api.deepseek.com` | 余额接口 base URL |
| `pricingRefreshHours` | `6` | 官方定价页抓取间隔（小时） |
| `enabled` | `true` | 是否启用余额查询 |

## 项目结构

```
whale-purse/
├── lib/
│   ├── index.js        # host 端：余额服务 + HTTP 路由（/api/balance 等）
│   └── client.js       # 浏览器端：鲸鱼娘桌宠 + 精灵状态机 + 进程进度卡 + 账单面板（精灵表 base64 内联）
├── assets/
│   ├── deepseek-sprite.webp    # deepseek 精灵表（8×9 网格，144×156 帧，已压至 393KB）
│   ├── whale-sprite.png        # 旧版鲸鱼娘正面立绘（已弃用）
│   ├── whale-front-source.png  # 旧版立绘源图（已弃用）
│   └── preview.png             # 旧版立绘预览
└── scripts/screenshot.mjs      # Playwright 截图脚本
```

> 本项目为 DeepSeek / DSH 的非官方插件，与 DeepSeek 官方无关联。

## License

[MIT](LICENSE)
