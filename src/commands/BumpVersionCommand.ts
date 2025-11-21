import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GitService } from '../services/GitService'
import { VersionService } from '../services/VersionService'
import { DashboardProvider } from '../views/DashboardProvider'
import { ConfigService as CS } from '../services/ConfigService'
import { DryRunService } from '../services/DryRunService'

export class BumpVersionCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()
            const developBranch = getDevelopBranch('default')

            const repoPick = await vscode.window.showQuickPick(
                config.repos
                    .filter((repo) => repo.releasePR)
                    .map((repo) => ({
                        label: repo.name,
                        description: `Release PR #${repo.releasePR}`,
                        repo,
                    })),
                {
                    placeHolder: 'Chọn repo để bump version',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const repoPath = CS.resolvePath(repo.localPath)

            await GitService.checkoutBranch(repoPath, developBranch)
            await GitService.pull(repoPath, developBranch)

            const currentVersion = await VersionService.getPackageJsonVersion(repoPath)
            const newVersion = VersionService.bumpVersion(currentVersion)

            const confirm = await vscode.window.showQuickPick(
                [
                    { label: `✅ Bump từ ${currentVersion} → ${newVersion}`, value: true },
                    { label: '❌ Hủy', value: false },
                ],
                {
                    placeHolder: `Bump version cho ${repo.name}?`,
                }
            )

            if (!confirm || !confirm.value) {
                return
            }

            const dryRun = DryRunService.isDryRun()
            const confirmed = await DryRunService.confirmAction(
                `Bump version từ ${currentVersion} → ${newVersion} và commit?`,
                dryRun
            )

            if (!confirmed) {
                return
            }

            if (dryRun) {
                const dryRunMsg = DryRunService.logDryRun(
                    `Bump version cho ${repo.name}`,
                    `${currentVersion} → ${newVersion}`
                )
                vscode.window.showInformationMessage(dryRunMsg)
                dashboard.setStatusMessage(dryRunMsg)
                return
            }

            dashboard.setStatusMessage(`🔄 Đang bump version cho ${repo.name}...`)

            await VersionService.updatePackageJsonVersion(repoPath, newVersion)

            const tagName = VersionService.formatVersionTag(newVersion)
            const commitMessage = `:bookmark: ${tagName}`

            await GitService.commitChanges(repoPath, commitMessage, { skipHooks: true })

            const pushConfirm = await vscode.window.showQuickPick(
                [
                    { label: '✅ Push lên develop', value: true },
                    { label: '⏭️ Bỏ qua', value: false },
                ],
                {
                    placeHolder: `Push develop branch cho ${repo.name}?`,
                }
            )

            if (pushConfirm?.value) {
                await GitService.push(repoPath, developBranch)
                vscode.window.showInformationMessage(`✅ Đã bump version ${newVersion} và push lên develop`)
                dashboard.setStatusMessage(`✅ Đã bump version ${newVersion} cho ${repo.name}`)
            } else {
                vscode.window.showInformationMessage(`✅ Đã bump version ${newVersion} (chưa push)`)
                dashboard.setStatusMessage(`✅ Đã bump version ${newVersion} cho ${repo.name} (chưa push)`)
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Bump version thất bại: ${(error as Error).message}`)
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

