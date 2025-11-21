import { reactive } from 'vue'
import vscode from '../vscode'
import type {
  BranchConfigEntry,
  BranchConfigMap,
  DashboardInitialState,
  PullRequestSummary,
  RepoBlocksMap,
  RepoOption
} from '../types'

type ExecutionMode = 'execute' | 'dry-run'

interface ConfirmDialogState {
  visible: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  allowModeSwitch: boolean
  mode: ExecutionMode
}

interface PendingAction {
  command: string
  payload: Record<string, any>
  allowModeSwitch: boolean
}

interface DashboardState {
  statusMessage: string
  repoOptions: RepoOption[]
  selectedRepoValue: string
  currentOwner: string
  currentRepo: string
  currentBaseBranch: string
  pendingPRs: PullRequestSummary[]
  repoBlocks: RepoBlocksMap
  branchConfig: BranchConfigMap
  branchDrafts: BranchConfigMap
  dirtyRepos: Record<string, boolean>
  savingRepo: string | null
  confirmDialog: ConfirmDialogState
  pendingAction: PendingAction | null
  loadingActions: Record<string, boolean>
  activeRepo: string
}

interface PersistedState {
  pendingPRs: PullRequestSummary[]
  selectedRepoValue: string
}

let isRestoring = false

const state = reactive<DashboardState>({
  statusMessage: 'Chưa có workflow nào đang chạy.',
  repoOptions: [],
  selectedRepoValue: '',
  currentOwner: '',
  currentRepo: '',
  currentBaseBranch: '',
  pendingPRs: [],
  repoBlocks: {},
  branchConfig: {},
  branchDrafts: {},
  dirtyRepos: {},
  savingRepo: null,
  confirmDialog: {
    visible: false,
    title: '',
    description: '',
    confirmLabel: 'Thực thi',
    cancelLabel: 'Hủy',
    allowModeSwitch: false,
    mode: 'execute'
  },
  pendingAction: null,
  loadingActions: {},
  activeRepo: ''
})

function init(initial: DashboardInitialState) {
  state.statusMessage = initial.statusMessage || ''
  state.repoOptions = initial.repoOptions || []
  state.repoBlocks = initial.repoBlocks || {}
  state.branchConfig = normalizeBranchMap(initial.branchConfig)
  state.branchDrafts = cloneConfigMap(state.branchConfig)
  state.dirtyRepos = {}
  state.savingRepo = null
  ensureRepoDraftsFromOptions()
  restoreState()
  // Nếu chưa chọn repo, chọn repo đầu tiên làm mặc định
  if (!state.selectedRepoValue && state.repoOptions.length > 0) {
    const first = state.repoOptions[0]
    const defaultValue = first.value
    selectRepo(defaultValue)
  }
  // Đồng bộ activeRepo với currentRepo (sau restore/select)
  state.activeRepo = state.currentRepo || state.repoOptions[0]?.repo || ''
}

function selectRepo(value: string) {
  state.selectedRepoValue = value
  if (!value) {
    state.currentOwner = ''
    state.currentRepo = ''
    state.currentBaseBranch = ''
    state.activeRepo = ''
    persistState()
    return
  }
  const [owner, repo, baseBranch] = value.split('|')
  state.currentOwner = owner
  state.currentRepo = repo
  state.currentBaseBranch = baseBranch
   // Cập nhật activeRepo theo repo được chọn
  state.activeRepo = repo
  persistState()
}

function setActiveRepo(repo: string) {
  if (!repo || state.activeRepo === repo) {
    return
  }
  state.activeRepo = repo
  const option = state.repoOptions.find((o) => o.repo === repo)
  if (option) {
    const value = option.value
    if (state.selectedRepoValue !== value) {
      selectRepo(value)
    }
  }
}

function notify(message: string) {
  state.statusMessage = message
  vscode.postMessage({ command: 'updateStatus', message })
}

