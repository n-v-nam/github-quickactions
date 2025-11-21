export interface PullRequestSummary {
  number: number
  title: string
  author?: string
  mergeable?: boolean
  mergeable_state?: string
  approvals?: number
  ciStatus?: 'passing' | 'failing' | 'pending'
  url: string
  base: string
  validationMessage?: string
  validationType?: 'success' | 'warning' | 'error'
}

export interface RepoBlockState {
  repo: string
  owner: string
  baseBranch: string
  developBranch: string
  mainBranch: string
  deployBranches: string[]
  isDbRepo: boolean
  dependsOnDb: boolean
  dbPackageName?: string
  prs: PullRequestSummary[]
}

export type RepoBlocksMap = Record<string, RepoBlockState>

export interface BranchConfigEntry {
  main: string
  develop: string
  deployBranches: string[]
}

export type BranchConfigMap = Record<string, BranchConfigEntry>

export interface RepoOption {
  value: string
  label: string
  owner: string
  repo: string
  developBranch: string
  mainBranch: string
  deployBranches: string[]
  isDbRepo: boolean
  dependsOnDb: boolean
  dbPackageName?: string
}

export interface DashboardInitialState {
  statusMessage: string
  repoOptions: RepoOption[]
  repoBlocks: RepoBlocksMap
  branchConfig: BranchConfigMap
}
