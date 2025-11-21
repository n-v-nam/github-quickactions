<template>
  <div class="repo-block">
    <div class="repo-block-header">
      <div>
        <h3>📦 {{ repo }}</h3>
        <small>{{ block.developBranch }} → {{ block.mainBranch }}</small>
      </div>
      <button @click="removeBlock">🗑️ Xóa</button>
    </div>

    <div class="repo-block-prs">
      <h4>Pull Requests ({{ block.prs.length }}):</h4>
      <div v-if="!block.prs.length" class="empty-state">Không có PR nào</div>
      <div v-else class="repo-pr-list">
        <div v-for="pr in block.prs" :key="pr.number" class="repo-pr-item">
          <div class="repo-pr-item-content">
            <div class="pr-header">
              <a :href="pr.url" target="_blank">#{{ pr.number }}</a>
              <span class="pr-title">{{ pr.title }}</span>
              <code>{{ pr.base }}</code>
            </div>
            <div v-if="pr.validationMessage" class="pr-validation" :class="pr.validationType">
              {{ pr.validationMessage }}
            </div>
          </div>
          <div class="repo-pr-item-actions">
            <button @click="check(pr.number)">✅ Check</button>
            <button :disabled="!canMerge(pr)" @click="merge(pr.number)">🔀 Merge</button>
            <button class="secondary" @click="removePR(pr.number)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <div class="actions-grid">
      <ActionCard icon="📝" title="Release PR develop → main" description="Tự động tạo PR merge develop vào main.">
        <input v-model="releaseTitle" type="text" />
        <button class="primary" :disabled="!releaseTitle.trim() || isLoadingCreateReleasePR" @click="createReleasePR">
          <span v-if="isLoadingCreateReleasePR">⏳ Đang xử lý...</span>
          <span v-else>Tạo Release PR</span>
        </button>
      </ActionCard>

      <ActionCard
        v-if="block.isDbRepo"
        icon="🧪"
        title="DB Pre-release"
        description="Checkout từ develop và publish version dạng -pre-release."
      >
        <button class="primary" :disabled="isLoadingDbPreRelease" @click="publishDbPreRelease">
          <span v-if="isLoadingDbPreRelease">⏳ Đang xử lý...</span>
          <span v-else>Publish pre-release</span>
        </button>
      </ActionCard>

      <ActionCard
        v-if="canDeployStg"
        icon="🚀"
        title="Deploy STG (JP)"
        description="Force push develop → deploy-jp và chạy yarn staging:deploy."
      >
        <div v-if="needsDbVersion" class="db-version-block">
          <label>
            <input type="checkbox" v-model="shouldUpdateDb" />
            Cập nhật version DB package
          </label>
          <input
            v-if="shouldUpdateDb"
            v-model="dbVersion"
            type="text"
            placeholder="vd: 1.2.4-pre-release"
          />
        </div>
        <button
          class="primary"
          :disabled="(shouldUpdateDb && !dbVersion.trim()) || isLoadingDeployStg"
          @click="deployStg"
        >
          <span v-if="isLoadingDeployStg">⏳ Đang xử lý...</span>
          <span v-else>Deploy STG</span>
        </button>
      </ActionCard>

      <ActionCard icon="🔀" title="Merge Release PR" description="Rebase & merge PR develop → main.">
        <button class="primary" :disabled="isLoadingMergeReleasePr" @click="mergeReleasePr">
          <span v-if="isLoadingMergeReleasePr">⏳ Đang xử lý...</span>
          <span v-else>Merge Release</span>
        </button>
      </ActionCard>

      <ActionCard icon="⬆️" title="Bump version package.json" description="Checkout branch, bump version theo rule và push.">
        <label>
          Branch
          <input v-model="bumpBranch" type="text" />
        </label>
        <button class="primary" :disabled="!bumpBranch.trim() || isLoadingBumpVersion" @click="bumpVersion">
          <span v-if="isLoadingBumpVersion">⏳ Đang xử lý...</span>
          <span v-else>Bump & Push</span>
        </button>
      </ActionCard>

      <ActionCard
        v-if="block.isDbRepo"
        icon="📦"
        title="DB Official Release"
        description="Publish version chính thức từ main (must match origin)."
      >
        <button class="primary" :disabled="isLoadingDbOfficial" @click="publishDbOfficial">
          <span v-if="isLoadingDbOfficial">⏳ Đang xử lý...</span>
          <span v-else>Publish official</span>
        </button>
      </ActionCard>

      <ActionCard icon="🏷️" title="Tag release" description="Checkout main, sync và tạo tag version hiện tại.">
        <button class="primary" :disabled="isLoadingCreateTag" @click="createTag">
          <span v-if="isLoadingCreateTag">⏳ Đang xử lý...</span>
          <span v-else>Tạo & Push tag</span>
        </button>
      </ActionCard>

      <ActionCard
        icon="🧹"
        title="Reset deploy branches"
        description="Force push main vào các deploy branches đã chọn."
      >
        <div class="branch-checkboxes" v-if="block.deployBranches.length">
          <label v-for="branch in block.deployBranches" :key="branch">
            <input
              type="checkbox"
              :value="branch"
              v-model="selectedResetBranches"
            />
            {{ branch }}
          </label>
        </div>
        <div v-else class="empty-state small">Chưa cấu hình deploy branch.</div>
        <button
          class="primary"
          :disabled="selectedResetBranches.length === 0 || isLoadingResetDeploy"
          @click="resetDeployBranches"
        >
          <span v-if="isLoadingResetDeploy">⏳ Đang xử lý...</span>
          <span v-else>Reset branch</span>
        </button>
      </ActionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RepoBlockState, PullRequestSummary } from '../types'
