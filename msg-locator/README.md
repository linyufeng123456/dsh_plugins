# msg-locator 🎯

> DSH Web GUI 插件：在**当前对话**中快速定位你发送过的消息。

会话头部新增「定位消息」按钮，点击打开浮层消息目录——只列出本会话中**你发送的消息**（不含 AI 回复），按时间正序排列（最旧在上、最新在下，与聊天流一致，打开即定位到最新一条），并**自动加载全部历史消息**（无需手动点击，向上滑查看更早的消息）；点击任意条目，聊天流平滑滚动到对应位置并闪烁高亮；支持关键字过滤。

## 特性

- 🎯 **点击即跳转**：复用聊天流官方锚点 `[data-chat-anchor-key]`（产品自身滚动恢复所用契约），不碰官方渲染、不加后端接口
- 🙋 **只列你发送的消息**：面板仅包含用户消息节点（`user` / `steering`），AI 回复与工具调用一律不出现
- 🔍 **会话内过滤**：按关键字过滤你发送过的消息（区别于官方侧边栏的跨会话搜索）
- 🕘 **时间正序**：最旧在上、最新在下（与聊天流方向一致），打开自动滚到最新一条；今天 / 昨天 / M月d日 / yyyy年M月d日 分组
- 📜 **自动加载全部历史**：打开面板即通过官方 `ISession.loadOlder()` 连续分页拉全本会话消息；停在底部自动跟随最新，上滑查看时锚定位置不跳动
- ✨ **跳转高亮**：目标消息闪烁 1.3s（跟随 `prefers-reduced-motion`）
- 🛡️ **会话隔离**：面板绑定打开时的会话快照；切换会话自动关闭，绝不把 A 的跳转落到 B
- ⌨️ **键盘友好**：Esc 关闭、点击面板外关闭、窗口尺寸变化自动重算位置
- 🌗 **主题适配**：全部使用官方设计 token（`--dsw-alias-*`），明暗模式自动切换
- 🌏 **双语**：中文 / English，跟随 DSH 界面语言

## 原理

数据全部来自官方会话系统，不另建存储：

- 消息条目从 `sessions.binding(sessionId).session` 的可观察 `ConversationSnapshot` 派生（只读叶子字段：`chat.order` / 节点 `kind`、`time`、文本块）
- 面板放在 `shell.overlay` 浮层，触发按钮挂在 `conversation.session.header.actions` 附加位（`replaceRisk: none`，不影响任何现有头部按钮）

## 安装

1. 把本仓库链接进你的 DSH web profile 依赖：

   ```bash
   # macOS / Linux
   ln -s /path/to/msg-locator ~/.dsh/profiles/web/node_modules/msg-locator
   # Windows（管理员终端）
   mklink /J "%USERPROFILE%\.dsh\profiles\web\node_modules\msg-locator" D:\path\to\msg-locator
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 里加一条 insert：

   ```yaml
   - insert:
       - id: msg-locator
         name: 'msg-locator'
   ```

3. 保存后刷新浏览器即可（`Cmd+Shift+R`）。

## 项目结构

```
msg-locator/
├── lib/
│   ├── index.js    # host 半边：空插件行（无宿主端副作用）
│   └── client.js   # 浏览器半边：头部按钮 + 浮层消息目录 + 跳转高亮
└── package.json    # dsh.client 注入清单 + ./client 导出
```

## 验证

`D:\agent_cli\cli\deepseek\workspace\plugins\verify\verify-msg-locator.mjs`（Playwright）：

1. 面板可打开、列出消息条目
2. 点击条目 → 聊天流对应锚点行出现 `ml-flash` 高亮
3. 关键字过滤生效、无匹配显示空态
4. Esc / 外点关闭
5. 全程无控制台 error / 无 4xx-5xx 请求

## License

[MIT](LICENSE)
