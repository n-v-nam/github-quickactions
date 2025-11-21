<template>
  <section class="settings-block">
    <div class="settings-header">
      <h3>⚙️ Repo Settings</h3>
      <p>Chỉnh base branch và deploy branches cho từng repo. Các thay đổi sẽ lưu vào VSCode Settings.</p>
    </div>
    <div v-if="hasEntries" class="settings-grid">
      <div
        v-for="([repo, entry]) in branchEntries"
        :key="repo"
        class="settings-card"
        :class="{ dirty: isDirty(repo) }"
      >
        <div class="card-header">
          <div class="card-title">
            <h4>
              <span v-if="repo === 'default'">🌐 Default</span>
              <span v-else>{{ repo }}</span>
            </h4>
            <small v-if="repo === 'default'">Áp dụng mặc định cho repo chưa cấu hình riêng</small>
          </div>
          <div class="card-actions">
            <button
              class="secondary"
              :disabled="isSaving(repo)"
              @click="reset(repo)"
            >
              ↩︎ Reset
            </button>
            <button
              :disabled="isSaving(repo) || !isDirty(repo)"
              @click="save(repo)"
            >
              {{ isSaving(repo) ? '💾 Đang lưu...' : '💾 Lưu' }}
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="field-group">
            <label>Main branch</label>
            <input
              type="text"
              :value="entry.main"
              @input="onBranchInput(repo, 'main', $event)"
            />
          </div>
          <div class="field-group">
            <label>Develop branch</label>
            <input
              type="text"
              :value="entry.develop"
              @input="onBranchInput(repo, 'develop', $event)"
            />
          </div>
          <div class="field-group">
            <label>Deploy branches</label>
            <div class="deploy-list">
              <span
                v-for="branch in entry.deployBranches"
                :key="branch"
                class="deploy-chip"
              >
                {{ branch }}
                <button @click="removeDeploy(repo, branch)">×</button>
              </span>
              <div class="deploy-input">
                <input
                  type="text"
                  :placeholder="'Thêm branch'"
                  v-model="draftDeploy[repo]"
                  @keyup.enter="addDeploy(repo)"
                />
                <button @click="addDeploy(repo)">➕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="settings-empty">
      Chưa có cấu hình branch cho repo hiện tại. Hãy chọn một repo hợp lệ trong tabs phía trên hoặc thiết lập `tomemiruRelease.defaultBranches`.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import dashboardStore from '../store/dashboard'
import type { BranchConfigEntry } from '../types'

const draftDeploy = reactive<Record<string, string>>({})

const activeRepo = computed(() => dashboardStore.state.activeRepo || dashboardStore.state.currentRepo)

const branchEntries = computed(() => {
  const repo = activeRepo.value
  if (!repo) {
    return []
  }
  const entry = dashboardStore.state.branchDrafts[repo]
  if (!entry) {
    return []
  }
  return [[repo, entry]] as [string, BranchConfigEntry][]
})

const hasEntries = computed(() => !!activeRepo.value && branchEntries.value.length > 0)

function ensureDraft(repo: string) {
  if (!(repo in draftDeploy)) {
    draftDeploy[repo] = ''
  }
}

function onBranchInput(repo: string, field: keyof BranchConfigEntry, event: Event) {
  const target = event.target as HTMLInputElement
  const value = target?.value || ''
  dashboardStore.setBranchField(repo, field, value)
}

function addDeploy(repo: string) {
  ensureDraft(repo)
  const branch = draftDeploy[repo]?.trim()
  if (!branch) {
    return
  }
  dashboardStore.addDeployBranch(repo, branch)
  draftDeploy[repo] = ''
}

function removeDeploy(repo: string, branch: string) {
  dashboardStore.removeDeployBranch(repo, branch)
}

function isDirty(repo: string) {
  return !!dashboardStore.state.dirtyRepos[repo]
}

function isSaving(repo: string) {
  return dashboardStore.state.savingRepo === repo
}

function save(repo: string) {
  dashboardStore.saveBranchConfig(repo)
}

function reset(repo: string) {
  dashboardStore.resetBranchConfig(repo)
}
</script>

<style scoped>
.settings-block {
  margin-top: 28px;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editorWidget-background);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.settings-header {
  margin-bottom: 16px;
}
.settings-header h3 {
  margin: 0 0 4px;
}
.settings-header p {
  margin: 0;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}
.settings-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--vscode-editor-background);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings-card.dirty {
  border-color: var(--vscode-textLink-foreground);
}
.card-title h4 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.card-header small {
  color: var(--vscode-descriptionForeground);
}
.card-actions {
  display: flex;
  gap: 8px;
}
.card-header button {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
}
.card-header button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.card-header button.secondary {
  border: 1px solid var(--vscode-button-secondaryBorder);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.card-body input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
}
.deploy-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.deploy-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  font-size: 11px;
}
.deploy-chip button {
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
}
.deploy-input {
  display: inline-flex;
  align-items: center;
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 999px;
  padding: 2px;
  overflow: hidden;
}
.deploy-input input {
  border: none;
  background: transparent;
  padding: 6px 8px;
  width: 120px;
}
.deploy-input input:focus {
  outline: none;
}
.deploy-input button {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  padding: 6px 10px;
  cursor: pointer;
}
.settings-empty {
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 10px;
  padding: 18px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
}
</style>
