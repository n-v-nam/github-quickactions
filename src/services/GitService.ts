import simpleGit, { SimpleGit } from 'simple-git'
import * as vscode from 'vscode'

export class GitService {
    static getInstance(repoPath: string): SimpleGit {
        return simpleGit(repoPath)
    }

    static async validateCleanState(repoPath: string, repoName: string) {
        const git = this.getInstance(repoPath)
        const status = await git.status()
        if (status.files.length === 0 && status.staged.length === 0) return

        const detailLines = status.files.map((file) => `• ${file.working_dir}${file.path}`).join('\n')
        const message = `Repo ${repoName} có thay đổi chưa commit:\n${detailLines}\n`
        const choice = await vscode.window.showWarningMessage(message, 'Xem diff', 'Vẫn tiếp tục', 'Hủy')
        if (choice === 'Hủy' || !choice) {
            throw new Error(`Dừng thao tác do repo ${repoName} chưa sạch`)
        }
        if (choice === 'Xem diff') {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(repoPath), {
                forceNewWindow: false,
            })
            throw new Error('Vui lòng commit/stash trước khi chạy lại')
        }
    }

    static async checkoutBranch(
        repoPath: string,
        branch: string,
        options?: { createNew?: boolean; startPoint?: string }
    ) {
        const git = this.getInstance(repoPath)
        if (options?.createNew) {
            const args = options.startPoint ? ['-b', branch, options.startPoint] : ['-b', branch]
            await git.checkout(args)
            return
        }
        await git.checkout(branch)
    }

    static async pull(repoPath: string, branch: string) {
        const git = this.getInstance(repoPath)
        await git.pull('origin', branch)
    }

    static async createBranch(repoPath: string, branch: string, from = 'main') {
        const git = this.getInstance(repoPath)
        const exists = (await git.branchLocal()).all.includes(branch)
        if (exists) {
            await git.checkout(branch)
            return
        }
        await git.checkoutBranch(branch, from)
    }

    static async push(repoPath: string, branch: string) {
        const git = this.getInstance(repoPath)
        await git.push('origin', branch)
    }

    static async forcePush(repoPath: string, branch: string) {
        const git = this.getInstance(repoPath)
        await git.push(['origin', branch, '--force-with-lease'])
    }

    static async pushToRemoteBranch(
        repoPath: string,
        sourceBranch: string,
        targetBranch: string,
        options?: { force?: boolean }
    ) {
        const git = this.getInstance(repoPath)
        const args = ['origin', `${sourceBranch}:${targetBranch}`]
        if (options?.force) {
            args.push('--force-with-lease')
        }
        await git.push(args)
    }

    static async fetchAll(repoPath: string) {
        const git = this.getInstance(repoPath)
        await git.fetch(['--all', '--prune'])
    }

    static async getCurrentBranch(repoPath: string): Promise<string> {
        const git = this.getInstance(repoPath)
        return await git.revparse(['--abbrev-ref', 'HEAD'])
    }

    static async deleteLocalBranch(repoPath: string, branch: string) {
        const git = this.getInstance(repoPath)
        try {
            await git.deleteLocalBranch(branch, true)
        } catch (error) {
            if (!(error as Error).message.includes('not found')) {
                throw error
            }
        }
    }

    static async rebaseBranch(repoPath: string, targetBranch: string) {
        const git = this.getInstance(repoPath)
        await git.rebase([`origin/${targetBranch}`])
    }

    static async createTag(repoPath: string, tagName: string) {
        const git = this.getInstance(repoPath)
        await git.addAnnotatedTag(tagName, tagName)
    }

    static async pushTag(repoPath: string, tagName: string) {
        const git = this.getInstance(repoPath)
        await git.push(['origin', tagName])
    }

    static async commitChanges(repoPath: string, message: string, options?: { skipHooks?: boolean }) {
        const git = this.getInstance(repoPath)
        const skipHooks = options?.skipHooks || false

        let stashed = false
        try {
            const stashResult = await git.raw(['stash', 'push', '--include-untracked', '--keep-index', '-m', `release-tool-temp-${Date.now()}`])
            if (stashResult && !stashResult.includes('No local changes')) {
                stashed = true
            }
        } catch (error) {
            // Ignore stash errors
        }

        try {
            await git.add('.')
            const commitOptions = skipHooks ? { '--no-verify': null } : undefined
            await git.commit(message, undefined, commitOptions)
        } finally {
            if (stashed) {
                try {
                    await git.stash(['pop'])
                } catch (error) {
                    // Ignore stash pop errors
                }
            }
        }
    }

    static async ensureSyncedWithOrigin(repoPath: string, branch: string) {
        const git = this.getInstance(repoPath)
        await git.fetch('origin', branch)
        const local = (await git.revparse(['HEAD'])).trim()
        const remote = (await git.revparse([`origin/${branch}`])).trim()
        if (local !== remote) {
            throw new Error(`Branch ${branch} chưa đồng bộ với origin. Vui lòng pull/push trước.`)
        }
    }
}

