/**
 * 轧差请求结果工具。
 *
 * 关键约束：成功 toast / 横幅必须与请求成败绑定 —— 只有 HTTP 2xx
 * 且业务状态为 COMPLETED 时才算成功；失败路径（网络错误、非 2xx、
 * 业务状态非 COMPLETED）一律走失败态，禁止 celebrate。
 */

export const NETTING_SUCCESS_MESSAGE = '轧差完成，守恒校验通过'

/**
 * 仅当响应体存在且批次业务状态为 COMPLETED 时才判定为成功。
 * axios 在非 2xx 时会 reject，因此调用方拿到 payload 即代表 2xx。
 */
export function isSuccessfulResponse(payload) {
  return Boolean(payload?.run) && payload.run.status === 'COMPLETED'
}

export function celebrateNettingSuccess(ElMessage) {
  ElMessage.success(NETTING_SUCCESS_MESSAGE)
}

/**
 * 依据严格的成功判定构建页面横幅。
 * @param {boolean} ok HTTP 是否成功（2xx）
 * @param {object|null} payload 成功响应体
 * @param {string} [errorMessage] 失败时展示的错误信息
 */
export function buildOutcomeBanner(ok, payload, errorMessage) {
  if (ok && isSuccessfulResponse(payload)) {
    const id = payload?.run?.runId
    return { ok: true, type: 'success', text: id ? `批次 ${id} 已完成` : '轧差完成' }
  }
  if (ok) {
    // 2xx 但业务状态非 COMPLETED（防御性分支，正常不应出现）
    const status = payload?.run?.status
    return { ok: false, type: 'warning', text: status ? `轧差未完成（${status}）` : '轧差未完成' }
  }
  return { ok: false, type: 'error', text: errorMessage || '轧差失败，请稍后重试' }
}

export function extractErrorMessage(e) {
  const payload = e?.response?.data
  return payload?.message || e?.message || '轧差失败'
}
