import * as vscode from 'vscode'

export class DryRunService {
    static isDryRun(): boolean {
        const config = vscode.workspace.getConfiguration('tomemiruRelease')
        return config.get<boolean>('dryRunByDefault', true)
    }

    static async confirmAction(action: string, dryRun: boolean = this.isDryRun()): Promise<boolean> {
        if (dryRun) {
            const choice = await vscode.window.showWarningMessage(
                `[DRY-RUN] ${action}`,
                'Thực thi thật',
                'Chỉ xem (Dry-run)',
                'Hủy'
            )

            if (choice === 'Hủy' || !choice) {
                return false
            }

            if (choice === 'Thực thi thật') {
                return true
            }

            return false
        }

        const choice = await vscode.window.showQuickPick(
            [
                { label: `✅ ${action}`, value: true },
                { label: '❌ Hủy', value: false },
            ],
            {
                placeHolder: action,
            }
        )

        return choice?.value || false
    }

    static logDryRun(action: string, details?: string) {
        const message = `[DRY-RUN] ${action}${details ? `\n${details}` : ''}`
        console.log(message)
        return message
    }
}