function requestWorkflowAction(
  command: string,
  payload: Record<string, any>,
  options: {
    title: string
    description: string
    confirmLabel?: string
    allowModeSwitch?: boolean
  }
) {
  state.pendingAction = {
    command,
    payload,
    allowModeSwitch: !!options.allowModeSwitch
  }
  state.confirmDialog = {
    visible: true,
    title: options.title,
    description: options.description,
    confirmLabel: options.confirmLabel || 'Thực thi',
    cancelLabel: 'Huỷ',
    allowModeSwitch: !!options.allowModeSwitch,
    mode: state.confirmDialog.mode || 'execute'
  }
}

function setConfirmMode(mode: ExecutionMode) {
  state.confirmDialog.mode = mode
}

function confirmPendingAction() {
  if (!state.pendingAction) {
    return
  }
  const { command, payload, allowModeSwitch } = state.pendingAction
  const executionMode = allowModeSwitch ? state.confirmDialog.mode : 'execute'
  
  console.log('[Dashboard] confirmPendingAction:', { command, executionMode, payload })
  
  // Set loading state
  const actionKey = `${command}_${payload.repo || ''}`
  state.loadingActions[actionKey] = true
  
  if (executionMode === 'dry-run') {
    notify('🔄 [DRY-RUN] Đang xử lý...')
  } else {
    notify('🔄 Đang xử lý...')
  }
  
  const messageToSend = {
    command,
    ...payload,
    executionMode
  }
  console.log('[Dashboard] Sending message:', messageToSend)
  
  try {
    vscode.postMessage(messageToSend)
    console.log('[Dashboard] Message sent successfully')
  } catch (error) {
    console.error('[Dashboard] Error sending message:', error)
    state.loadingActions[actionKey] = false
  }
  state.pendingAction = null
  closeConfirmDialog()
}

function cancelPendingAction() {
  state.pendingAction = null
  closeConfirmDialog()
}

function closeConfirmDialog() {
  state.confirmDialog = {
    ...state.confirmDialog,
    visible: false
  }
}

function requestAddPR(prNumber: number) {
  if (!state.currentOwner || !state.currentRepo) {
    notify('❌ Vui lòng chọn repo trước')
    return
  }
  notify(`🔄 Đang tải PR #${prNumber}...`)
  vscode.postMessage({
    command: 'addPR',
    owner: state.currentOwner,
    repo: state.currentRepo,
    prNumber,
    baseBranch: state.currentBaseBranch
  })
}

function confirmPendingPRs() {
  if (state.pendingPRs.length === 0) {
    notify('❌ Chưa có PR nào để xác nhận')
    return
  }
  if (!state.currentRepo) {
    notify('❌ Vui lòng chọn repo')
    return
  }
  notify(`🔄 ĐANG xác nhận ${state.pendingPRs.length} PRs...`)
  const plainPRs = state.pendingPRs.map(clonePR)
  vscode.postMessage({
    command: 'confirmPRs',
    owner: state.currentOwner,
    repo: state.currentRepo,
    prs: plainPRs
  })
}

function removePendingPR(prNumber: number) {
  state.pendingPRs = state.pendingPRs.filter((pr) => pr.number !== prNumber)
  persistState()
}

function clearPending() {
  state.pendingPRs = []
  persistState()
}

function removeRepoBlock(repo: string) {
  vscode.postMessage({ command: 'removeRepoBlock', repo })
}

function removePRFromBlock(repo: string, prNumber: number) {
  vscode.postMessage({ command: 'removePRFromBlock', repo, prNumber })
}

function checkPR(repo: string, prNumber: number) {
  notify(`🔄 Đang check PR #${prNumber} cho ${repo}...`)
  vscode.postMessage({ command: 'checkPR', repo, prNumber })
}

function mergePR(repo: string, prNumber: number) {
  notify(`🔄 Đang merge PR #${prNumber}...`)
  vscode.postMessage({ command: 'mergePR', repo, prNumber })
}

function runRepoAction(repo: string, commandId: string) {
  vscode.postMessage({ command: 'runRepoAction', repo, commandId })
}

function setBranchField(repo: string, field: keyof BranchConfigEntry, value: string) {
  ensureBranchDraft(repo)
  if (field === 'deployBranches') {
    return
  }
  state.branchDrafts[repo][field] = value
  markDirty(repo)
}

