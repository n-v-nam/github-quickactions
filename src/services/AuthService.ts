import * as vscode from 'vscode'
import * as fs from 'fs/promises'
import path from 'path'

export type AuthMethod = 'vscode' | 'env' | 'manual'

export class AuthService {
    private static session: vscode.AuthenticationSession | undefined

    static async getAuthToken(silent: boolean = false): Promise<string> {
        const config = vscode.workspace.getConfiguration('tomemiruRelease')
        const authMethod = (config.get<AuthMethod>('authMethod') || 'vscode') as AuthMethod

        if (authMethod === 'vscode') {
            try {
                return await this.getVSCodeSession()
            } catch (error) {
                console.warn('[Tomemiru Release] VSCode auth failed, fallback to manual/env', error)
            }
        }

        if (authMethod === 'manual') {
            const token = await this.getManualToken(config, !silent)
            if (token) {
                return token
            }
            // const envToken = await this.getEnvToken(config.get<string>('workspaceEnvFile') || '.env')
            // if (envToken) {
            //     return envToken
            // }
            if (!silent) {
                throw new Error('Không tìm thấy GitHub token. Vui lòng nhập manual token hoặc cấu hình env file.')
            }
            throw new Error('Không tìm thấy GitHub token')
        }

        if (authMethod === 'env') {
            // const manualToken = await this.getManualToken(config, false)
            // if (manualToken) {
            //     return manualToken
            // }
            const envToken = await this.getEnvToken(config.get<string>('workspaceEnvFile') || '.env')
            if (envToken) {
                return envToken
            }
            // const manualTokenPrompt = await this.getManualToken(config, !silent)
            // if (manualTokenPrompt) {
            //     return manualTokenPrompt
            // }
            if (!silent) {
                throw new Error('Không tìm thấy GitHub token trong env file. Vui lòng cấu hình token.')
            }
            throw new Error('Không tìm thấy GitHub token')
        }

        const manualToken = await this.getManualToken(config, false)
        if (manualToken) {
            return manualToken
        }

        const envToken = await this.getEnvToken(config.get<string>('workspaceEnvFile') || '.env')
        if (envToken) {
            return envToken
        }

        const manualTokenPrompt = await this.getManualToken(config, !silent)
        if (manualTokenPrompt) {
            return manualTokenPrompt
        }

        if (!silent) {
            throw new Error('Không tìm thấy GitHub token. Vui lòng cấu hình authentication.')
        }
        throw new Error('Không tìm thấy GitHub token')
    }

    static async getCurrentGitHubUser(): Promise<{ login: string } | null> {
        try {
            const token = await this.getAuthToken(true)
            if (!token) return null

            const octokit = (await import('@octokit/rest')).Octokit
            const client = new octokit({ auth: token })
            const { data } = await client.users.getAuthenticated()
            return { login: data.login }
        } catch (error) {
            return null
        }
    }

    private static async getVSCodeSession(): Promise<string> {
        this.session = await vscode.authentication.getSession('github', ['repo', 'workflow', 'write:packages'], {
            createIfNone: true,
        })
        return this.session.accessToken
    }

    private static async getEnvToken(envPath: string): Promise<string | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        if (!workspaceFolder) return undefined
        const resolved = path.isAbsolute(envPath) ? envPath : path.join(workspaceFolder, envPath)

        try {
            const content = await fs.readFile(resolved, 'utf-8')
            const line = content.split('\n').find((ln) => ln.startsWith('GITHUB_TOKEN='))
            if (line) {
                const value = line.replace('GITHUB_TOKEN=', '').trim()
                if (value) return value
            }
        } catch (error) {
            console.warn('[Tomemiru Release] Failed to read env file', error)
        }
        return undefined
    }

    private static async getManualToken(config: vscode.WorkspaceConfiguration, promptIfMissing: boolean = false): Promise<string | undefined> {
        const stored = config.get<string>('manualToken')
        if (stored) {
            return stored
        }

        if (!promptIfMissing) {
            return undefined
        }

        const token = await vscode.window.showInputBox({
            prompt: 'Nhập GitHub Personal Access Token (scope: repo, workflow, write:packages)',
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxx',
            password: true,
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'Token không được để trống'
                }
                if (!value.startsWith('gh')) {
                    return 'Token phải bắt đầu bằng gh...'
                }
                return null
            },
        })

        if (!token) {
            return undefined
        }

        await config.update('manualToken', token, vscode.ConfigurationTarget.Global)
        return token
    }

    static async setManualToken(token: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('tomemiruRelease')
        await config.update('manualToken', token, vscode.ConfigurationTarget.Global)
    }

    static async clearManualToken(): Promise<void> {
        const config = vscode.workspace.getConfiguration('tomemiruRelease')
        await config.update('manualToken', undefined, vscode.ConfigurationTarget.Global)
    }

    static hasManualToken(): boolean {
        const config = vscode.workspace.getConfiguration('tomemiruRelease')
        const token = config.get<string>('manualToken')
        return !!token
    }
}

