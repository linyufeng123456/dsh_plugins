/**
 * msg-locator — host half.
 *
 * 纯客户端功能的组合层插件行：消息目录/定位面板全部在浏览器半边实现，
 * 宿主半边不注册任何服务、不挂任何路由，仅为 Loader 提供插件入口。
 * @module msg-locator
 */

/** 插件名：与 cordis.patch.yml 的 insert.name 及客户端 bundle id 一致。 */
export const name = 'msg-locator'

/** 无硬依赖。 */
export const inject = []

/** 组合层入口：无需任何宿主端副作用。 */
export function apply() {}