function addDeployBranch(repo: string, branch: string) {
  const value = branch.trim()
  if (!value) {
    return
  }
  ensureBranchDraft(repo)
  const list = new Set(state.branchDrafts[repo].deployBranches || [])
  list.add(value)
  state.branchDrafts[repo].deployBranches = Array.from(list)
  markDirty(repo)
}

function removeDeployBranch(repo: string, branch: string) {
  ensureBranchDraft(repo)
  state.branchDrafts[repo].deployBranches = state.branchDrafts[repo].deployBranches.filter((b) => b !== branch)
  markDirty(repo)
}

function saveBranchConfig(repo: string) {
  const config = state.branchDrafts[repo]
  if (!config) {
    notify('❌ Không có dữ liệu cấu hình')
    return
  }
  state.savingRepo = repo
  vscode.postMessage({
    command: 'updateBranchConfig',
    repo,
    config: cloneEntry(config)
  })
}

function resetBranchConfig(repo: string) {
  ensureBranchDraft(repo)
  if (state.branchConfig[repo]) {
    state.branchDrafts[repo] = cloneEntry(state.branchConfig[repo])
  } else if (state.branchDrafts[repo]) {
    state.branchDrafts[repo] = cloneEntry(state.branchDrafts.default || baseEntry())
  }
  clearDirty(repo)
}

function handleMessage(message: any) {
  switch (message.command) {
    case 'prAdded':
      if (message.success && message.pr) {
        const exists = state.pendingPRs.some((pr) => pr.number === message.pr.number)
        if (!exists) {
          state.pendingPRs = [...state.pendingPRs, message.pr]
          persistState()
        }
        notify(`✅ Đã thêm PR #${message.prNumber}`)
      } else if (message.error) {
        notify(`❌ ${message.error}`)
      }
      break
    case 'repoBlockCreated':
      if (message.repo && message.block) {
        state.repoBlocks = {
          ...state.repoBlocks,
          [message.repo]: message.block
        }
        state.pendingPRs = []
        persistState()
        notify(`✅ Đã tạo block cho ${message.repo}`)
      }
      break
    case 'repoBlockRemoved':
      if (message.repo) {
        const blocks = { ...state.repoBlocks }
        delete blocks[message.repo]
        state.repoBlocks = blocks
        notify(`✅ Đã xóa block cho ${message.repo}`)
      }
      break
    case 'prRemovedFromBlock':
      if (message.repo && message.prNumber) {
        const block = state.repoBlocks[message.repo]
        if (block) {
          block.prs = block.prs.filter((pr) => pr.number !== message.prNumber)
        }
      }
      break
    case 'updateRepoBlocks':
      if (message.blocks) {
        state.repoBlocks = message.blocks
      }
      break
    case 'prChecked':
      if (message.repo && message.pr) {
        const block = state.repoBlocks[message.repo]
        if (block) {
          const index = block.prs.findIndex((pr) => pr.number === message.pr.number)
          if (index >= 0) {
            block.prs[index] = message.pr
          }
        }
      }
      if (message.error) {
        notify(`❌ ${message.error}`)
      } else if (message.message) {
        notify(message.message)
      }
      break
    case 'prMerged':
      if (message.repo && message.prNumber) {
        const block = state.repoBlocks[message.repo]
        if (block) {
          block.prs = block.prs.filter((pr) => pr.number !== message.prNumber)
          if (block.prs.length === 0) {
            const blocks = { ...state.repoBlocks }
            delete blocks[message.repo]
            state.repoBlocks = blocks
          }
          persistState()
        }
      }
      if (message.error) {
        notify(`❌ ${message.error}`)
      } else if (message.message) {
        notify(message.message)
      }
      break
    case 'updateStatus':
      if (message.message) {
        state.statusMessage = message.message
      }
      break
    case 'branchConfigUpdated':
      if (message.repo && message.config) {
        state.branchConfig[message.repo] = cloneEntry(message.config)
        state.branchDrafts[message.repo] = cloneEntry(message.config)
        delete state.dirtyRepos[message.repo]
        if (state.savingRepo === message.repo) {
          state.savingRepo = null
        }
        notify(`✅ Đã lưu cấu hình branch cho ${message.repo}`)
      }
      break
    case 'branchConfigUpdateFailed':
      if (state.savingRepo === message.repo) {
        state.savingRepo = null
      }
      if (message.error) {
        notify(`❌ ${message.error}`)
      }
      break
    case 'workflowActionResult':
      // Clear loading state
      if (message.action) {
        const actionKey = `${message.action}_${message.repo || ''}`
        state.loadingActions[actionKey] = false
      }
      
      if (message.success && message.message) {
        notify(message.message)
      } else if (!message.success && message.error) {
        notify(message.error)
      }
      break
  }
}

