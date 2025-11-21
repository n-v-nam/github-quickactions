import * as vscode from 'vscode'
import type { PullRequestSummary } from '../services/GithubService'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { AuthService } from '../services/AuthService'
import { WorkflowRunner } from '../services/WorkflowRunner'
import type { ExecutionMode } from '../services/WorkflowRunner'

interface RepoWorkflowBlock {
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

export class DashboardProvider {
    private statusMessage = 'Chưa có workflow nào đang chạy.'
    private selectedPRs: Record<string, PullRequestSummary[]> = {}
    private repoBlocks: Record<string, RepoWorkflowBlock> = {}

    constructor(private readonly context: vscode.ExtensionContext) {
        console.log('[Tomemiru Release] DashboardProvider constructor called')
    }

    setStatusMessage(message: string) {
        console.log('[Tomemiru Release] setStatusMessage called:', message)
        this.statusMessage = message
    }

    setSelectedPRs(repoName: string, prs: PullRequestSummary[]) {
        this.selectedPRs[repoName] = prs
    }

    async getHtml(webview: vscode.Webview) {
        const nonce = Date.now().toString()
        const initialState = await this.buildInitialState()
        const initialStateJson = JSON.stringify(initialState)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026')

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dashboard', 'dist', 'assets', 'dashboard.js')
        )
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dashboard', 'dist', 'assets', 'style.css')
        )

        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource} https: data:`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource}`,
            `connect-src https:`
        ].join('; ')

        return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}">
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}">window.__INITIAL_STATE__ = ${initialStateJson};</script>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`
    }

    private async buildInitialState() {
        const [repoOptions, branchConfig] = await Promise.all([
            this.getRepoOptions(),
            this.getBranchConfig()
        ])

        return {
            statusMessage: this.statusMessage,
            repoOptions,
            repoBlocks: this.repoBlocks,
            branchConfig
        }
    }

    private async getRepoOptions() {
        const config = ConfigService.loadConfig()
        if (!config) {
            return []
        }
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const branchMap = settings.get<Record<string, { main?: string; develop?: string; deployBranches?: string[] }>>('defaultBranches') || {}

        return config.repos.map((repo) => {
            const developBranch = branchMap[repo.name]?.develop || branchMap.default?.develop || 'develop'
            const mainBranch = branchMap[repo.name]?.main || branchMap.default?.main || 'main'
            const deployBranches = repo.deployBranches?.length
                ? repo.deployBranches
                : branchMap[repo.name]?.deployBranches?.length
                    ? branchMap[repo.name].deployBranches!
                    : branchMap.default?.deployBranches || []
            return {
                value: `${config.defaultOwner}|${repo.name}|${developBranch}`,
                label: `${repo.name} (${developBranch})`,
                owner: config.defaultOwner,
                repo: repo.name,
                developBranch,
                mainBranch,
                deployBranches,
                isDbRepo: !!repo.isDbRepo,
                dependsOnDb: !!repo.dependsOnDb,
                dbPackageName: repo.dbPackageName || ''
            }
        })
    }

    private async getBranchConfig() {
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const branchMap = settings.get<Record<string, { main?: string, develop?: string, deployBranches?: string[] }>>('defaultBranches') || {}
        const config = ConfigService.loadConfig()
        const repoNames = new Set<string>()

        Object.keys(branchMap).forEach((name) => {
            if (name !== 'default') {
                repoNames.add(name)
            }
        })

        if (config) {
            config.repos.forEach((repo) => repoNames.add(repo.name))
        }

        const normalize = (entry?: { main?: string, develop?: string, deployBranches?: string[] }) => ({
            main: entry?.main || 'main',
            develop: entry?.develop || 'develop',
            deployBranches: entry?.deployBranches ? [...entry.deployBranches] : []
        })

        const result: Record<string, { main: string, develop: string, deployBranches: string[] }> = {}

        result.default = normalize(branchMap.default)

        for (const name of repoNames) {
            result[name] = normalize(branchMap[name] || branchMap.default)
        }

        return result
    }

    async handleLoadPRs(webview: vscode.Webview, owner: string, repo: string, baseBranch: string) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)
            await AuthService.getCurrentGitHubUser()

            const repoConfig = config.repos.find(r => r.name === repo)
            if (!repoConfig) {
                throw new Error(`Không tìm thấy repo ${repo} trong config`)
            }

            const prs = await GithubService.fetchOpenPRs(repoConfig, baseBranch)
            
            webview.postMessage({
                command: 'prsLoaded',
                prs: prs
            })
        } catch (error) {
            console.error('[Tomemiru Release] Error loading PRs:', error)
            webview.postMessage({
                command: 'error',
                error: (error as Error).message
            })
        }
    }

    async handleAddPR(webview: vscode.Webview, owner: string, repo: string, prNumber: number, baseBranch: string) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)
            await AuthService.getCurrentGitHubUser()

            const prData = await GithubService.getPullRequest(owner, repo, prNumber)
            
            const pr: PullRequestSummary = {
                number: prData.number,
                title: prData.title,
                author: prData.user?.login,
                mergeable: (prData as any).mergeable ?? undefined,
                mergeable_state: (prData as any).mergeable_state ?? undefined,
                url: prData.html_url,
                base: prData.base.ref,
            }

            const ciStatus = await GithubService.checkCIStatus(owner, repo, prNumber)
            pr.ciStatus = ciStatus

            webview.postMessage({
                command: 'prAdded',
                success: true,
                prNumber,
                pr
            })
        } catch (error) {
            console.error('[Tomemiru Release] Error adding PR:', error)
            let errorMessage = 'Lỗi không xác định'
            if (error instanceof Error) {
                errorMessage = error.message
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String(error.message)
            } else {
                errorMessage = String(error)
            }
            
            // Remove the GitHub API documentation URL from error message if present
            errorMessage = errorMessage.replace(/https:\/\/docs\.github\.com\/[^\s]+/g, '').trim()
            
            this.setStatusMessage(`❌ ${errorMessage}`)
            webview.postMessage({
                command: 'prAdded',
                success: false,
                prNumber,
                error: errorMessage
            })
            vscode.window.showErrorMessage(`Lỗi khi thêm PR #${prNumber}: ${errorMessage}`)
        }
    }

    async handleConfirmPRs(webview: vscode.Webview, owner: string, repo: string, prs: PullRequestSummary[]) {
        const baseBranch = this.getBaseBranchForRepo(repo)
        const existingBlock = this.repoBlocks[repo]

        const mergedPrsMap = new Map<number, PullRequestSummary>()

        if (existingBlock) {
            for (const pr of existingBlock.prs) {
                mergedPrsMap.set(pr.number, pr)
            }
        }
        for (const pr of prs) {
            mergedPrsMap.set(pr.number, pr)
        }

        const mergedPrs = Array.from(mergedPrsMap.values())

        const config = await ConfigService.loadConfig()
        const repoConfig = config.repos.find(r => r.name === repo)
        const mainBranch = this.getMainBranchForRepo(repo)
        const deployBranches = this.getDeployBranchesForRepo(repo, repoConfig)

        this.repoBlocks[repo] = {
            repo,
            owner,
            prs: mergedPrs,
            baseBranch,
            developBranch: baseBranch,
            mainBranch,
            deployBranches,
            isDbRepo: !!repoConfig?.isDbRepo,
            dependsOnDb: !!repoConfig?.dependsOnDb,
            dbPackageName: repoConfig?.dbPackageName
        }

        this.selectedPRs[repo] = mergedPrs

        const repoIndex = config.repos.findIndex(r => r.name === repo)
        if (repoIndex >= 0) {
            const existingNumbers = new Set<number>(config.repos[repoIndex].prs || [])
            for (const pr of prs) {
                existingNumbers.add(pr.number)
            }
            config.repos[repoIndex].prs = Array.from(existingNumbers.values())
        }

        webview.postMessage({
            command: 'repoBlockCreated',
            repo,
            block: this.repoBlocks[repo]
        })

        vscode.window.showInformationMessage(`Đã cập nhật block cho ${repo} với ${prs.length} PRs mới, tổng ${mergedPrs.length} PRs`)
    }

    async handleRemovePRFromBlock(webview: vscode.Webview, repo: string, prNumber: number) {
        const block = this.repoBlocks[repo]
        if (!block) {
            return
        }

        block.prs = block.prs.filter(p => p.number !== prNumber)
        
        if (block.prs.length === 0) {
            delete this.repoBlocks[repo]
            webview.postMessage({
                command: 'repoBlockRemoved',
                repo
            })
        } else {
            this.repoBlocks[repo] = block
            webview.postMessage({
                command: 'prRemovedFromBlock',
                repo,
                prNumber
            })
        }

    }

    async handleRemoveRepoBlock(webview: vscode.Webview, repo: string) {
        delete this.repoBlocks[repo]
        delete this.selectedPRs[repo]

        webview.postMessage({
            command: 'repoBlockRemoved',
            repo
        })

    }

    async handleCheckPR(webview: vscode.Webview, repo: string, prNumber: number) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)
            await AuthService.getCurrentGitHubUser()

            const block = this.repoBlocks[repo]
            if (!block) {
                throw new Error(`Không tìm thấy block cho repo ${repo}`)
            }

            const developBranch = block.baseBranch || this.getBaseBranchForRepo(repo)

            this.setStatusMessage(`🔄 Đang check PR #${prNumber} cho ${repo}...`)

            const status = await GithubService.checkPRMergeability(config.defaultOwner, repo, prNumber)
            const ciStatus = await GithubService.checkCIStatus(config.defaultOwner, repo, prNumber)

            let message = `PR #${prNumber}:\n`
            let statusType: 'success' | 'warning' | 'error' = 'success'

            if (status.base !== developBranch) {
                message += `❌ Base branch không đúng! Hiện tại: ${status.base}, Cần: ${developBranch}\n`
                statusType = 'error'
            } else if (status.mergeable && status.rebaseable) {
                message += `✅ Sẵn sàng merge\n`
                message += `   - Mergeable: ${status.mergeable}\n`
                message += `   - Rebaseable: ${status.rebaseable}\n`
                message += `   - CI Status: ${ciStatus}\n`
            } else {
                message += `⚠️ Có vấn đề: ${status.mergeableState}\n`
                message += `   - Mergeable: ${status.mergeable}\n`
                message += `   - Rebaseable: ${status.rebaseable}\n`
                message += `   - CI Status: ${ciStatus}\n`
                statusType = 'warning'
            }

            const pr = block.prs.find(p => p.number === prNumber)
            if (pr) {
                pr.mergeable = status.mergeable
                pr.mergeable_state = status.mergeableState
                pr.ciStatus = ciStatus
                pr.validationMessage = message
                pr.validationType = statusType
            }

            this.setStatusMessage(message)
            webview.postMessage({
                command: 'prChecked',
                repo,
                prNumber,
                status,
                ciStatus,
                message,
                statusType,
                pr: pr
            })


            if (statusType === 'error') {
                vscode.window.showErrorMessage(`PR #${prNumber} base branch không đúng!`)
            } else if (statusType === 'warning') {
                vscode.window.showWarningMessage(`PR #${prNumber} có vấn đề: ${status.mergeableState}`)
            } else {
                vscode.window.showInformationMessage(`✅ PR #${prNumber} sẵn sàng merge`)
            }
        } catch (error) {
            const errorMsg = `Lỗi check PR #${prNumber}: ${(error as Error).message}`
            this.setStatusMessage(`❌ ${errorMsg}`)
            webview.postMessage({
                command: 'prChecked',
                repo,
                prNumber,
                error: errorMsg
            })
            vscode.window.showErrorMessage(errorMsg)
        }
    }

    async handleMergePR(webview: vscode.Webview, repo: string, prNumber: number) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)
            await AuthService.getCurrentGitHubUser()

            const repoBlock = this.repoBlocks[repo]
            if (!repoBlock) {
                throw new Error(`Không tìm thấy block cho repo ${repo}`)
            }

            const developBranch = repoBlock.baseBranch || this.getBaseBranchForRepo(repo)

            this.setStatusMessage(`🔄 Đang merge PR #${prNumber} vào ${developBranch}...`)

            const status = await GithubService.checkPRMergeability(config.defaultOwner, repo, prNumber)

            if (status.base !== developBranch) {
                throw new Error(`PR #${prNumber} không target branch ${developBranch}! Base hiện tại: ${status.base}`)
            }

            if (!status.mergeable) {
                throw new Error(`PR #${prNumber} không thể merge. Trạng thái: ${status.mergeableState}`)
            }

            const prDetails = await GithubService.getPRDetails(config.defaultOwner, repo, prNumber)
            const defaultMessage = prDetails.title || `Merge PR #${prNumber}`

            const useCustomMessage = await vscode.window.showQuickPick(
                [
                    { label: 'Dùng PR title', value: false },
                    { label: 'Custom commit message', value: true },
                ],
                {
                    placeHolder: 'Chọn commit message',
                }
            )

            let commitMessage: string | undefined
            if (useCustomMessage?.value) {
                const input = await vscode.window.showInputBox({
                    prompt: `Nhập commit message cho PR #${prNumber}`,
                    value: defaultMessage,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'Commit message không được để trống'
                        }
                        return null
                    },
                })

                if (!input) {
                    return
                }
                commitMessage = input.trim()
            }

            const { DryRunService } = await import('../services/DryRunService')
            const dryRun = DryRunService.isDryRun()
            const confirmed = await DryRunService.confirmAction(
                `Squash & Merge PR #${prNumber} vào ${developBranch}?`,
                dryRun
            )

            if (!confirmed) {
                return
            }

            if (dryRun) {
                const dryRunMsg = DryRunService.logDryRun(
                    `Squash & Merge PR #${prNumber}`,
                    `Commit message: ${commitMessage || 'PR title'}`
                )
                this.setStatusMessage(dryRunMsg)
                webview.postMessage({
                    command: 'prMerged',
                    repo,
                    prNumber,
                    dryRun: true,
                    message: dryRunMsg
                })
                vscode.window.showInformationMessage(dryRunMsg)
                return
            }

            await GithubService.mergePullRequest(
                config.defaultOwner,
                repo,
                prNumber,
                'squash',
                commitMessage
            )

            const updatedBlock = this.repoBlocks[repo]
            if (updatedBlock) {
                updatedBlock.prs = updatedBlock.prs.filter(p => p.number !== prNumber)
                if (updatedBlock.prs.length === 0) {
                    delete this.repoBlocks[repo]
                    webview.postMessage({
                        command: 'repoBlockRemoved',
                        repo
                    })
                } else {
                    this.repoBlocks[repo] = updatedBlock
                }
            }

            const successMsg = `✅ Đã merge PR #${prNumber} vào ${developBranch}`
            this.setStatusMessage(successMsg)
            webview.postMessage({
                command: 'prMerged',
                repo,
                prNumber,
                success: true,
                message: successMsg
            })
            vscode.window.showInformationMessage(successMsg)
        } catch (error) {
            const errorMsg = `Lỗi merge PR #${prNumber}: ${(error as Error).message}`
            this.setStatusMessage(`❌ ${errorMsg}`)
            webview.postMessage({
                command: 'prMerged',
                repo,
                prNumber,
                success: false,
                error: errorMsg
            })
            vscode.window.showErrorMessage(errorMsg)
        }
    }

    async handleRunRepoAction(repo: string, commandId: string) {
        const block = this.repoBlocks[repo]
        if (!block) {
            vscode.window.showWarningMessage(`Không tìm thấy block cho repo ${repo}`)
            return
        }

        this.setSelectedPRs(repo, block.prs)
        await vscode.commands.executeCommand(commandId)
    }

    async handleUpdateBranchConfig(webview: vscode.Webview, repo: string, config: { main?: string, develop?: string, deployBranches?: string[] }) {
        try {
            if (!repo) {
                throw new Error('Thiếu repo để cập nhật cấu hình')
            }

            const settings = vscode.workspace.getConfiguration('tomemiruRelease')
            const branchMap = settings.get<Record<string, { main?: string, develop?: string, deployBranches?: string[] }>>('defaultBranches') || {}

            const normalized = {
                main: config?.main?.trim() || 'main',
                develop: config?.develop?.trim() || 'develop',
                deployBranches: (config?.deployBranches || []).map(branch => branch.trim()).filter(Boolean)
            }

            if (!branchMap.default) {
                branchMap.default = {
                    main: 'main',
                    develop: 'develop',
                    deployBranches: []
                }
            }

            branchMap[repo] = normalized

            await settings.update('defaultBranches', branchMap, vscode.ConfigurationTarget.Global)

            this.setStatusMessage(`✅ Đã lưu cấu hình branch cho ${repo}`)

            webview.postMessage({
                command: 'branchConfigUpdated',
                repo,
                config: normalized
            })
        } catch (error) {
            const errorMsg = `Lưu cấu hình branch thất bại: ${(error as Error).message}`
            this.setStatusMessage(`❌ ${errorMsg}`)
            webview.postMessage({
                command: 'branchConfigUpdateFailed',
                repo,
                error: errorMsg
            })
            vscode.window.showErrorMessage(errorMsg)
        }
    }

    async handleCreateReleasePR(webview: vscode.Webview, repo: string, title?: string, executionMode?: ExecutionMode) {
        console.log(`[Tomemiru Release] handleCreateReleasePR: repo=${repo}, title=${title}, mode=${executionMode}`)
        await this.runWorkflowAction(
            webview,
            'createDevelopToMainPR',
            repo,
            `🔄 Đang tạo Release PR cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.createReleasePR({ repo, title, mode: executionMode, onStatusUpdate })
        )
    }

    async handleDbPreRelease(webview: vscode.Webview, repo: string, executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'runDbPreRelease',
            repo,
            `🔄 Đang chuẩn bị pre-release DB cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.createDbPreRelease({ repo, mode: executionMode, onStatusUpdate })
        )
    }

    async handleDeployStg(
        webview: vscode.Webview,
        repo: string,
        deployBranch?: string,
        updateDbPackage?: boolean,
        newDbVersion?: string,
        executionMode?: ExecutionMode
    ) {
        console.log(`[Tomemiru Release] handleDeployStg called:`, { repo, deployBranch, updateDbPackage, newDbVersion, executionMode })
        await this.runWorkflowAction(
            webview,
            'deployStg',
            repo,
            `🔄 Đang deploy staging cho ${repo}...`,
            (onStatusUpdate) =>
                WorkflowRunner.deployStaging({
                    repo,
                    deployBranch,
                    updateDbPackage,
                    newDbVersion,
                    mode: executionMode,
                    onStatusUpdate,
                })
        )
    }

    async handleMergeReleasePr(webview: vscode.Webview, repo: string, executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'mergeReleasePr',
            repo,
            `🔄 Đang merge Release PR cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.mergeReleasePr({ repo, mode: executionMode, onStatusUpdate })
        )
    }

    async handleBumpVersion(webview: vscode.Webview, repo: string, branch?: string, executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'bumpPackageVersion',
            repo,
            `🔄 Đang bump version cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.bumpPackageVersion({ repo, branch, mode: executionMode, onStatusUpdate })
        )
    }

    async handleDbOfficial(webview: vscode.Webview, repo: string, executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'publishDbOfficial',
            repo,
            `🔄 Đang publish DB official cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.publishDbOfficial({ repo, mode: executionMode, onStatusUpdate })
        )
    }

    async handleReleaseTag(webview: vscode.Webview, repo: string, executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'pushReleaseTag',
            repo,
            `🔄 Đang tạo tag cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.pushReleaseTag({ repo, mode: executionMode, onStatusUpdate })
        )
    }

    async handleResetDeployBranches(webview: vscode.Webview, repo: string, branches: string[], executionMode?: ExecutionMode) {
        await this.runWorkflowAction(
            webview,
            'resetDeployBranches',
            repo,
            `🔄 Đang reset deploy branches cho ${repo}...`,
            (onStatusUpdate) => WorkflowRunner.resetDeployBranches({ repo, branches, mode: executionMode, onStatusUpdate })
        )
    }

    private async runWorkflowAction<T>(
        webview: vscode.Webview,
        action: string,
        repo: string,
        startMessage: string,
        runner: (onStatusUpdate?: (message: string) => void) => Promise<{ success: boolean; message: string; data?: T }>
    ) {
        try {
            console.log(`[Tomemiru Release] Running workflow action: ${action}`)
            this.setStatusMessage(startMessage)
            this.updateWebviewStatus(webview, startMessage)
            
            const onStatusUpdate = (message: string) => {
                this.setStatusMessage(message)
                this.updateWebviewStatus(webview, message)
            }
            
            const result = await runner(onStatusUpdate)
            console.log(`[Tomemiru Release] Workflow action result:`, result)
            this.setStatusMessage(result.message)
            this.updateWebviewStatus(webview, result.message)
            webview.postMessage({
                command: 'workflowActionResult',
                action,
                repo,
                success: result.success,
                message: result.message,
                data: result.data,
            })
            if (result.success) {
                vscode.window.showInformationMessage(result.message)
            } else {
                vscode.window.showWarningMessage(result.message)
            }
        } catch (error) {
            console.error(`[Tomemiru Release] Workflow action error:`, error)
            const errorMsg = `❌ ${(error as Error).message}`
            this.setStatusMessage(errorMsg)
            this.updateWebviewStatus(webview, errorMsg)
            webview.postMessage({
                command: 'workflowActionResult',
                action,
                repo,
                success: false,
                error: errorMsg,
            })
            vscode.window.showErrorMessage(errorMsg)
        }
    }

    private updateWebviewStatus(webview: vscode.Webview, message: string) {
        // Update status message
        this.setStatusMessage(message)
        // Send to webview
        webview.postMessage({
            command: 'updateStatus',
            message
        })
        // Show VSCode notification
        vscode.window.showInformationMessage(message)
    }

    private getBaseBranchForRepo(repoName: string): string {
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const map = settings.get<Record<string, { develop?: string }>>('defaultBranches') || {}
        if (map[repoName]?.develop) {
            return map[repoName].develop
        }
        if (map.default?.develop) {
            return map.default.develop
        }
        return 'develop'
    }

    private getMainBranchForRepo(repoName: string): string {
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const map = settings.get<Record<string, { main?: string }>>('defaultBranches') || {}
        if (map[repoName]?.main) {
            return map[repoName].main
        }
        if (map.default?.main) {
            return map.default.main
        }
        return 'main'
    }

    private getDeployBranchesForRepo(repoName: string, repoConfig?: { deployBranches?: string[] }) {
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const map = settings.get<Record<string, { deployBranches?: string[] }>>('defaultBranches') || {}
        if (repoConfig?.deployBranches?.length) {
            return repoConfig.deployBranches
        }
        if (map[repoName]?.deployBranches?.length) {
            return map[repoName].deployBranches!
        }
        if (map.default?.deployBranches?.length) {
            return map.default.deployBranches!
        }
        return []
    }


    getErrorHtml(error: string): string {
        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 12px;
        }
        .error {
            padding: 12px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 6px;
            color: var(--vscode-errorForeground);
        }
    </style>
</head>
<body>
    <h2>📦 Tomemiru Release Dashboard</h2>
    <div class="error">
        <strong>Error:</strong> ${this.escapeHtml(error)}
    </div>
</body>
</html>`
    }

    private escapeHtml(input: string) {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    async getHtmlForPanel(webview: vscode.Webview): Promise<string> {
        try {
            return await this.getHtml(webview)
        } catch (error) {
            console.error('[Tomemiru Release] Error getting HTML for panel:', error)
            return this.getErrorHtml(String(error))
        }
    }
}

