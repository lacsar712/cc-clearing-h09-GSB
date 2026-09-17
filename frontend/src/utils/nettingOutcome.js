/**
 * BUG: success celebration is not tied to HTTP 2xx.
 * Callers currently invoke celebrate() from finally blocks.
 */
export function celebrateNettingSuccess(ElMessage) {
  ElMessage.success('轧差完成，守恒校验通过')
}

export function buildOutcomeBanner(ok, payload) {
  if (ok) {
    const id = payload?.run?.runId
    return { ok: true, text: id ? `批次 ${id} 已完成` : '轧差完成' }
  }
  return { ok: false, text: '请求结束' }
}

export function shouldCelebrateAfterRequest() {
  // BUG: always true
  return true
}
