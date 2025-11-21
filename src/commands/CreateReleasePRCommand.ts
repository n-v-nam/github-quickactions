import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { DashboardProvider } from '../views/DashboardProvider'
import { DryRunService } from '../services/DryRunService'

export class CreateReleasePRCommand {
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
                    placeHolder: 'Chọn repo để tạo Release PR',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const developBranch = getDevelopBranch(repo.name)
            const mainBranch = getMainBranch(repo.name)

            const confirm = await vscode.window.showQuickPick(
                [
                    { label: '✅ Tạo Release PR', value: true },
                    { label: '❌ Hủy', value: false },
                ],
                {
                    placeHolder: `Tạo Release PR (${developBranch} -> ${mainBranch}) cho ${repo.name}?`,
                }
            )

            if (!confirm || !confirm.value) {
                return
            }

            const defaultTitle = ':rocket: Release'
            const title = await vscode.window.showInputBox({
                prompt: `Nhập PR title cho ${repo.name}`,
                value: defaultTitle,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'PR title không được để trống'
                    }
                    return null
                },
            })

            if (!title) {
                return
            }

            const dryRun = DryRunService.isDryRun()
            const confirmed = await DryRunService.confirmAction(
                `Tạo Release PR (${developBranch} -> ${mainBranch}) cho ${repo.name}?`,
                dryRun
            )

            if (!confirmed) {
                return
            }

            if (dryRun) {
                const dryRunMsg = DryRunService.logDryRun(
                    `Tạo Release PR cho ${repo.name}`,
                    `Title: ${title.trim()}\nBase: ${developBranch} -> ${mainBranch}`
                )
                vscode.window.showInformationMessage(dryRunMsg)
                dashboard.setStatusMessage(dryRunMsg)
                return
            }

            dashboard.setStatusMessage(`🔄 Đang tạo Release PR cho ${repo.name}...`)

            const pr = await GithubService.createPR(
                config.defaultOwner,
                repo.name,
                title.trim(),
                developBranch,
                mainBranch,
                'Weekly release PR'
            )

            const repoIndex = config.repos.findIndex((r) => r.name === repo.name)
            if (repoIndex >= 0) {
                config.repos[repoIndex].releasePR = pr.number
            }

            vscode.window.showInformationMessage(`✅ Đã tạo Release PR #${pr.number}: ${pr.html_url}`)
            dashboard.setStatusMessage(`✅ Đã tạo Release PR #${pr.number} cho ${repo.name}`)
        } catch (error) {
            vscode.window.showErrorMessage(`Tạo Release PR thất bại: ${(error as Error).message}`)
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

