import * as vscode from 'vscode'
import { AuthService } from '../services/AuthService'

export class ConfigureSettingsCommand {
  static async run() {
    const hasManualToken = AuthService.hasManualToken()

    const choices = [
      {
        label: '$(dashboard) Launch Workflow',
        description: 'Mở Release Dashboard',
        action: () =>
          vscode.commands.executeCommand('tomemiru-release.openDashboard'),
      },
      {
        label: '$(key) Nhập GitHub Token (Manual)',
        description: hasManualToken
          ? 'Đã có token (cập nhật)'
          : 'Thiết lập token mới',
        action: async () => {
          const prompt = hasManualToken
            ? 'Nhập GitHub Personal Access Token mới (để trống để giữ nguyên)'
            : 'Nhập GitHub Personal Access Token'

          const token = await vscode.window.showInputBox({
            prompt,
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxx',
            password: true,
            validateInput: (value) => {
              if (!value || !value.trim()) {
                if (hasManualToken) {
                  return null
                }
                return 'Token không được để trống'
              }
              if (!value.startsWith('gh')) {
                return 'Token phải bắt đầu bằng gh...'
              }
              return null
            },
          })

          if (token && token.trim()) {
            await AuthService.setManualToken(token.trim())
            const config = vscode.workspace.getConfiguration('tomemiruRelease')
            await config.update(
              'authMethod',
              'manual',
              vscode.ConfigurationTarget.Global,
            )
            vscode.window.showInformationMessage(
              '✅ Đã lưu GitHub token (manual)',
            )
            await vscode.commands.executeCommand(
              'tomemiru-release.refreshStatusBar',
            )
          } else if (hasManualToken) {
            vscode.window.showInformationMessage('Giữ nguyên token hiện tại')
          }
        },
      },
      {
        label: '$(trash) Xóa Manual Token',
        description: hasManualToken
          ? 'Xóa token đã lưu'
          : 'Không có token để xóa',
        action: async () => {
          if (!hasManualToken) {
            vscode.window.showWarningMessage('Không có manual token để xóa')
            return
          }
          const confirm = await vscode.window.showWarningMessage(
            'Bạn có chắc muốn xóa manual token?',
            { modal: true },
            'Xóa',
          )
          if (confirm === 'Xóa') {
            await AuthService.clearManualToken()
            vscode.window.showInformationMessage('✅ Đã xóa manual token')
            await vscode.commands.executeCommand(
              'tomemiru-release.refreshStatusBar',
            )
          }
        },
      },
      {
        label: '$(gear) Mở Settings',
        description: 'tomemiruRelease.*',
        action: () =>
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'tomemiruRelease',
          ),
      },
      {
        label: '$(key) Chọn Auth Method',
        description: 'VSCode / Manual / Env',
        action: async () => {
          const currentMethod =
            vscode.workspace
              .getConfiguration('tomemiruRelease')
              .get<string>('authMethod') || 'vscode'
          const method = await vscode.window.showQuickPick(
            [
              {
                label: '$(vscode) VSCode OAuth',
                value: 'vscode',
                picked: currentMethod === 'vscode',
              },
              {
                label: '$(key) Manual Token',
                value: 'manual',
                picked: currentMethod === 'manual',
              },
              {
                label: '$(file) Env File',
                value: 'env',
                picked: currentMethod === 'env',
              },
            ],
            { placeHolder: 'Chọn phương thức authentication' },
          )
          if (method) {
            const config = vscode.workspace.getConfiguration('tomemiruRelease')
            await config.update(
              'authMethod',
              method.value,
              vscode.ConfigurationTarget.Global,
            )
            vscode.window.showInformationMessage(
              `✅ Đã đổi auth method: ${method.label}`,
            )
          }
        },
      },
      {
        label: '$(file-directory) Chỉnh repoPaths',
        description: 'Map repo -> localPath',
        action: () =>
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'tomemiruRelease.repoPaths',
          ),
      },
    ]

    const choice = await vscode.window.showQuickPick(choices, {
      placeHolder: 'Chọn hành động cấu hình',
    })

    if (choice) {
      await choice.action()
    }
  }
}