import dashboardStore from '../store/dashboard'
import ActionCard from './ActionCard.vue'

interface Props {
  repo: string
  block: RepoBlockState
}

const props = defineProps<Props>()

const releaseTitle = ref(defaultReleaseTitle())
const bumpBranch = ref(props.block.developBranch)
const shouldUpdateDb = ref(false)
const dbVersion = ref('')
const selectedResetBranches = ref<string[]>([...props.block.deployBranches])

const developBranch = computed(() => props.block.developBranch || props.block.baseBranch || 'develop')
const canDeployStg = computed(() => props.repo === 'tomemiru' || props.repo === 'tomemiru-api')
const needsDbVersion = computed(() => props.repo === 'tomemiru-api')

watch(
  () => props.block,
  (block) => {
    bumpBranch.value = block.developBranch
    releaseTitle.value = defaultReleaseTitle()
    selectedResetBranches.value = [...block.deployBranches]
  },
  { deep: true }
)

watch(shouldUpdateDb, (value) => {
  if (!value) {
    dbVersion.value = ''
  }
})

function canMerge(pr: PullRequestSummary) {
  return pr.mergeable === true && pr.base === developBranch.value
}

function removeBlock() {
  dashboardStore.removeRepoBlock(props.repo)
}

function removePR(prNumber: number) {
  dashboardStore.removePRFromBlock(props.repo, prNumber)
}

function check(prNumber: number) {
  dashboardStore.checkPR(props.repo, prNumber)
}

function merge(prNumber: number) {
  if (!canMerge(props.block.prs.find((pr) => pr.number === prNumber)!)) {
    dashboardStore.notify('⚠️ PR chưa sẵn sàng merge')
    return
  }
  dashboardStore.mergePR(props.repo, prNumber)
}

function createReleasePR() {
  dashboardStore.requestWorkflowAction(
    'createDevelopToMainPR',
    { repo: props.repo, title: releaseTitle.value.trim() },
    {
      title: 'Tạo Release PR?',
      description: `${props.block.developBranch} → ${props.block.mainBranch}\nTitle: ${releaseTitle.value.trim()}`,
      allowModeSwitch: true
    }
  )
}

function publishDbPreRelease() {
  dashboardStore.requestWorkflowAction(
    'runDbPreRelease',
    { repo: props.repo },
    {
      title: 'Publish DB pre-release?',
      description: 'Checkout develop, tạo branch pre-release và chạy yarn publish.',
      allowModeSwitch: true
    }
  )
}

