# whale-purse

DeepSeek Harness 的桌宠插件：显示 DeepSeek 账户余额 + 多订阅用量/花费（内置网关适配器 + 配置可扩展）；deepseek 精灵表桌宠（9 态动画 + 活动触发状态机），可拖拽、点击开面板；后台会话运行时头顶悬浮进度卡。

## 技术栈

- 语言：纯 ES（无构建步骤），服务端纯 ESM cordis 插件，浏览器端经 `window.__ModuleLoader__` 注入
- 框架：React（经 require 种子词注入）、cordis（DSH 组合层）
- 素材：deepseek 精灵表（8×9 网格，`assets/deepseek-sprite.webp`，base64 内联进 client.js）
- 动画：JS 精灵播放器，9 态（idle / running-left / running-right / waving / jumping / failed / waiting / running / review）
- 订阅用量：host 端内置网关适配器（opencode-go / openrouter / openai / xai）+ `config.subscriptions` 声明扩展；本会话花费按内置 pi-ai 价目表折算

## 启动

```bash
# 安装（软链进 DSH web profile）
ln -s "$(pwd)" ~/.dsh/profiles/web/node_modules/whale-purse

# 在 ~/.dsh/profiles/web/cordis.patch.yml 加 insert（见 README.md），保存即热重载
# 刷新浏览器：Cmd+Shift+R
```

## 注意

- 精灵表 base64 内联在 `lib/client.js` 里（约 630KB），改动后刷新浏览器即可生效，无需构建。
- 服务端 `lib/index.js` 改动需重启 DSH 进程才完全生效（客户端有兜底）。
- 截图脚本 `scripts/screenshot.mjs` 依赖本机 playwright-core 缓存路径，仅本地调试用。
