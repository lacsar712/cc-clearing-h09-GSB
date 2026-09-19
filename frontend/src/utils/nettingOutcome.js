/**
 * 轧差结果提示工具。
 *
 * 约定：成功提示（toast / 横幅）只允许在「HTTP 2xx 且业务成功」时触发；
 * 失败路径一律走错误横幅，不得 celebrate。
 * 调用方应在请求成功分支内调用 celebrateNettingSuccess，
 * 不得在 finally 等无条件位置调用。
 */

/** 业务成功判定：批次状态为 COMPLETED 才算轧差成功 */
export function isNettingSuccess(payload) {
  return payload?.run?.status === 'COMPLETED'
}

/** 是否允许成功提示：请求成功（ok）且业务成功，二者缺一不可 */
export function shouldCelebrateAfterRequest(ok, payload) {
  return ok === true && isNettingSuccess(payload)
}

/** 成功 toast —— 只允许在已确认成功的路径里调用 */
export function celebrateNettingSuccess(ElMessage) {
  ElMessage.success('轧差完成，守恒校验通过')
}

/**
 * 构建结果横幅。
 * 成功：{ type: 'success', text: '批次 <runId> 已完成' }
 * 失败：{ type: 'error',   text: '轧差失败：<原因>' }，与成功横幅明确区分
 */
export function buildOutcomeBanner(ok, payload, error) {
  if (shouldCelebrateAfterRequest(ok, payload)) {
    const id = payload?.run?.runId
    return { type: 'success', text: id ? `批次 ${id} 已完成` : '轧差完成' }
  }
  const msg =
    error?.response?.data?.message ||
    payload?.run?.failureReason ||
    error?.message ||
    '请求失败'
  return { type: 'error', text: `轧差失败：${msg}` }
}
