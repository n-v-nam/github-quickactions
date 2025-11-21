import * as vscode from 'vscode'
import { ConfigService, RepoConfig } from './ConfigService'
import { GithubService } from './GithubService'
import { GitService } from './GitService'
import { VersionService } from './VersionService'
import { ShellService } from './ShellService'

export type ExecutionMode = 'execute' | 'dry-run'

export interface WorkflowResult<T = undefined> {
    success: boolean
    message: string
    data?: T
}

export type StatusUpdateCallback = (message: string) => void

interface RepoContext {
    owner: string
    repoConfig: RepoConfig
    repoPath: string
    mainBranch: string
    developBranch: string
    deployBranches: string[]
}

export class WorkflowRunner {
    static async createReleasePR(params: { repo: string; title?: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ prNumber?: number; url?: string }>> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate
        
        onStatus?.(`🔐 Khởi tạo GitHub client...`)
        await GithubService.init(ctx.owner)

        const title = params.title?.trim() || buildDefaultReleaseTitle()
        const dryRun = params.mode === 'dry-run'

        if (dryRun) {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ tạo PR ${ctx.developBranch} → ${ctx.mainBranch} cho ${ctx.repoConfig.name} với title "${title}".`,
            }
        }

        onStatus?.(`📝 Đang tạo PR ${ctx.developBranch} → ${ctx.mainBranch}...`)
        const pr = await GithubService.createPR(ctx.owner, ctx.repoConfig.name, title, ctx.developBranch, ctx.mainBranch, 'Automated release PR')

        return {
            success: true,
            message: `✅ Đã tạo Release PR #${pr.number} (${ctx.developBranch} → ${ctx.mainBranch})`,
            data: {
                prNumber: pr.number,
                url: pr.html_url,
            },
        }
    }

    static async createDbPreRelease(params: { repo: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ version: string }>> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate
        
        if (!ctx.repoConfig.isDbRepo) {
            throw new Error(`${ctx.repoConfig.name} không phải repo database`)
        }

        const mode = params.mode || 'execute'
        onStatus?.(`📖 Đọc version hiện tại...`)
        const currentVersion = await VersionService.getPackageJsonVersion(ctx.repoPath)
        const nextVersion = VersionService.bumpVersion(currentVersion)
        const publishVersion = `${nextVersion}-pre-release`
        const branchName = `pre-release/${publishVersion.replace(/\./g, '-')}`

        if (mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ publish version ${publishVersion} trên branch ${branchName}.`,
                data: { version: publishVersion },
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${ctx.developBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, ctx.developBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất...`)
        await GitService.pull(ctx.repoPath, ctx.developBranch)
        
        onStatus?.(`🗑️ Xóa branch ${branchName} local...`)
        await GitService.deleteLocalBranch(ctx.repoPath, branchName)
        
        onStatus?.(`🔄 Tạo và checkout branch ${branchName}...`)
        await GitService.checkoutBranch(ctx.repoPath, branchName, { createNew: true })

        onStatus?.(`📦 Publish version ${publishVersion}...`)
        await ShellService.run('yarn', ['publish', '--new-version', publishVersion], { cwd: ctx.repoPath })

        return {
            success: true,
            message: `✅ Đã publish ${publishVersion} cho ${ctx.repoConfig.name}`,
            data: { version: publishVersion },
        }
    }

