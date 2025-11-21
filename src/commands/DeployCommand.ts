import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GitService } from '../services/GitService'
import { VersionService } from '../services/VersionService'
import { ShellService } from '../services/ShellService'
import { DashboardProvider } from '../views/DashboardProvider'

export class DeployCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()

            const repoPick = await vscode.window.showQuickPick(
                config.repos.map((repo) => ({
                    label: repo.name,
                    description: repo.localPath,
                    repo,
                })),
                {
                    placeHolder: 'Chọn repo để xử lý deploy branch',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo
            const deployBranches = getDeployBranches(repo)

            if (deployBranches.length === 0) {
                vscode.window.showWarningMessage(`Repo ${repo.name} chưa cấu hình deployBranches.`)
                return
            }

            const branchPick = await vscode.window.showQuickPick(
                deployBranches.map((branch) => ({
                    label: branch,
                    value: branch,
                })),
                {
                    placeHolder: 'Chọn deploy branch',
                }
            )

            if (!branchPick) return

            const deployBranch = branchPick.value
            const repoPath = ConfigService.resolvePath(repo.localPath)
            const mainBranch = getMainBranch(repo.name)
            const developBranch = getDevelopBranch(repo.name)

            await GitService.validateCleanState(repoPath, repo.name)

            dashboard.setStatusMessage(`🔄 Đang xử lý ${deployBranch} cho ${repo.name}...`)

            await GitService.fetchAll(repoPath)
            await GitService.deleteLocalBranch(repoPath, deployBranch)

            try {
                await GitService.checkoutBranch(repoPath, deployBranch)
            } catch {
                await GitService.checkoutBranch(repoPath, deployBranch, { createNew: true, startPoint: `origin/${deployBranch}` })
            }

            await GitService.pull(repoPath, deployBranch)
            await GitService.rebaseBranch(repoPath, mainBranch)
            await GitService.rebaseBranch(repoPath, developBranch)

            if (repo.dependsOnDb && repo.dbPackageName) {
                const updateDb = await vscode.window.showQuickPick(
                    [
                        { label: `Cập nhật ${repo.dbPackageName} (pre-release)`, value: true },
                        { label: 'Bỏ qua', value: false },
                    ],
                    { placeHolder: 'Cập nhật DB version trên deploy branch?' }
                )

                if (updateDb?.value) {
                    const newVersion = await vscode.window.showInputBox({
                        prompt: `Nhập version cho ${repo.dbPackageName}`,
                        placeHolder: '1.2.4-pre-release',
                    })

                    if (newVersion) {
                        const updated = await VersionService.updateDependencyVersion(repoPath, repo.dbPackageName, newVersion)
                        if (updated) {
                            await ShellService.run('yarn', ['install'], { cwd: repoPath })
                            await GitService.commitChanges(
                                repoPath,
                                `:bookmark: Update ${repo.dbPackageName} ${newVersion} (${deployBranch})`
                            )
                        }
                    }
                }
            }

            const deployConfirm = await vscode.window.showQuickPick(
                [
                    { label: 'Đã deploy thủ công', value: true },
                    { label: 'Chưa deploy', value: false },
                ],
                { placeHolder: 'Đã deploy lên môi trường staging JP chưa?' }
            )

            if (deployConfirm?.value) {
                vscode.window.showInformationMessage('Nhớ kiểm tra job deploy trong CI/CD.')
            }

            const pushConfirm = await vscode.window.showQuickPick(
                [
                    { label: '✅ Push deploy branch', value: true },
                    { label: '⏭️ Bỏ qua', value: false },
                ],
                { placeHolder: `Push ${deployBranch} lên origin?` }
            )

            if (pushConfirm?.value) {
                await GitService.push(repoPath, deployBranch)
                vscode.window.showInformationMessage(`✅ Đã xử lý deploy branch ${deployBranch} cho ${repo.name}`)
                dashboard.setStatusMessage(`✅ Deploy branch ${deployBranch} đã được cập nhật cho ${repo.name}`)
            } else {
                vscode.window.showInformationMessage(`✅ Hoàn tất xử lý deploy branch (chưa push)`)
                dashboard.setStatusMessage(`✅ Deploy branch ${deployBranch} đã được cập nhật (chưa push)`)
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Deploy branch thất bại: ${(error as Error).message}`)
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

function getDeployBranches(repo: { name: string; deployBranches?: string[] }) {
    if (repo.deployBranches && repo.deployBranches.length > 0) {
        return repo.deployBranches
    }
    const settings = vscode.workspace.getConfiguration('tomemiruRelease')
    const map = settings.get<Record<string, { deployBranches?: string[] }>>('defaultBranches') || {}
    if (map[repo.name]?.deployBranches?.length) {
        return map[repo.name].deployBranches!
    }
    if (map.default?.deployBranches?.length) {
        return map.default.deployBranches!
    }
    return []
}

