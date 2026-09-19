import {
  isSuccessfulResponse,
  buildOutcomeBanner,
  extractErrorMessage
} from '../src/utils/nettingOutcome.js'

let failures = 0
function assert(cond, name) {
  if (cond) {
    console.log(`PASS ${name}`)
  } else {
    console.error(`FAIL ${name}`)
    failures++
  }
}

// --- isSuccessfulResponse: 严格按 2xx(由调用方保证) + status===COMPLETED ---
assert(isSuccessfulResponse({ run: { runId: 'r1', status: 'COMPLETED' } }) === true,
  'COMPLETED payload -> success')
assert(isSuccessfulResponse({ run: { runId: 'r1', status: 'FAILED' } }) === false,
  'FAILED payload -> not success')
assert(isSuccessfulResponse(null) === false, 'null payload -> not success')
assert(isSuccessfulResponse(undefined) === false, 'undefined payload -> not success')
assert(isSuccessfulResponse({}) === false, 'payload without run -> not success')

// --- buildOutcomeBanner ---
const okBanner = buildOutcomeBanner(true, { run: { runId: 'R-1', status: 'COMPLETED' } })
assert(okBanner.ok === true && okBanner.type === 'success' && okBanner.text.includes('R-1'),
  'ok+COMPLETED -> success banner')

const failedBanner = buildOutcomeBanner(false, null, 'suspended member rejected: M1')
assert(failedBanner.ok === false && failedBanner.type === 'error' &&
  failedBanner.text === 'suspended member rejected: M1',
  'failure -> error banner with backend message')

const failedDefault = buildOutcomeBanner(false, null)
assert(failedDefault.ok === false && failedDefault.type === 'error',
  'failure without message -> error banner default text')

const weirdBanner = buildOutcomeBanner(true, { run: { status: 'FAILED' } })
assert(weirdBanner.ok === false && weirdBanner.type === 'warning',
  '2xx but business FAILED -> no success banner')

// --- extractErrorMessage: 模拟 axios 错误 ---
assert(extractErrorMessage({ response: { data: { code: 'SUSPENDED_MEMBER', message: 'suspended member rejected: M1' } } })
  === 'suspended member rejected: M1', 'extracts backend error message')
assert(extractErrorMessage({ message: 'Network Error' }) === 'Network Error',
  'falls back to axios message')
assert(extractErrorMessage({}) === '轧差失败', 'falls back to generic message')

// --- 模拟 NettingView.execute 的分支行为 ---
function simulateExecute(post) {
  const calls = { success: 0, error: 0 }
  const ElMessage = {
    success: () => calls.success++,
    error: () => calls.error++
  }
  // 内联复刻 execute 的判定流程（与 NettingView 保持一致）
  return (async () => {
    let banner
    try {
      const data = await post()
      if (!isSuccessfulResponse(data)) {
        banner = buildOutcomeBanner(true, data)
      } else {
        banner = buildOutcomeBanner(true, data)
        ElMessage.success('ok')
      }
    } catch (e) {
      banner = buildOutcomeBanner(false, null, extractErrorMessage(e))
      ElMessage.error(extractErrorMessage(e))
    }
    return { banner, calls }
  })()
}

// 失败路径：400 + SUSPENDED_MEMBER（停用会员制造的失败轧差）
const failResult = await simulateExecute(() =>
  Promise.reject(Object.assign(new Error('Request failed with status code 400'), {
    response: { status: 400, data: { code: 'SUSPENDED_MEMBER', message: 'suspended member rejected: M-ALPHA' } }
  })))
assert(failResult.calls.success === 0, 'FAILED netting: NO success toast')
assert(failResult.calls.error === 1, 'FAILED netting: error toast shown')
assert(failResult.banner.type === 'error' && failResult.banner.text.includes('M-ALPHA'),
  'FAILED netting: error banner distinct from success')

// 网络错误路径
const netResult = await simulateExecute(() => Promise.reject(new Error('Network Error')))
assert(netResult.calls.success === 0, 'network failure: NO success toast')
assert(netResult.banner.type === 'error', 'network failure: error banner')

// 成功路径
const successResult = await simulateExecute(() =>
  Promise.resolve({ run: { runId: 'R-OK', status: 'COMPLETED' }, positions: [], sumNetAmount: 0 }))
assert(successResult.calls.success === 1, 'successful netting: success toast fired exactly once')
assert(successResult.banner.type === 'success', 'successful netting: success banner')

if (failures) {
  console.error(`\n${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll assertions passed')
