import * as vscode from 'vscode'
import { ConfigService } from '../services/ConfigService'
import { GithubService } from '../services/GithubService'
import { DashboardProvider } from '../views/DashboardProvider'
import { AuthService } from '../services/AuthService'

export class StartWorkflowCommand {
    static async run(context: vscode.ExtensionContext, dashboard: DashboardProvider) {
        try {
            const config = ConfigService.loadConfig()
            await GithubService.init(config.defaultOwner)
            await AuthService.getCurrentGitHubUser()

            const repoPick = await vscode.window.showQuickPick(
                config.repos.map((repo) => ({
                    label: repo.name,
                    description: repo.localPath,
                    repo,
                })),
                {
                    placeHolder: 'Chọn repo để bắt đầu workflow release',
                }
            )

            if (!repoPick) return

            const repo = repoPick.repo

            dashboard.setStatusMessage(`✅ Đã chọn repo ${repo.name}. Vui lòng chọn PRs từ Dashboard.`)
            vscode.window.showInformationMessage(
                `Đã chọn repo ${repo.name}. Vui lòng mở Dashboard và chọn PRs.`
            )
        } catch (error) {
            vscode.window.showErrorMessage(`Start workflow thất bại: ${(error as Error).message}`)
            console.error(error)
        }
    }
}

