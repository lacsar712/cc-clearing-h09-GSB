import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { nextTick } from 'vue'

// 模拟 axios 风格的 api client
const mockPost = vi.fn()
const mockGet = vi.fn()
vi.mock('../src/api/client.js', () => ({
  default: {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } }
  }
}))

import NettingView from '../src/views/NettingView.vue'
import { useAuthStore } from '../src/stores/auth.js'

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: ['to'],
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.())
  }
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.role = 'OPERATOR'
  return mount(NettingView, {
    global: {
      plugins: [pinia, ElementPlus],
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $router: { push: vi.fn() } }
    }
  })
}

function successPayload(runId = 'RUN-OK') {
  return {
    run: { runId, settleDate: '2026-09-19', currency: 'USD', status: 'COMPLETED', failureReason: null },
    positions: [],
    sumNetAmount: 0
  }
}

function axiosError(status, body) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: body }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: [] })
  document.body.innerHTML = ''
})

describe('NettingView 轧差成功提示', () => {
  it('失败路径(停用会员 SUSPENDED_MEMBER, 400)：不弹成功 toast，展示错误横幅', async () => {
    mockPost.mockRejectedValueOnce(
      axiosError(400, { code: 'SUSPENDED_MEMBER', message: 'suspended member rejected: M-ALPHA' })
    )
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button.el-button--primary').trigger('click')
    await flushPromises()
    await nextTick()

    // 不允许出现成功 toast
    const successToast = document.body.querySelector('.el-message--success')
    expect(successToast, '失败路径不应出现成功 toast').toBeNull()

    // 应出现错误 toast（api client 拦截器在真实环境会弹，组件自身只保证不 celebrate）
    // 页面内横幅必须是 error 类型且含后端错误信息，与成功横幅可区分
    const errorAlert = wrapper.find('.el-alert--error')
    expect(errorAlert.exists(), '失败路径应展示 error 横幅').toBe(true)
    expect(errorAlert.text()).toContain('suspended member rejected: M-ALPHA')
    expect(wrapper.find('.el-alert--success').exists()).toBe(false)
  })

  it('失败路径(网络错误)：不弹成功 toast，展示失败态', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button.el-button--primary').trigger('click')
    await flushPromises()
    await nextTick()

    expect(document.body.querySelector('.el-message--success')).toBeNull()
    const errorAlert = wrapper.find('.el-alert--error')
    expect(errorAlert.exists()).toBe(true)
    expect(errorAlert.text()).toContain('Network Error')
  })

  it('成功路径(2xx + COMPLETED)：弹一次成功 toast，展示成功横幅', async () => {
    mockPost.mockResolvedValueOnce({ data: successPayload('RUN-OK-1') })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button.el-button--primary').trigger('click')
    await flushPromises()
    await nextTick()

    const successToasts = document.body.querySelectorAll('.el-message--success')
    expect(successToasts.length, '成功路径应恰好弹一次成功 toast').toBe(1)
    expect(successToasts[0].textContent).toContain('轧差完成')

    const successAlert = wrapper.find('.el-alert--success')
    expect(successAlert.exists()).toBe(true)
    expect(successAlert.text()).toContain('RUN-OK-1')
  })
})