    static async deployStaging(params: {
        repo: string
        deployBranch?: string
        updateDbPackage?: boolean
        newDbVersion?: string
        mode?: ExecutionMode
        onStatusUpdate?: StatusUpdateCallback
    }): Promise<WorkflowResult> {
        const ctx = await resolveRepoContext(params.repo)
        const targetBranch = params.deployBranch || ctx.deployBranches.find((b) => b.includes('deploy-jp')) || ctx.deployBranches[0] || 'deploy-jp'
        const onStatus = params.onStatusUpdate

        if (!targetBranch) {
            throw new Error(`Repo ${ctx.repoConfig.name} chưa cấu hình deploy branch`)
        }

        const mode = params.mode || 'execute'
        if (mode === 'dry-run') {
            const details = [
                `Force push ${ctx.developBranch} → ${targetBranch}`,
                params.updateDbPackage && params.newDbVersion
                    ? `Update ${ctx.repoConfig.dbPackageName} → ${params.newDbVersion}`
                    : null,
                'Chạy yarn staging:deploy'
            ]
                .filter(Boolean)
                .join('\n')
            return {
                success: true,
                message: `[DRY-RUN]\n${details}`,
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo ${ctx.repoConfig.name}...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${ctx.developBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, ctx.developBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất từ ${ctx.developBranch}...`)
        await GitService.pull(ctx.repoPath, ctx.developBranch)
        
        onStatus?.(`🗑️ Xóa branch ${targetBranch} local...`)
        await GitService.deleteLocalBranch(ctx.repoPath, targetBranch)
        
        onStatus?.(`🔄 Tạo và checkout branch ${targetBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, targetBranch, { createNew: true })

        if (ctx.repoConfig.name === 'tomemiru-api' && params.updateDbPackage) {
            if (!ctx.repoConfig.dbPackageName) {
                throw new Error('Repo tomemiru-api chưa cấu hình dbPackageName')
            }
            if (!params.newDbVersion) {
                throw new Error('Vui lòng nhập version database mới')
            }
            onStatus?.(`📦 Cập nhật ${ctx.repoConfig.dbPackageName} → ${params.newDbVersion}...`)
            const updated = await VersionService.updateDependencyVersion(ctx.repoPath, ctx.repoConfig.dbPackageName, params.newDbVersion)
            if (!updated) {
                throw new Error(`Không tìm thấy dependency ${ctx.repoConfig.dbPackageName}`)
            }
            onStatus?.(`📥 Chạy yarn install...`)
            await ShellService.run('yarn', ['install'], { cwd: ctx.repoPath })
            onStatus?.(`💾 Commit thay đổi...`)
            await GitService.commitChanges(
                ctx.repoPath,
                `:bookmark: Update ${ctx.repoConfig.dbPackageName} ${params.newDbVersion}`,
                { skipHooks: true }
            )
        }

        onStatus?.(`⬆️ Force push ${targetBranch}...`)
        await GitService.forcePush(ctx.repoPath, targetBranch)
        
        onStatus?.(`🚀 Chạy yarn staging:deploy...`)
        await ShellService.run('yarn', ['staging:deploy'], { cwd: ctx.repoPath })

        return {
            success: true,
            message: `✅ Đã deploy staging (branch ${targetBranch}) cho ${ctx.repoConfig.name}`,
        }
    }

    static async mergeReleasePr(params: { repo: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ prNumber?: number }>> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate
        
        onStatus?.(`🔐 Khởi tạo GitHub client...`)
        await GithubService.init(ctx.owner)

        onStatus?.(`🔍 Tìm Release PR ${ctx.developBranch} → ${ctx.mainBranch}...`)
        const releasePR = await GithubService.findReleasePR(ctx.owner, ctx.repoConfig.name, ctx.developBranch, ctx.mainBranch)
        if (!releasePR) {
            throw new Error(`Không tìm thấy PR develop → ${ctx.mainBranch} cho ${ctx.repoConfig.name}`)
        }

        if (params.mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ rebase & merge PR #${releasePR.number} (${releasePR.title}).`,
                data: { prNumber: releasePR.number },
            }
        }

        onStatus?.(`🔀 Đang rebase & merge PR #${releasePR.number}...`)
        await GithubService.mergePullRequest(ctx.owner, ctx.repoConfig.name, releasePR.number, 'rebase')

        return {
            success: true,
            message: `✅ Đã rebase & merge Release PR #${releasePR.number}`,
            data: { prNumber: releasePR.number },
        }
    }

    static async bumpPackageVersion(params: { repo: string; branch?: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ version: string }>> {
        const ctx = await resolveRepoContext(params.repo)
        const targetBranch = params.branch?.trim() || ctx.developBranch
        const onStatus = params.onStatusUpdate

        const mode = params.mode || 'execute'
        onStatus?.(`📖 Đọc version hiện tại...`)
        const currentVersion = await VersionService.getPackageJsonVersion(ctx.repoPath)
        const nextVersion = VersionService.bumpVersion(currentVersion)

        if (mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] ${ctx.repoConfig.name}: ${currentVersion} → ${nextVersion} (branch ${targetBranch}).`,
                data: { version: nextVersion },
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${targetBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, targetBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất...`)
        await GitService.pull(ctx.repoPath, targetBranch)
        
        onStatus?.(`📝 Cập nhật version ${currentVersion} → ${nextVersion}...`)
        await VersionService.updatePackageJsonVersion(ctx.repoPath, nextVersion)
        
        onStatus?.(`💾 Commit thay đổi...`)
        await GitService.commitChanges(ctx.repoPath, `:bookmark: v${nextVersion}`, { skipHooks: true })
        
        onStatus?.(`⬆️ Push lên ${targetBranch}...`)
        await GitService.push(ctx.repoPath, targetBranch)

        return {
            success: true,
            message: `✅ ${ctx.repoConfig.name}: đã bump ${currentVersion} → ${nextVersion} và push ${targetBranch}`,
            data: { version: nextVersion },
        }
    }

    static async publishDbOfficial(params: { repo: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ version: string }>> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate
        
        if (!ctx.repoConfig.isDbRepo) {
            throw new Error(`${ctx.repoConfig.name} không phải repo database`)
        }

        const mode = params.mode || 'execute'
        onStatus?.(`📖 Đọc version hiện tại...`)
        const currentVersion = await VersionService.getPackageJsonVersion(ctx.repoPath)

        if (mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ publish version ${currentVersion} trên branch ${ctx.mainBranch}.`,
                data: { version: currentVersion },
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${ctx.mainBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất...`)
        await GitService.pull(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`🔍 Kiểm tra đồng bộ với origin...`)
        await GitService.ensureSyncedWithOrigin(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`📦 Publish version ${currentVersion}...`)
        await ShellService.run('yarn', ['publish'], { cwd: ctx.repoPath })

        return {
            success: true,
            message: `✅ Đã publish version ${currentVersion} cho ${ctx.repoConfig.name}`,
            data: { version: currentVersion },
        }
    }

    static async pushReleaseTag(params: { repo: string; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult<{ tag: string }>> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate

        const mode = params.mode || 'execute'
        onStatus?.(`📖 Đọc version hiện tại...`)
        const version = await VersionService.getPackageJsonVersion(ctx.repoPath)
        const tagName = VersionService.formatVersionTag(version)

        if (mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ tạo & push tag ${tagName}.`,
                data: { tag: tagName },
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${ctx.mainBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất...`)
        await GitService.pull(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`🔍 Kiểm tra đồng bộ với origin...`)
        await GitService.ensureSyncedWithOrigin(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`🔍 Kiểm tra tag ${tagName} đã tồn tại...`)
        const git = GitService.getInstance(ctx.repoPath)
        const existingTags = await git.tags()
        if (existingTags.all.includes(tagName)) {
            throw new Error(`Tag ${tagName} đã tồn tại`)
        }

        onStatus?.(`🏷️ Tạo tag ${tagName}...`)
        await GitService.createTag(ctx.repoPath, tagName)
        
        onStatus?.(`⬆️ Push tag ${tagName}...`)
        await GitService.pushTag(ctx.repoPath, tagName)

        return {
            success: true,
            message: `✅ Đã tạo & push tag ${tagName}`,
            data: { tag: tagName },
        }
    }

    static async resetDeployBranches(params: { repo: string; branches: string[]; mode?: ExecutionMode; onStatusUpdate?: StatusUpdateCallback }): Promise<WorkflowResult> {
        const ctx = await resolveRepoContext(params.repo)
        const onStatus = params.onStatusUpdate
        
        if (!params.branches || params.branches.length === 0) {
            throw new Error('Chưa chọn branch để reset')
        }

        const mode = params.mode || 'execute'
        if (mode === 'dry-run') {
            return {
                success: true,
                message: `[DRY-RUN] Sẽ force push ${ctx.mainBranch} vào các branch: ${params.branches.join(', ')}.`,
            }
        }

        onStatus?.(`📋 Kiểm tra trạng thái repo...`)
        await GitService.validateCleanState(ctx.repoPath, ctx.repoConfig.name)
        
        onStatus?.(`🔄 Checkout branch ${ctx.mainBranch}...`)
        await GitService.checkoutBranch(ctx.repoPath, ctx.mainBranch)
        
        onStatus?.(`⬇️ Pull code mới nhất...`)
        await GitService.pull(ctx.repoPath, ctx.mainBranch)
        
        for (let i = 0; i < params.branches.length; i++) {
            const branch = params.branches[i]
            onStatus?.(`⬆️ Force push ${ctx.mainBranch} → ${branch} (${i + 1}/${params.branches.length})...`)
            await GitService.pushToRemoteBranch(ctx.repoPath, ctx.mainBranch, branch, { force: true })
        }

        return {
            success: true,
            message: `✅ Đã reset ${params.branches.length} branch deploy theo ${ctx.mainBranch}`,
        }
    }
}

async function resolveRepoContext(repoName: string): Promise<RepoContext> {
    const config = ConfigService.loadConfig()
    const repoConfig = config.repos.find((repo) => repo.name === repoName)
    if (!repoConfig) {
        throw new Error(`Không tìm thấy repo ${repoName} trong VSCode settings. Vui lòng cấu hình trong Settings (tomemiruRelease.repoPaths).`)
    }

    if (!repoConfig.localPath) {
        throw new Error(`Không tìm thấy path cho repo ${repoName} trong VSCode settings (tomemiruRelease.repoPaths). Vui lòng cấu hình trong Settings.`)
    }

    const repoPath = ConfigService.resolvePath(repoConfig.localPath)
    
    // Validate repo path exists
    const fs = await import('fs/promises')
    try {
        const stats = await fs.stat(repoPath)
        if (!stats.isDirectory()) {
            throw new Error(`Path ${repoPath} không phải là directory`)
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Repository path không tồn tại: ${repoPath}\nVui lòng kiểm tra lại cấu hình cho repo ${repoName} trong VSCode settings (tomemiruRelease.repoPaths)`)
        }
        throw error
    }

    const { mainBranch, developBranch, deployBranches } = getBranchSettings(repoName, repoConfig)

    return {
        owner: config.defaultOwner,
        repoConfig,
        repoPath,
        mainBranch,
        developBranch,
        deployBranches,
    }
}

function getBranchSettings(repoName: string, repoConfig: RepoConfig) {
    const settings = vscode.workspace.getConfiguration('tomemiruRelease')
    const map = settings.get<Record<string, { main?: string; develop?: string; deployBranches?: string[] }>>('defaultBranches') || {}

    const mainBranch = map[repoName]?.main || map.default?.main || 'main'
    const developBranch = map[repoName]?.develop || map.default?.develop || 'develop'
    const deployBranches = repoConfig.deployBranches?.length
        ? repoConfig.deployBranches
        : map[repoName]?.deployBranches?.length
            ? map[repoName].deployBranches!
            : map.default?.deployBranches || []

    return { mainBranch, developBranch, deployBranches }
}

function buildDefaultReleaseTitle() {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `:rocket: Release ${day}/${month}`
}


