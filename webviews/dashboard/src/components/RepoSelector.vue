<template>
  <section class="input-block">
    <h3>➕ Thêm Repository &amp; PRs</h3>
    <div class="input-row">
      <select v-model="selectedRepo">
        <option value="">-- Chọn repo --</option>
        <option v-for="option in repoOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        v-model="prNumber"
        type="number"
        placeholder="Nhập PR number (ví dụ: 123)"
        @keyup.enter="handleAddPR"
      />
      <button @click="handleAddPR">➕ Thêm PR</button>
    </div>

    <div v-if="pendingPRs.length" class="pending-prs">
      <h4>PRs đã thêm (chưa xác nhận):</h4>
      <div class="pending-pr-list">
        <div
          v-for="pr in pendingPRs"
          :key="pr.number"
          class="pending-pr-item"
        >
          <div class="pending-pr-item-content">
            <a :href="pr.url" target="_blank">#{{ pr.number }}</a>
            <span>{{ pr.title }}</span>
            <code>{{ pr.base }}</code>
          </div>
          <button @click="removePending(pr.number)">🗑️</button>
        </div>
      </div>
      <div class="confirm-section">
        <button @click="confirmPending">✅ Xác nhận ({{ pendingPRs.length }})</button>
        <button @click="clearPending" class="secondary">🗑️ Xóa hết</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import dashboardStore from '../store/dashboard'

const prNumber = ref('')

const repoOptions = computed(() => dashboardStore.state.repoOptions)
const pendingPRs = computed(() => dashboardStore.state.pendingPRs)

const selectedRepo = computed({
  get: () => dashboardStore.state.selectedRepoValue,
  set: (value: string) => dashboardStore.selectRepo(value)
})

function handleAddPR() {
  const value = Number(prNumber.value)
  if (!value || value <= 0 || Number.isNaN(value)) {
    dashboardStore.notify('❌ Vui lòng nhập PR number hợp lệ')
    return
  }
  dashboardStore.requestAddPR(value)
  prNumber.value = ''
}

function removePending(prNumber: number) {
  dashboardStore.removePendingPR(prNumber)
}

function clearPending() {
  dashboardStore.clearPending()
}

function confirmPending() {
  dashboardStore.confirmPendingPRs()
}
</script>

<style scoped>
.input-block {
  margin-bottom: 24px;
  padding: 18px;
  border-radius: 10px;
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editorWidget-background);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
.input-row {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(150px, 0.6fr) auto;
  gap: 10px;
  margin-bottom: 14px;
}
.input-row select,
.input-row input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 6px;
  font-size: 13px;
}
.input-row button {
  padding: 10px 18px;
  cursor: pointer;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  transition: transform 0.1s ease, filter 0.1s ease;
}
.input-row button:hover {
  filter: brightness(1.05);
}
.input-row button:active {
  transform: translateY(1px);
}
.pending-prs {
  margin-top: 12px;
  padding: 14px;
  background: var(--vscode-editor-background);
  border-radius: 8px;
  border: 1px solid var(--vscode-panel-border);
}
.pending-pr-list {
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pending-pr-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: var(--vscode-editorWidget-background);
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid var(--vscode-panel-border);
}
.pending-pr-item-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.pending-pr-item-content span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pending-pr-item a {
  font-weight: 600;
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}
.pending-pr-item button {
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--vscode-button-secondaryBorder);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border-radius: 5px;
}
.confirm-section {
  display: flex;
  gap: 10px;
}
.confirm-section button {
  flex: 1;
  padding: 10px;
  font-size: 13px;
  border-radius: 6px;
}
.confirm-section button.secondary {
  border: 1px solid var(--vscode-button-secondaryBorder);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
</style>
