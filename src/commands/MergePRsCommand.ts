import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { DashboardProvider } from '../views/DashboardProvider'
import { DryRunService } from '../services/DryRunService'

export class MergePRsCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)

            const repoPick = await vscode.window.showQuickPick(
                config.repos.map((repo) => ({
                    label: repo.name,
                    description: repo.localPath,
                    repo,
                })),
                {
                    placeHolder: 'Chọn repo để merge PRs',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const developBranch = getDevelopBranch(repo.name)

            if (!repo.prs || repo.prs.length === 0) {
                vscode.window.showWarningMessage(`Repo ${repo.name} chưa có PRs nào được chọn.`)
                return
            }

            for (const prNumber of repo.prs) {
                try {
                    const status = await GithubService.checkPRMergeability(config.defaultOwner, repo.name, prNumber)

                    if (status.base !== developBranch) {
                        vscode.window.showErrorMessage(
                            `PR #${prNumber} không target branch ${developBranch}! Base: ${status.base}\n${status.url}`
                        )
                        continue
                    }

                    const prDetails = await GithubService.getPRDetails(config.defaultOwner, repo.name, prNumber)
                    const defaultMessage = prDetails.title || `Merge PR #${prNumber}`

                    const confirm = await vscode.window.showQuickPick(
                        [
                            { label: '✅ Squash & Merge', value: true },
                            { label: '⏭️ Skip', value: false },
                        ],
                        {
                            placeHolder: `Squash & Merge PR #${prNumber} vào ${developBranch}?`,
                        }
                    )

                    if (!confirm || !confirm.value) {
                        continue
                    }

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
                            continue
                        }
                        commitMessage = input.trim()
                    }

                    const dryRun = DryRunService.isDryRun()
                    const confirmed = await DryRunService.confirmAction(
                        `Squash & Merge PR #${prNumber} vào ${developBranch}?`,
                        dryRun
                    )

                    if (!confirmed) {
                        continue
                    }

                    if (dryRun) {
                        const dryRunMsg = DryRunService.logDryRun(
                            `Squash & Merge PR #${prNumber}`,
                            `Commit message: ${commitMessage || 'PR title'}`
                        )
                        vscode.window.showInformationMessage(dryRunMsg)
                        dashboard.setStatusMessage(dryRunMsg)
                        continue
                    }

                    dashboard.setStatusMessage(`🔄 Đang merge PR #${prNumber} vào ${developBranch}...`)

                    await GithubService.mergePullRequest(
                        config.defaultOwner,
                        repo.name,
                        prNumber,
                        'squash',
                        commitMessage
                    )

                    vscode.window.showInformationMessage(`✅ Đã merge PR #${prNumber} vào ${developBranch}`)
                    dashboard.setStatusMessage(`✅ Đã merge PR #${prNumber} vào ${developBranch}`)
                } catch (error) {
                    vscode.window.showErrorMessage(`❌ Lỗi merge PR #${prNumber}: ${(error as Error).message}`)
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Merge PRs thất bại: ${(error as Error).message}`)
            console.error(error)
        }
    }
}

function getDevelopBranch(repoName: string): string {
    const settings = vscode.workspace.getConfiguration('tomemiruRelease')
    const map = settings.get<Record<string, { develop?: string }>>('defaultBranches') || {}
    if (map[repoName]?.develop) {
        return map[repoName].develop as string
    }
    if (map.default?.develop) {
        return map.default.develop as string
    }
    return 'develop'
}