function isLoadingAction(command: string, repo?: string): boolean {
  const actionKey = `${command}_${repo || ''}`
  return !!state.loadingActions[actionKey]
}

export default {
  state,
  init,
  selectRepo,
  setActiveRepo,
  requestAddPR,
  confirmPendingPRs,
  isLoadingAction,
  removePendingPR,
  clearPending,
  removeRepoBlock,
  removePRFromBlock,
  checkPR,
  mergePR,
  runRepoAction,
  setBranchField,
  addDeployBranch,
  removeDeployBranch,
  saveBranchConfig,
  resetBranchConfig,
  handleMessage,
  notify,
  requestWorkflowAction,
  setConfirmMode,
  confirmPendingAction,
  cancelPendingAction
}

function clonePR(pr: PullRequestSummary): PullRequestSummary {
  return { ...pr }
}

function persistState() {
  if (isRestoring) {
    return
  }
  const data: PersistedState = {
    pendingPRs: state.pendingPRs.map(clonePR),
    selectedRepoValue: state.selectedRepoValue
  }
  vscode.setState(data)
}

function restoreState() {
  isRestoring = true
  const saved = (vscode.getState() as PersistedState | undefined) || undefined
  if (!saved) {
    isRestoring = false
    return
  }
  if (saved.pendingPRs?.length) {
    state.pendingPRs = saved.pendingPRs
  }
  if (saved.selectedRepoValue) {
    state.selectedRepoValue = saved.selectedRepoValue
    selectRepo(saved.selectedRepoValue)
  }
  isRestoring = false
}

function normalizeBranchMap(map?: BranchConfigMap): BranchConfigMap {
  const normalized: BranchConfigMap = {}
  normalized.default = cloneEntry(map?.default || baseEntry())
  if (map) {
    for (const [repo, entry] of Object.entries(map)) {
      if (repo === 'default') {
        continue
      }
      normalized[repo] = cloneEntry(entry)
    }
  }
  return normalized
}

function cloneConfigMap(map: BranchConfigMap): BranchConfigMap {
  const result: BranchConfigMap = {}
  for (const [repo, entry] of Object.entries(map)) {
    result[repo] = cloneEntry(entry)
  }
  return result
}

function cloneEntry(entry: BranchConfigEntry): BranchConfigEntry {
  return {
    main: entry.main || '',
    develop: entry.develop || '',
    deployBranches: [...(entry.deployBranches || [])]
  }
}

function ensureBranchDraft(repo: string) {
  if (!state.branchDrafts[repo]) {
    state.branchDrafts[repo] = {
      main: state.branchConfig[repo]?.main || 'main',
      develop: state.branchConfig[repo]?.develop || 'develop',
      deployBranches: [...(state.branchConfig[repo]?.deployBranches || [])]
    }
  }
}

function ensureRepoDraftsFromOptions() {
  const defaultEntry = state.branchDrafts.default || baseEntry()
  for (const option of state.repoOptions) {
    if (!state.branchDrafts[option.repo]) {
      state.branchDrafts[option.repo] = cloneEntry(state.branchConfig[option.repo] || defaultEntry)
    }
    if (!state.branchConfig[option.repo]) {
      state.branchConfig[option.repo] = cloneEntry(state.branchDrafts[option.repo])
    }
  }
}

function markDirty(repo: string) {
  state.dirtyRepos = { ...state.dirtyRepos, [repo]: true }
}

function clearDirty(repo: string) {
  if (state.dirtyRepos[repo]) {
    const { [repo]: _removed, ...rest } = state.dirtyRepos
    state.dirtyRepos = rest
  }
}

function baseEntry(): BranchConfigEntry {
  return {
    main: 'main',
    develop: 'develop',
    deployBranches: []
  }
}
