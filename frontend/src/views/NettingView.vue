<template>
  <div class="page">
    <h2 class="page-title">轧差执行</h2>
    <p class="page-desc">指定交割日与币种执行单币种多边轧差，校验 Σnet = 0</p>

    <el-alert
      v-if="lastOutcome.text"
      style="margin-bottom:12px"
      :type="lastOutcome.type"
      :closable="false"
      :title="lastOutcome.text"
    />
    <div class="card-panel">
      <div class="toolbar">
        <el-date-picker v-model="settleDate" type="date" value-format="YYYY-MM-DD" placeholder="交割日" />
        <el-select v-model="currency" style="width:120px">
          <el-option label="USD" value="USD" />
          <el-option label="CNY" value="CNY" />
          <el-option label="EUR" value="EUR" />
        </el-select>
        <el-button type="primary" :disabled="!auth.isOperator" :loading="running" @click="execute">执行轧差</el-button>
        <el-button @click="loadRuns">刷新批次</el-button>
      </div>
    </div>

    <div v-if="result" class="card-panel" style="margin-top:16px">
      <div class="toolbar" style="justify-content:space-between">
        <div>
          <strong>本次结果</strong>
          <el-tag style="margin-left:8px" :type="result.run.status === 'COMPLETED' ? 'success' : 'danger'">
            {{ result.run.status }}
          </el-tag>
          <span style="margin-left:12px">ΣnetAmount = {{ result.sumNetAmount }}</span>
        </div>
        <el-button link type="primary" @click="$router.push(`/netting-runs/${result.run.runId}`)">查看详情</el-button>
      </div>
      <el-table :data="result.positions" stripe>
        <el-table-column prop="memberId" label="会员 ID" min-width="220">
          <template #default="{ row }">
            <span class="mono">{{ row.memberId }}</span>
            <div>{{ nameOf(row.memberId) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="currency" label="币种" width="90" />
        <el-table-column prop="netAmount" label="净头寸（正应收/负应付）" min-width="200" />
      </el-table>
    </div>

    <div class="card-panel" style="margin-top:16px">
      <strong>历史批次</strong>
      <el-table :data="runs" v-loading="loading" stripe style="margin-top:12px">
        <el-table-column prop="runId" label="Run ID" min-width="220">
          <template #default="{ row }">
            <router-link class="mono" :to="`/netting-runs/${row.runId}`">{{ row.runId }}</router-link>
          </template>
        </el-table-column>
        <el-table-column prop="settleDate" label="交割日" width="120" />
        <el-table-column prop="currency" label="币种" width="90" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="failureReason" label="失败原因" min-width="180" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api/client'
import { buildOutcomeBanner, celebrateNettingSuccess, isNettingSuccess } from '../utils/nettingOutcome'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const settleDate = ref(new Date().toISOString().slice(0, 10))
const currency = ref('USD')
const running = ref(false)
const lastOutcome = ref({ type: 'info', text: '' })
const loading = ref(false)
const result = ref(null)
const runs = ref([])
const memberMap = ref({})

function nameOf(id) {
  return memberMap.value[id] || ''
}

async function loadRuns() {
  loading.value = true
  try {
    const [r, m] = await Promise.all([api.get('/netting-runs'), api.get('/members')])
    runs.value = r.data
    memberMap.value = Object.fromEntries(m.data.map((x) => [x.memberId, x.name]))
  } finally {
    loading.value = false
  }
}

async function execute() {
  running.value = true
  lastOutcome.value = { type: 'info', text: '执行中…' }
  try {
    const { data } = await api.post('/netting-runs', {
      settleDate: settleDate.value,
      currency: currency.value
    })
    if (!isNettingSuccess(data)) {
      // HTTP 2xx 但业务未成功（批次未 COMPLETED），按失败处理
      throw new Error(data?.run?.failureReason || `批次状态异常：${data?.run?.status ?? '未知'}`)
    }
    result.value = data
    // 仅成功路径：成功横幅 + 成功 toast
    lastOutcome.value = buildOutcomeBanner(true, data)
    celebrateNettingSuccess(ElMessage)
    await loadRuns()
  } catch (e) {
    result.value = null
    // 失败路径：错误横幅，绝不弹成功提示
    lastOutcome.value = buildOutcomeBanner(false, null, e)
    await loadRuns()
  } finally {
    running.value = false
  }
}

onMounted(loadRuns)
</script>
