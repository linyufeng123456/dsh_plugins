/**
 * msg-locator — browser half.
 *
 * 在当前会话中定位你发送过的消息：
 *  - 会话头部附加「定位消息」按钮（conversation.session.header.actions，零破坏）
 *  - 点击打开 shell.overlay 浮层消息目录：只列「你发送的消息」（user / steering
 *    节点，不含 AI 回复），按时间正序排列（最旧在上、最新在下，与聊天流一致），
 *    打开时自动滚到最底部并自动加载全部历史消息；点击任一条目滚动到聊天流
 *    对应锚点并闪烁高亮
 *  - 支持关键字过滤；自动加载走官方 ISession.loadOlder() 连续分页（停在底部
 *    时跟随底部，上滑查看更早消息时锚定位置）；Esc/外点关闭、切换会话自动关闭
 *
 * 数据全部来自官方会话系统：sessions.binding(sessionId).session 的可观察
 * ConversationSnapshot（只读叶子字段派生，不复制/序列化 live 数据）。
 * 跳转复用聊天流官方稳定锚点 [data-chat-anchor-key]（产品自身滚动恢复
 * 也用它），不修改官方渲染、不增加后端接口。
 *
 * 本 bundle 为手写纯 ES（无构建步骤）：React 经 require 种子词注入，
 * 样式以 <style> 注入，导出 cordis 客户端插件面（apply/inject）。
 * @module msg-locator/client
 */
