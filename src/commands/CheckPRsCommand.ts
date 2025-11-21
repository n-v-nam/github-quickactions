import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { DashboardProvider } from '../views/DashboardProvider'

export class CheckPRsCommand {
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
                    placeHolder: 'Chọn repo để check PRs',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const developBranch = getDevelopBranch(repo.name)

            if (!repo.prs || repo.prs.length === 0) {
                vscode.window.showWarningMessage(`Repo ${repo.name} chưa có PRs nào được chọn.`)
                return
            }

            dashboard.setStatusMessage(`🔄 Đang check ${repo.prs.length} PRs cho ${repo.name}...`)

            const results: Array<{
                prNumber: number
                mergeable?: boolean
                mergeableState?: string
                rebaseable?: boolean
                base?: string
                error?: string
            }> = []

            for (const prNumber of repo.prs) {
                try {
                    const status = await GithubService.checkPRMergeability(config.defaultOwner, repo.name, prNumber)
                    results.push({
                        prNumber,
                        mergeable: status.mergeable,
                        mergeableState: status.mergeableState,
                        rebaseable: status.rebaseable,
                        base: status.base,
                    })

                    if (status.base !== developBranch) {
                        vscode.window.showErrorMessage(
                            `PR #${prNumber} không target branch ${developBranch}! Base hiện tại: ${status.base}\n${status.url}`
                        )
                    } else if (status.mergeable && status.rebaseable) {
                        vscode.window.showInformationMessage(`✅ PR #${prNumber} sẵn sàng merge`)
                    } else {
                        vscode.window.showWarningMessage(`⚠️ PR #${prNumber} có vấn đề: ${status.mergeableState}`)
                    }
                } catch (error) {
                    results.push({
                        prNumber,
                        error: (error as Error).message,
                    })
                    vscode.window.showErrorMessage(`❌ Lỗi check PR #${prNumber}: ${(error as Error).message}`)
                }
            }

            const summary = results
                .map((r) => {
                    if (r.error) return `PR #${r.prNumber}: ❌ ${r.error}`
                    if (r.mergeable && r.rebaseable) return `PR #${r.prNumber}: ✅ Ready`
                    return `PR #${r.prNumber}: ⚠️ ${r.mergeableState}`
                })
                .join('\n')

            dashboard.setStatusMessage(`✅ Đã check ${results.length} PRs cho ${repo.name}\n${summary}`)
            vscode.window.showInformationMessage(`Đã check ${results.length} PRs cho ${repo.name}`)
        } catch (error) {
            vscode.window.showErrorMessage(`Check PRs thất bại: ${(error as Error).message}`)
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

