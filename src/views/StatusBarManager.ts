import * as vscode from 'vscode'
import { AuthService } from '../services/AuthService'

export class StatusBarManager {
    private readonly item: vscode.StatusBarItem

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
        this.item.command = 'tomemiru-release.configureSettings'
        this.refresh()
        this.item.show()
    }

    async refresh() {
        try {
            const user = await AuthService.getCurrentGitHubUser()
            if (user) {
                this.item.text = `$(github) ${user.login} - Tome GitTool`
                this.item.tooltip = 'Click để mở Release Settings'
                this.item.backgroundColor = undefined
                return
            }
        } catch {
            // ignore
        }

        this.item.text = '$(alert) Tomemiru Release'
        this.item.tooltip = 'Chưa đăng nhập GitHub. Click để cấu hình.'
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
    }

    dispose() {
        this.item.dispose()
    }
}

