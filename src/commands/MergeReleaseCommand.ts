import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { DashboardProvider } from '../views/DashboardProvider'
import { DryRunService } from '../services/DryRunService'

export class MergeReleaseCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)

            const mainBranch = getMainBranch('default')

            const repoPick = await vscode.window.showQuickPick(
                config.repos
                    .filter((repo) => repo.releasePR)
                    .map((repo) => ({
                        label: repo.name,
                        description: `Release PR #${repo.releasePR}`,
                        repo,
                    })),
                {
                    placeHolder: 'Chọn repo để merge Release PR',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const prNumber = repo.releasePR!

            const confirm = await vscode.window.showQuickPick(
                [
                    { label: `✅ Rebase & Merge PR #${prNumber} vào ${mainBranch}`, value: true },
                    { label: '❌ Hủy', value: false },
                ],
                {
                    placeHolder: `Merge Release PR #${prNumber} cho ${repo.name}?`,
                }
            )

            if (!confirm || !confirm.value) {
                return
            }

            const dryRun = DryRunService.isDryRun()
            const confirmed = await DryRunService.confirmAction(
                `Rebase & Merge Release PR #${prNumber} vào ${mainBranch}?`,
                dryRun
            )

            if (!confirmed) {
                return
            }

            if (dryRun) {
                const dryRunMsg = DryRunService.logDryRun(
                    `Rebase & Merge Release PR #${prNumber}`,
                    `Repo: ${repo.name}\nBase: ${mainBranch}`
                )
                vscode.window.showInformationMessage(dryRunMsg)
                dashboard.setStatusMessage(dryRunMsg)
                return
            }

            dashboard.setStatusMessage(`🔄 Đang merge Release PR #${prNumber} cho ${repo.name}...`)

            await GithubService.mergePullRequest(config.defaultOwner, repo.name, prNumber, 'rebase')

            vscode.window.showInformationMessage(`✅ Đã merge Release PR #${prNumber} vào ${mainBranch}`)
            dashboard.setStatusMessage(`✅ Đã merge Release PR #${prNumber} cho ${repo.name}`)
        } catch (error) {
            vscode.window.showErrorMessage(`Merge Release PR thất bại: ${(error as Error).message}`)
            console.error(error)
        }
    }
}

function getMainBranch(repoName: string): string {
    const settings = vscode.workspace.getConfiguration('tomemiruRelease')
    const map = settings.get<Record<string, { main?: string }>>('defaultBranches') || {}
    if (map[repoName]?.main) {
        return map[repoName].main as string
    }
    if (map.default?.main) {
        return map.default.main as string
    }
    return 'main'
}