window.__ModuleLoader__.load({
  id: 'msg-locator',
  factory: (require) => {
    const React = require('react')
    const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useSyncExternalStore } = React
    const h = React.createElement
    const { Fragment } = React

    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const IconListPen = primitives.IconListPenOutline16
    const IconSearch = primitives.IconSearchOutline16
    const IconClose = primitives.IconCloseFill14

    const NS = 'msgLocator'

    // ---------------------------------------------------------------------
    // 字典
    // ---------------------------------------------------------------------
    const zh = {
      'ml.open': '定位消息',
      'ml.title': '定位消息',
      'ml.searchPlaceholder': '过滤消息…',
      'ml.loadedCount': '已加载 {n} 条消息',
      'ml.loadingAll': '正在加载全部消息…',
      'ml.allLoaded': '已加载全部',
      'ml.capped': '已加载 {n} 条（会话过长，更早的消息未载入）',
      'ml.empty': '本会话还没有消息',
      'ml.noMatches': '无匹配消息',
      'ml.today': '今天',
      'ml.yesterday': '昨天',
      'ml.image': '[图片]',
      'ml.jumpFailed': '未找到对应消息（可能尚未加载）',
      'ml.close': '关闭',
      'ml.hint.title': '点击条目可跳转到聊天流中的对应位置',
    }
    const en = {
      'ml.open': 'Locate',
      'ml.title': 'Locate messages',
      'ml.searchPlaceholder': 'Filter messages…',
      'ml.loadedCount': '{n} messages loaded',
      'ml.loadingAll': 'Loading all messages…',
      'ml.allLoaded': 'All messages loaded',
      'ml.capped': '{n} loaded (session too long; earlier messages not loaded)',
      'ml.empty': 'No messages in this session yet',
      'ml.noMatches': 'No matching messages',
      'ml.today': 'Today',
      'ml.yesterday': 'Yesterday',
      'ml.image': '[image]',
      'ml.jumpFailed': 'Message not found (may not be loaded yet)',
      'ml.close': 'Close',
      'ml.hint.title': 'Click an entry to jump to it in the chat flow',
    }

    // ---------------------------------------------------------------------
    // 样式（跟随 DSH 主题 token --dsw-alias-*，明暗自动切换）
    // ---------------------------------------------------------------------
    const CSS = `
      .ml-trigger {
        display: inline-flex; align-items: center; gap: 4px;
        cursor: pointer; background: none; border: none;
        padding: 3px 8px; border-radius: 8px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px; line-height: 18px;
      }
      .ml-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .ml-trigger[aria-expanded="true"] { color: var(--dsw-alias-label-primary); }

      .ml-panel {
        position: fixed; z-index: 10;
        width: 340px; display: flex; flex-direction: column;
        background: var(--dsw-alias-bg-overlay);
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 12px;
        box-shadow: var(--dsw-shadow-lv3, 0 12px 32px rgba(0, 0, 0, .18));
        overflow: hidden;
        font-size: 13px; color: var(--dsw-alias-label-primary);
      }
      .ml-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; padding: 10px 12px 6px; flex: none;
      }
      .ml-title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ml-close {
        display: inline-flex; align-items: center; justify-content: center;
        flex: none; width: 22px; height: 22px; cursor: pointer;
        background: none; border: none; border-radius: 6px;
        color: var(--dsw-alias-label-secondary); padding: 0;
      }
      .ml-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }

      .ml-search {
        display: flex; align-items: center; gap: 6px;
        margin: 0 12px 8px; padding: 5px 8px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1); flex: none;
      }
      .ml-search:focus-within { border-color: var(--dsw-alias-brand-primary); }
      .ml-search-icon { color: var(--dsw-alias-label-secondary); flex: none; }
      .ml-search-input {
        flex: 1; min-width: 0; border: none; outline: none; background: transparent;
        color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; padding: 0;
      }
      .ml-search-input::placeholder { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }

      .ml-meta {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 0 12px 6px; color: var(--dsw-alias-label-secondary);
        font-size: 11px; line-height: 16px; flex: none;
      }
      .ml-status[data-state="loading"] { color: var(--dsw-alias-brand-primary); }

      .ml-hint {
        padding: 0 12px 6px; color: var(--dsw-alias-state-warn-primary);
        font-size: 11px; line-height: 16px; flex: none;
      }

      .ml-list { overflow-y: auto; min-height: 0; flex: 1; padding: 0 6px 8px; }
      .ml-group-label { padding: 6px 8px 2px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
      .ml-item {
        display: flex; align-items: baseline; gap: 8px; width: 100%;
        text-align: left; border: none; background: none; cursor: pointer;
        padding: 6px 8px; border-radius: 8px; color: var(--dsw-alias-label-primary);
      }
      .ml-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .ml-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
      .ml-item-text {
        flex: 1; min-width: 0; font-size: 12px; line-height: 18px;
        overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow-wrap: anywhere;
      }
      .ml-item-time {
        flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
      }
      .ml-empty { padding: 16px 12px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }

      /* 跳转后目标消息的闪烁高亮（挂到聊天流锚点行上，动画结束自动还原） */
      .ml-flash { animation: ml-flash 1.3s ease-out; border-radius: 6px; }
      @keyframes ml-flash {
        0% { box-shadow: inset 0 0 0 2px var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }
        100% { box-shadow: inset 0 0 0 2px transparent; background: transparent; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ml-flash { animation: none; box-shadow: inset 0 0 0 2px var(--dsw-alias-brand-primary); }
      }
    `

    function installCss() {
      if (document.getElementById('msg-locator-style') !== null) return
      const tag = document.createElement('style')
      tag.id = 'msg-locator-style'
      tag.dataset.plugin = 'msg-locator'
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // ---------------------------------------------------------------------
    // 面板共享状态：打开与否 / 目标会话 / 触发按钮矩形
    // ---------------------------------------------------------------------
    let panelState = { open: false, sessionId: null, anchor: null }
    const panelListeners = new Set()
    function emitPanel() { for (const fn of panelListeners) fn() }
    function setPanel(patch) {
      panelState = { ...panelState, ...patch }
      emitPanel()
    }
    function usePanel() {
      return useSyncExternalStore(
        useCallback((cb) => {
          panelListeners.add(cb)
          return () => panelListeners.delete(cb)
        }, []),
        () => panelState,
      )
    }

    // ---------------------------------------------------------------------
    // 消息条目派生：从官方 ChatSnapshot 读取叶子字段，构建自有纯数据
    // ---------------------------------------------------------------------

    /** 文本块压平：用户内容块以 `type === 'text'` 判别（与官方 contentParts 一致）。 */
    function textOfBlocks(blocks) {
      if (!Array.isArray(blocks)) return ''
      const parts = []
      for (const block of blocks) {
        if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      return parts.join('').trim()
    }

    /** 块集合里是否含图片（用于「[图片]」占位）。 */
    function hasImageBlock(blocks) {
      if (!Array.isArray(blocks)) return false
      return blocks.some((block) => block !== null && typeof block === 'object' && block.type === 'image')
    }

    /**
     * 从会话快照的 chat 切片派生「我发送的消息」条目（旧→新，与聊天流顺序一致：
     * 最旧在上、最新在下）。只取用户消息节点（kind === 'user' / 'steering'），
     * 不包含 AI 回复。只读取 leaf 字段（key/kind/visibility/time/content/block），
     * 不复制或序列化任何 live 对象。
     * @param chat - ConversationSnapshot.chat
     * @param t - 翻译函数
     * @returns {{ key: string, role: 'user', time: number, text: string }[]}
     */
    function deriveEntries(chat, t) {
      const entries = []
      if (chat === null || chat === undefined || typeof chat !== 'object') return entries
      const order = Array.isArray(chat.order) ? chat.order : []
      const nodes = chat.nodes !== null && typeof chat.nodes === 'object' ? chat.nodes : null
      if (nodes === null || typeof nodes.get !== 'function') return entries
      for (let i = 0; i < order.length; i++) {
        const node = nodes.get(order[i])
        if (node === null || node === undefined || typeof node !== 'object') continue
        if (node.visibility !== undefined && node.visibility !== 'visible') continue
        if (node.kind !== 'user' && node.kind !== 'steering') continue
        const data = node.data
        if (data === null || data === undefined || typeof data !== 'object') continue
        const key = node.key
        if (typeof key !== 'string') continue
        const text = textOfBlocks(data.content)
        entries.push({
          key,
          role: 'user',
          time: typeof data.time === 'number' ? data.time : 0,
          text: text !== '' ? text : (hasImageBlock(data.content) ? t('ml.image') : ''),
        })
      }
      return entries
    }

    /** 本地时区的「今天/昨天/M月d日/yyyy年M月d日」标签。 */
    function startOfDay(ts) {
      const d = new Date(ts)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    function dayLabel(ts, now, t) {
      const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000)
      if (diffDays <= 0) return t('ml.today')
      if (diffDays === 1) return t('ml.yesterday')
      const d = new Date(ts)
      if (d.getFullYear() === new Date(now).getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    }

    /** 条目按日期分组（保持旧→新顺序）。 */
    function groupEntries(entries, t) {
      const now = Date.now()
      const groups = []
      let current = null
      for (const entry of entries) {
        const label = dayLabel(entry.time, now, t)
        if (current === null || current.label !== label) {
          current = { label, items: [] }
          groups.push(current)
        }
        current.items.push(entry)
      }
      return groups
    }

    function formatTime(ts) {
      if (typeof ts !== 'number' || !Number.isFinite(ts)) return ''
      const d = new Date(ts)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }

    // ---------------------------------------------------------------------
    // 跳转与高亮：复用聊天流官方锚点 [data-chat-anchor-key]
    // ---------------------------------------------------------------------
    let flashedEl = null
    let flashTimer = null

    function clearFlash() {
      if (flashTimer !== null) {
        clearTimeout(flashTimer)
        flashTimer = null
      }
      if (flashedEl !== null) {
        flashedEl.classList.remove('ml-flash')
        flashedEl = null
      }
    }

    function flashRow(el) {
      clearFlash()
      el.classList.add('ml-flash')
      flashedEl = el
      flashTimer = setTimeout(() => {
        if (flashedEl !== null) flashedEl.classList.remove('ml-flash')
        flashedEl = null
        flashTimer = null
      }, 1400)
    }

    function findAnchorRow(key) {
      const rows = document.querySelectorAll('[data-chat-anchor-key]')
      for (const row of rows) {
        if (row.dataset.chatAnchorKey === key) return row
      }
      return null
    }

    /** 滚动到指定消息锚点并闪烁；未渲染（未加载）返回 false。 */
    function jumpToKey(key) {
      const row = findAnchorRow(key)
      if (row === null) return false
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      flashRow(row)
      return true
    }

    // ---------------------------------------------------------------------
    // 会话头部按钮
    // ---------------------------------------------------------------------
    function HeaderButton({ sessionId, t }) {
      const state = usePanel()
      const btnRef = useRef(null)
      const isOpen = state.open && state.sessionId === sessionId

      const toggle = () => {
        if (isOpen) {
          clearFlash()
          setPanel({ open: false })
          return
        }
        const el = btnRef.current
        const rect = el !== null ? el.getBoundingClientRect() : null
        setPanel({
          open: true,
          sessionId,
          anchor: rect === null
            ? null
            : { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        })
      }

      return h('button', {
        ref: btnRef,
        type: 'button',
        className: 'ml-trigger',
        'data-msg-locator-trigger': '',
        'aria-haspopup': 'dialog',
        'aria-expanded': isOpen,
        title: t('ml.open'),
        onClick: toggle,
      },
        h(IconListPen, { size: 14 }),
        h('span', { className: 'ml-trigger-label' }, t('ml.open')),
      )
    }

    // ---------------------------------------------------------------------
    // 浮层消息目录面板
    // ---------------------------------------------------------------------
    const PANEL_WIDTH = 340
    const PANEL_MAX_HEIGHT = 520
    const EDGE = 8

    function LocatorPanel({ sessions, t }) {
      const state = usePanel()
      const [query, setQuery] = useState('')
      const [jumpHint, setJumpHint] = useState('')
      const [pos, setPos] = useState(null)

      const sessionId = state.open ? state.sessionId : null

      // 绑定打开时指定的会话（切换会话后由 currentId 检测自动关闭）
      const face = useMemo(() => {
        if (sessionId === null || sessions === undefined || typeof sessions.binding !== 'function') return null
        const binding = sessions.binding(sessionId)
        return binding !== null && binding !== undefined ? binding.session ?? null : null
      }, [sessions, sessionId])

      const subscribeSession = useCallback(
        (cb) => (face !== null && typeof face.subscribe === 'function' ? face.subscribe(cb) : () => {}),
        [face],
      )
      const snapshot = useSyncExternalStore(
        subscribeSession,
        () => (face !== null && typeof face.getSnapshot === 'function' ? face.getSnapshot() : null),
      )

      // 当前会话变化 → 关闭面板，避免跳到别的会话
      const subscribeCurrent = useCallback(
        (cb) => (sessions !== undefined && sessions.list !== undefined && typeof sessions.list.subscribe === 'function'
          ? sessions.list.subscribe(cb)
          : () => {}),
        [sessions],
      )
      const currentId = useSyncExternalStore(
        subscribeCurrent,
        () => {
          const snap = sessions?.list?.getSnapshot?.()
          return snap !== null && typeof snap === 'object' ? snap.current ?? null : null
        },
      )
      useEffect(() => {
        if (sessionId !== null && currentId !== null && currentId !== sessionId) {
          clearFlash()
          setPanel({ open: false })
        }
      }, [currentId, sessionId])

      // Esc / 点击面板与触发按钮之外 → 关闭
      useEffect(() => {
        if (!state.open) return
        const onDown = (event) => {
          const target = event.target
          if (target instanceof Element) {
            if (target.closest('.ml-panel') !== null) return
            if (target.closest('[data-msg-locator-trigger]') !== null) return
          }
          clearFlash()
          setPanel({ open: false })
        }
        const onKey = (event) => {
          if (event.key === 'Escape') {
            clearFlash()
            setPanel({ open: false })
          }
        }
        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('pointerdown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [state.open])

      // 面板定位：优先开在按钮下方，空间不足翻到上方；窗口变化时重算
      useEffect(() => {
        if (!state.open) {
          setPos(null)
          return
        }
        const compute = () => {
          const vw = window.innerWidth
          const vh = window.innerHeight
          const height = Math.min(PANEL_MAX_HEIGHT, Math.max(220, vh - 144))
          const anchor = state.anchor
          if (anchor === null || typeof anchor !== 'object') {
            setPos({ left: Math.max(EDGE, vw - PANEL_WIDTH - 16), top: 72, height })
            return
          }
          let left = Math.round(anchor.right - PANEL_WIDTH)
          left = Math.max(EDGE, Math.min(left, vw - PANEL_WIDTH - EDGE))
          let top = Math.round(anchor.bottom + 6)
          if (top + height > vh - EDGE) top = Math.max(EDGE, Math.round(anchor.top - height - 6))
          setPos({ left, top, height })
        }
        compute()
        window.addEventListener('resize', compute)
        return () => window.removeEventListener('resize', compute)
      }, [state.open, state.anchor])

      const chat = snapshot !== null && typeof snapshot === 'object' ? snapshot.chat : null
      const entries = useMemo(() => deriveEntries(chat, t), [chat, t])
      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (q === '') return entries
        return entries.filter((entry) => entry.text.toLowerCase().includes(q))
      }, [entries, query])
      const grouped = useMemo(() => groupEntries(filtered, t), [filtered, t])

      const onJump = (key) => {
        setJumpHint(jumpToKey(key) ? '' : t('ml.jumpFailed'))
      }
      const close = () => {
        clearFlash()
        setPanel({ open: false })
      }

      // 列表滚动：打开时/首批数据到达时滚到底部（最新消息在最下方，立即可见）
      const listRef = useRef(null)
      const lastTotalRef = useRef(0)
      const anchorRef = useRef(null)
      const followBottomRef = useRef(false)
      useLayoutEffect(() => {
        const list = listRef.current
        if (list === null) return
        if (!state.open) {
          lastTotalRef.current = 0
          anchorRef.current = null
          followBottomRef.current = false
          return
        }
        if (followBottomRef.current) {
          followBottomRef.current = false
          list.scrollTop = list.scrollHeight
          lastTotalRef.current = entries.length
          return
        }
        if (anchorRef.current !== null) {
          const firstItem = list.querySelector('.ml-item')
          const newTop = firstItem !== null ? firstItem.offsetTop : 0
          list.scrollTop = anchorRef.current.scrollTop + (newTop - anchorRef.current.firstTop)
          anchorRef.current = null
          lastTotalRef.current = entries.length
          return
        }
        const was = lastTotalRef.current
        lastTotalRef.current = entries.length
        if (was === 0 && entries.length > 0) list.scrollTop = list.scrollHeight
      }, [state.open, entries.length])

      // 自动加载全部历史消息：打开面板后连续调用官方 loadOlder()，
      // 直到 hasMore 为假（或达到安全上限）。停在底部时跟随底部，
      // 用户上滑查看更早消息时锚定当前位置。
      const AUTO_LOAD_MAX_PAGES = 300
      const autoPageRef = useRef(0)
      useEffect(() => {
        if (!state.open) {
          autoPageRef.current = 0
          return
        }
        if (face === null || snapshot === null) return
        if (snapshot.loadingOlder === true || snapshot.hasMore !== true) return
        if (autoPageRef.current >= AUTO_LOAD_MAX_PAGES) return
        const list = listRef.current
        if (list !== null) {
          const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 24
          if (nearBottom) followBottomRef.current = true
          else {
            const firstItem = list.querySelector('.ml-item')
            anchorRef.current = {
              scrollTop: list.scrollTop,
              firstTop: firstItem !== null ? firstItem.offsetTop : 0,
            }
          }
        }
        autoPageRef.current += 1
        void face.loadOlder()
      }, [state.open, face, snapshot])

      if (!state.open || sessionId === null) return null

      const hasMore = snapshot?.hasMore === true
      const loadingOlder = snapshot?.loadingOlder === true
      const opening = snapshot?.openState === 'loading'
      const total = entries.length
      const autoLoading = snapshot !== null && (loadingOlder || (hasMore && autoPageRef.current < AUTO_LOAD_MAX_PAGES))
      const capped = hasMore && autoPageRef.current >= AUTO_LOAD_MAX_PAGES

      return h('div', {
        className: 'ml-panel',
        role: 'dialog',
        'aria-label': t('ml.title'),
        'data-testid': 'msg-locator-panel',
        style: pos !== null ? { left: `${pos.left}px`, top: `${pos.top}px`, height: `${pos.height}px` } : undefined,
      },
        h('header', { className: 'ml-head' },
          h('span', { className: 'ml-title' }, t('ml.title')),
          h('button', {
            type: 'button',
            className: 'ml-close',
            'aria-label': t('ml.close'),
            title: t('ml.close'),
            onClick: close,
          }, h(IconClose, { size: 14 })),
        ),
        h('div', { className: 'ml-search' },
          h(IconSearch, { size: 14, className: 'ml-search-icon' }),
          h('input', {
            className: 'ml-search-input',
            type: 'search',
            placeholder: t('ml.searchPlaceholder'),
            'aria-label': t('ml.searchPlaceholder'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        (hasMore || total > 0) && h('div', { className: 'ml-meta' },
          h('span', null, t('ml.loadedCount', { n: total })),
          autoLoading && h('span', { className: 'ml-status', 'data-state': 'loading' }, t('ml.loadingAll')),
          capped && h('span', { className: 'ml-status', 'data-state': 'capped' }, t('ml.capped', { n: total })),
          !autoLoading && !capped && total > 0 && h('span', { className: 'ml-status', 'data-state': 'done' }, t('ml.allLoaded')),
        ),
        jumpHint !== '' && h('div', { className: 'ml-hint' }, jumpHint),
        h('div', { className: 'ml-list', role: 'list', ref: listRef },
          opening && total === 0 && h('div', { className: 'ml-empty' }, t('ml.loadingAll')),
          !opening && grouped.length === 0 && h('div', { className: 'ml-empty' },
            query.trim() !== '' ? t('ml.noMatches') : (autoLoading ? t('ml.loadingAll') : t('ml.empty'))),
          grouped.map((group) => h(Fragment, { key: group.label },
            h('div', { className: 'ml-group-label' }, group.label),
            group.items.map((entry) => h('button', {
              type: 'button',
              className: 'ml-item',
              key: entry.key,
              onClick: () => onJump(entry.key),
            },
              h('span', { className: 'ml-item-text' }, entry.text),
              h('span', { className: 'ml-item-time' }, formatTime(entry.time)),
            )),
          )),
        ),
      )
    }

    // ---------------------------------------------------------------------
    // 插件面
    // ---------------------------------------------------------------------
    const inject = ['slots', 'locale', 'sessions']

    function apply(ctx) {
      installCss()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'msg-locator: dictionaries')

      ctx.inject(['slots', 'sessions'], (scope) => {
        const disposeHeader = scope.slots.register({
          name: 'conversation.session.header.actions',
          id: 'msg-locator',
          order: 30,
          locale: NS,
        }, HeaderButton)
        const disposePanel = scope.slots.register({
          name: 'shell.overlay',
          id: 'msg-locator-panel',
          order: 140,
          locale: NS,
          inject: () => ({ sessions: scope.get('sessions') }),
        }, LocatorPanel)
        return () => {
          disposeHeader()
          disposePanel()
        }
      }, 'msg-locator: slot registrations')
    }

    return { apply, inject, HeaderButton, LocatorPanel, deriveEntries, groupEntries, formatTime }
  },
})
