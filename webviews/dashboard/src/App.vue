<template>
  <div class="app">
    <h2>📦 Tomemiru Release Dashboard</h2>
    <div class="status" id="statusMessage">{{ state.statusMessage }}</div>

    <div v-if="hasRepos" class="tabs">
      <button
        v-for="option in state.repoOptions"
        :key="option.repo"
        :class="['tab', { active: option.repo === activeRepo }]"
        @click="onSelectTab(option.repo)"
      >
        {{ option.repo }}
      </button>
    </div>
    <div v-else class="empty-state">
      Chưa có repo nào trong cấu hình. Hãy cấu hình <code>tomemiruRelease.repoPaths</code> trong VSCode Settings.
    </div>

    <RepoSelector />

    <div v-if="activeBlock" class="repo-blocks">
      <RepoBlock :repo="activeBlock.repo" :block="activeBlock" />
    </div>
    <div v-else-if="hasRepos" class="empty-state">
      Không tìm thấy dữ liệu cho repo đang chọn.
    </div>

    <RepoSettings />
    <ConfirmModal />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RepoSelector from './components/RepoSelector.vue'
import RepoBlock from './components/RepoBlock.vue'
import RepoSettings from './components/RepoSettings.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import dashboardStore from './store/dashboard'

const state = dashboardStore.state
const hasRepos = computed(() => state.repoOptions.length > 0)
const activeRepo = computed(() => state.activeRepo || state.repoOptions[0]?.repo || '')

const activeRepoOption = computed(() =>
  state.repoOptions.find((o) => o.repo === activeRepo.value) || null
)

const activeBlock = computed(() => {
  if (!activeRepo.value || !activeRepoOption.value) {
    return null
  }
  const existing = state.repoBlocks[activeRepo.value]
  if (existing) {
    return existing
  }
  const opt = activeRepoOption.value
  return {
    repo: opt.repo,
    owner: opt.owner,
    baseBranch: opt.developBranch,
    developBranch: opt.developBranch,
    mainBranch: opt.mainBranch,
    deployBranches: opt.deployBranches || [],
    isDbRepo: opt.isDbRepo,
    dependsOnDb: opt.dependsOnDb,
    dbPackageName: opt.dbPackageName,
    prs: []
  }
})

function onSelectTab(repo: string) {
  dashboardStore.setActiveRepo(repo)
}
</script>

<style>
:root {
  color-scheme: var(--vscode-color-scheme, dark);
}
body {
  margin: 0;
  background: var(--vscode-sideBar-background);
}
.app {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  padding: 16px;
  max-width: 960px;
  margin: 0 auto;
  box-sizing: border-box;
}
h2 {
  margin-bottom: 12px;
}
.status {
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--vscode-editorWidget-background);
  white-space: pre-line;
  margin-bottom: 20px;
  border: 1px solid var(--vscode-panel-border);
  font-size: 13px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.tab {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  font-size: 12px;
  cursor: pointer;
}
.tab.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-textLink-foreground);
}
.repo-blocks {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 8px;
}
</style>
