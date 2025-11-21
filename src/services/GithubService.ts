import { Octokit } from '@octokit/rest'
import { AuthService } from './AuthService'
import type { RepoConfig } from './ConfigService'

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

export class GithubService {
    private static client: Octokit | null = null
    private static defaultOwner: string

    static async init(owner: string) {
        if (this.client) return
        const token = await AuthService.getAuthToken()
        this.client = new Octokit({ auth: token })
        this.defaultOwner = owner
    }

    private static ensureClient() {
        if (!this.client) {
            throw new Error('GithubService chưa được init. Gọi GithubService.init(owner) trước.')
        }
        return this.client
    }

    static async fetchOpenPRs(repo: RepoConfig, baseBranch: string): Promise<PullRequestSummary[]> {
        const client = this.ensureClient()
        const owner = this.defaultOwner

        console.log('[Tomemiru Release] Fetching PRs:', { owner, repo: repo.name, baseBranch })
        
        try {
            const { data } = await client.pulls.list({
                owner,
                repo: repo.name,
                base: baseBranch,
                state: 'open',
                per_page: 50,
            })

            console.log('[Tomemiru Release] Fetched PRs from API:', data.length)
            console.log('[Tomemiru Release] PRs details:', data.map(pr => ({ number: pr.number, title: pr.title, base: pr.base.ref })))

            const prs = data.map((pr) => ({
                number: pr.number,
                title: pr.title,
                author: pr.user?.login,
                mergeable: (pr as any).mergeable ?? undefined,
                mergeable_state: (pr as any).mergeable_state ?? undefined,
                approvals: undefined,
                ciStatus: 'pending' as const,
                url: pr.html_url,
                base: pr.base.ref,
            }))

            console.log('[Tomemiru Release] Mapped PRs:', prs.length)
            return prs
        } catch (error) {
            console.error('[Tomemiru Release] Error fetching PRs:', error)
            throw error
        }
    }

    static async checkPRMergeability(owner: string, repo: string, prNumber: number) {
        const client = this.ensureClient()
        const { data: pr } = await client.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        })

        return {
            mergeable: pr.mergeable ?? false,
            mergeableState: pr.mergeable_state ?? 'unknown',
            rebaseable: pr.mergeable_state === 'clean' || pr.mergeable_state === 'behind',
            state: pr.state,
            head: pr.head.ref,
            base: pr.base.ref,
            title: pr.title,
            url: pr.html_url,
        }
    }

    static async getPRDetails(owner: string, repo: string, prNumber: number) {
        const client = this.ensureClient()
        const { data: pr } = await client.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        })
        return pr
    }

    static async checkCIStatus(owner: string, repo: string, prNumber: number): Promise<'passing' | 'failing' | 'pending'> {
        const client = this.ensureClient()
        try {
            const { data: checks } = await client.checks.listForRef({
                owner,
                repo,
                ref: `pull/${prNumber}/head`,
            })

            const allPassed = checks.check_runs.every((check) => check.status === 'completed' && check.conclusion === 'success')
            const anyFailed = checks.check_runs.some((check) => check.status === 'completed' && check.conclusion === 'failure')

            if (anyFailed) return 'failing'
            if (allPassed && checks.check_runs.length > 0) return 'passing'
            return 'pending'
        } catch {
            return 'pending'
        }
    }

    static async getPullRequest(owner: string, repo: string, number: number) {
        const client = this.ensureClient()
        try {
            const { data } = await client.pulls.get({ owner, repo, pull_number: number })
            return data
        } catch (error: any) {
            if (error.status === 404) {
                throw new Error(`Không tìm thấy PR #${number} trong repository ${owner}/${repo}. Vui lòng kiểm tra lại số PR hoặc quyền truy cập.`)
            }
            throw error
        }
    }

    static async mergePullRequest(
        owner: string,
        repo: string,
        number: number,
        method: 'squash' | 'merge' | 'rebase',
        commitTitle?: string
    ) {
        const client = this.ensureClient()
        await client.pulls.merge({
            owner,
            repo,
            pull_number: number,
            merge_method: method,
            commit_title: commitTitle,
        })
    }

    static async createPR(owner: string, repo: string, title: string, head: string, base: string, body?: string) {
        const client = this.ensureClient()
        const { data: pr } = await client.pulls.create({
            owner,
            repo,
            title,
            head,
            base,
            body: body || '',
        })
        return pr
    }

    static async findReleasePR(owner: string, repo: string, head: string, base: string) {
        const client = this.ensureClient()
        const { data } = await client.pulls.list({
            owner,
            repo,
            state: 'open',
            base,
            per_page: 50,
        })
        return data.find((pr) => pr.head.ref === head)
    }
}

