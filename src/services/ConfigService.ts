import * as vscode from 'vscode'
import path from 'path'

export interface RepoConfig {
    name: string
    localPath: string
    prs?: number[]
    releasePR?: number | null
    isDbRepo?: boolean
    dependsOnDb?: boolean
    dbPackageName?: string
    deployBranches?: string[]
}

export interface ReleaseConfig {
    defaultOwner: string
    repos: RepoConfig[]
}

export class ConfigService {
    static loadConfig(): ReleaseConfig {
        const settings = vscode.workspace.getConfiguration('tomemiruRelease')
        const defaultOwner = settings.get<string>('defaultOwner') || 'tomemiru'
        const repoPaths = settings.get<Record<string, string>>('repoPaths') || {}
        const repoConfigs = settings.get<Record<string, {
            isDbRepo?: boolean
            dependsOnDb?: boolean
            dbPackageName?: string
            deployBranches?: string[]
        }>>('repoConfigs') || {}

        const repos: RepoConfig[] = Object.keys(repoPaths).map((name) => {
            const path = repoPaths[name]
            const config = repoConfigs[name] || {}
            return {
                name,
                localPath: path,
                isDbRepo: config.isDbRepo,
                dependsOnDb: config.dependsOnDb,
                dbPackageName: config.dbPackageName,
                deployBranches: config.deployBranches,
            }
        })

        return {
            defaultOwner,
            repos,
        }
    }

    static resolvePath(repoPath: string): string {
        if (path.isAbsolute(repoPath)) return repoPath
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        if (!workspaceFolder) {
            throw new Error('Không xác định được workspace root')
        }
        return path.join(workspaceFolder, repoPath)
    }
}

