import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GitService } from '../services/GitService'
import { VersionService } from '../services/VersionService'
import { DashboardProvider } from '../views/DashboardProvider'
import { ConfigService as CS } from '../services/ConfigService'
import { DryRunService } from '../services/DryRunService'

export class TagCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()
            const mainBranch = getMainBranch('default')

            const repoPick = await vscode.window.showQuickPick(
                config.repos.map((repo) => ({
                    label: repo.name,
                    description: repo.localPath,
                    repo,
                })),
                {
                    placeHolder: 'Chọn repo để tạo tag',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const repoPath = CS.resolvePath(repo.localPath)

            await GitService.checkoutBranch(repoPath, mainBranch)
            await GitService.pull(repoPath, mainBranch)

            const currentVersion = await VersionService.getPackageJsonVersion(repoPath)
            const tagName = VersionService.formatVersionTag(currentVersion)

            const confirm = await vscode.window.showQuickPick(
                [
                    { label: `✅ Tạo và push tag ${tagName}`, value: true },
                    { label: '❌ Hủy', value: false },
                ],
                {
                    placeHolder: `Tạo tag ${tagName} cho ${repo.name}?`,
                }
            )

            if (!confirm || !confirm.value) {
                return
            }

            const dryRun = DryRunService.isDryRun()
            const confirmed = await DryRunService.confirmAction(
                `Tạo tag ${tagName} cho ${repo.name}?`,
                dryRun
            )

            if (!confirmed) {
                return
            }

            if (dryRun) {
                const dryRunMsg = DryRunService.logDryRun(
                    `Tạo tag ${tagName} cho ${repo.name}`,
                    `Version: ${currentVersion}`
                )
                vscode.window.showInformationMessage(dryRunMsg)
                dashboard.setStatusMessage(dryRunMsg)
                return
            }

            dashboard.setStatusMessage(`🔄 Đang tạo tag ${tagName} cho ${repo.name}...`)

            await GitService.createTag(repoPath, tagName)

            const pushConfirm = await vscode.window.showQuickPick(
                [
                    { label: '✅ Push tag lên origin', value: true },
                    { label: '⏭️ Bỏ qua', value: false },
                ],
                {
                    placeHolder: `Push tag ${tagName}?`,
                }
            )

            if (pushConfirm?.value) {
                await GitService.pushTag(repoPath, tagName)
                vscode.window.showInformationMessage(`✅ Đã tạo và push tag ${tagName}`)
                dashboard.setStatusMessage(`✅ Đã tạo và push tag ${tagName} cho ${repo.name}`)
            } else {
                vscode.window.showInformationMessage(`✅ Đã tạo tag ${tagName} (chưa push)`)
                dashboard.setStatusMessage(`✅ Đã tạo tag ${tagName} cho ${repo.name} (chưa push)`)
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Tạo tag thất bại: ${(error as Error).message}`)
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