function deployStg() {
  dashboardStore.requestWorkflowAction(
    'deployStg',
    {
      repo: props.repo,
      deployBranch: 'deploy-jp',
      updateDbPackage: shouldUpdateDb.value,
      newDbVersion: dbVersion.value.trim()
    },
    {
      title: 'Deploy STG?',
      description: [
        `Push ${props.block.developBranch} → deploy-jp`,
        shouldUpdateDb.value && dbVersion.value ? `Update DB package ${dbVersion.value.trim()}` : null,
        'Chạy yarn staging:deploy'
      ]
        .filter(Boolean)
        .join('\n'),
      allowModeSwitch: true
    }
  )
}

function mergeReleasePr() {
  dashboardStore.requestWorkflowAction(
    'mergeReleasePr',
    { repo: props.repo },
    {
      title: 'Merge Release PR?',
      description: `Rebase & merge develop → ${props.block.mainBranch}.`,
      allowModeSwitch: true
    }
  )
}

function bumpVersion() {
  dashboardStore.requestWorkflowAction(
    'bumpPackageVersion',
    { repo: props.repo, branch: bumpBranch.value.trim() },
    {
      title: 'Bump version?',
      description: `Checkout ${bumpBranch.value.trim()}, bump version và push.`,
      allowModeSwitch: true
    }
  )
}

function publishDbOfficial() {
  dashboardStore.requestWorkflowAction(
    'publishDbOfficial',
    { repo: props.repo },
    {
      title: 'Publish DB official?',
      description: 'Checkout main, ensure sync và yarn publish.',
      allowModeSwitch: true
    }
  )
}

function createTag() {
  dashboardStore.requestWorkflowAction(
    'pushReleaseTag',
    { repo: props.repo },
    {
      title: 'Tạo release tag?',
      description: 'Checkout main, sync origin và tạo tag version hiện tại.',
      allowModeSwitch: true
    }
  )
}

function resetDeployBranches() {
  dashboardStore.requestWorkflowAction(
    'resetDeployBranches',
    { repo: props.repo, branches: selectedResetBranches.value },
    {
      title: 'Reset deploy branch?',
      description: `Force push ${props.block.mainBranch} vào: ${selectedResetBranches.value.join(', ')}`,
      allowModeSwitch: true
    }
  )
}

function defaultReleaseTitle() {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `:rocket: Release ${day}/${month}`
}
</script>

<style scoped>
.repo-block {
  padding: 20px;
  border-radius: 14px;
  border: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editorWidget-background);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.repo-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.repo-block-header h3 {
  margin: 0;
}
.repo-block-header small {
  color: var(--vscode-descriptionForeground);
}
.repo-block-header button {
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--vscode-button-secondaryBorder);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border-radius: 5px;
}
.repo-pr-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.repo-pr-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border-radius: 10px;
  border: 1px solid var(--vscode-panel-border);
  font-size: 12px;
}
.repo-pr-item-content {
  flex: 1;
  min-width: 0;
}
.pr-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.pr-header a {
  font-weight: 600;
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}
.pr-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pr-validation {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-line;
}
.pr-validation.success {
  border-color: var(--vscode-testing-iconPassed);
  color: var(--vscode-testing-iconPassed);
}
.pr-validation.warning {
  border-color: var(--vscode-list-warningForeground);
  color: var(--vscode-list-warningForeground);
}
.pr-validation.error {
  border-color: var(--vscode-errorForeground);
  color: var(--vscode-errorForeground);
}
.repo-pr-item-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 110px;
}
.repo-pr-item-actions button {
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 5px;
}
.repo-pr-item-actions button.secondary {
  border: 1px solid var(--vscode-button-secondaryBorder);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
input,
select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 13px;
  box-sizing: border-box;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.primary {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.empty-state {
  padding: 12px;
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 8px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}
.empty-state.small {
  font-size: 12px;
  padding: 8px;
}
.branch-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 12px;
}
.branch-checkboxes label {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.db-version-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
