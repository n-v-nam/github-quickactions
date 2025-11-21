import * as vscode from 'vscode'
import { DashboardProvider } from './views/DashboardProvider'
import { StatusBarManager } from './views/StatusBarManager'
import { StartWorkflowCommand } from './commands/StartWorkflowCommand'
import { ConfigureSettingsCommand } from './commands/ConfigureSettingsCommand'
import { CheckPRsCommand } from './commands/CheckPRsCommand'
import { MergePRsCommand } from './commands/MergePRsCommand'
import { CreateReleasePRCommand } from './commands/CreateReleasePRCommand'
import { BumpVersionCommand } from './commands/BumpVersionCommand'
import { MergeReleaseCommand } from './commands/MergeReleaseCommand'
import { TagCommand } from './commands/TagCommand'
import { DeployCommand } from './commands/DeployCommand'

let statusBar: StatusBarManager | undefined

export async function activate(context: vscode.ExtensionContext) {
    console.log('[Tomemiru Release] Extension activating...')
    try {
        console.log('[Tomemiru Release] Creating DashboardProvider...')
        const dashboardProvider = new DashboardProvider(context)

        console.log('[Tomemiru Release] Creating StatusBarManager...')
        statusBar = new StatusBarManager()
        context.subscriptions.push(statusBar)
        console.log('[Tomemiru Release] StatusBarManager created')

        console.log('[Tomemiru Release] Registering commands...')
        context.subscriptions.push(
            vscode.commands.registerCommand('tomemiru-release.openDashboard', async () => {
                const panel = vscode.window.createWebviewPanel(
                    'tomemiruReleaseDashboard',
                    'Tomemiru Release Dashboard',
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [context.extensionUri]
                    }
                )
                
                try {
                    const html = await dashboardProvider.getHtmlForPanel(panel.webview)
                    panel.webview.html = html
                    
                    panel.webview.onDidReceiveMessage(async (message) => {
                        console.log('[Tomemiru Release] Panel webview message received:', message.command)
                        try {
                            if (message.command === 'refresh') {
                                const newHtml = await dashboardProvider.getHtmlForPanel(panel.webview)
                                panel.webview.html = newHtml
                            } else if (message.command === 'runCommand') {
                                await vscode.commands.executeCommand(message.commandId)
                            } else if (message.command === 'loadPRs') {
                                await dashboardProvider.handleLoadPRs(panel.webview, message.owner, message.repo, message.baseBranch)
                            } else if (message.command === 'addPR') {
                                await dashboardProvider.handleAddPR(panel.webview, message.owner, message.repo, message.prNumber, message.baseBranch)
                            } else if (message.command === 'confirmPRs') {
                                await dashboardProvider.handleConfirmPRs(panel.webview, message.owner, message.repo, message.prs)
                            } else if (message.command === 'removePRFromBlock') {
                                await dashboardProvider.handleRemovePRFromBlock(panel.webview, message.repo, message.prNumber)
                            } else if (message.command === 'removeRepoBlock') {
                                await dashboardProvider.handleRemoveRepoBlock(panel.webview, message.repo)
                            } else if (message.command === 'checkPR') {
                                await dashboardProvider.handleCheckPR(panel.webview, message.repo, message.prNumber)
                            } else if (message.command === 'mergePR') {
                                await dashboardProvider.handleMergePR(panel.webview, message.repo, message.prNumber)
                            } else if (message.command === 'runRepoAction') {
                                await dashboardProvider.handleRunRepoAction(message.repo, message.commandId)
                            } else if (message.command === 'updateStatus') {
                                dashboardProvider.setStatusMessage(message.message || '')
                                const newHtml = await dashboardProvider.getHtmlForPanel(panel.webview)
                                panel.webview.html = newHtml
                            } else if (message.command === 'updateBranchConfig') {
                                await dashboardProvider.handleUpdateBranchConfig(panel.webview, message.repo, message.config)
                            } else if (message.command === 'createDevelopToMainPR') {
                                await dashboardProvider.handleCreateReleasePR(panel.webview, message.repo, message.title, message.executionMode)
                            } else if (message.command === 'runDbPreRelease') {
                                await dashboardProvider.handleDbPreRelease(panel.webview, message.repo, message.executionMode)
                            } else if (message.command === 'deployStg') {
                                await dashboardProvider.handleDeployStg(
                                    panel.webview,
                                    message.repo,
                                    message.deployBranch,
                                    message.updateDbPackage,
                                    message.newDbVersion,
                                    message.executionMode
                                )
                            } else if (message.command === 'mergeReleasePr') {
                                await dashboardProvider.handleMergeReleasePr(panel.webview, message.repo, message.executionMode)
                            } else if (message.command === 'bumpPackageVersion') {
                                await dashboardProvider.handleBumpVersion(panel.webview, message.repo, message.branch, message.executionMode)
                            } else if (message.command === 'publishDbOfficial') {
                                await dashboardProvider.handleDbOfficial(panel.webview, message.repo, message.executionMode)
                            } else if (message.command === 'pushReleaseTag') {
                                await dashboardProvider.handleReleaseTag(panel.webview, message.repo, message.executionMode)
                            } else if (message.command === 'resetDeployBranches') {
                                await dashboardProvider.handleResetDeployBranches(panel.webview, message.repo, message.branches, message.executionMode)
                            } else if (message.command === 'workflowActionResult') {
                                dashboardProvider.setStatusMessage(message.message || message.error || '')
                            } else {
                                console.warn('[Tomemiru Release] Unknown panel command:', message.command)
                            }
                        } catch (error) {
                            console.error('[Tomemiru Release] Error handling panel message:', error)
                            vscode.window.showErrorMessage(`Error: ${error}`)
                        }
                    })
                } catch (error) {
                    console.error('[Tomemiru Release] Error creating dashboard panel:', error)
                    panel.webview.html = `<html><body><h1>Error loading dashboard</h1><p>${error}</p></body></html>`
                }
            }),
            vscode.commands.registerCommand('tomemiru-release.startWorkflow', async () =>
                StartWorkflowCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.configureSettings', async () =>
                ConfigureSettingsCommand.run()
            ),
            vscode.commands.registerCommand('tomemiru-release.checkPRs', async () =>
                CheckPRsCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.mergePRs', async () =>
                MergePRsCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.createReleasePR', async () =>
                CreateReleasePRCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.deployBranch', async () =>
                DeployCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.bumpVersion', async () =>
                BumpVersionCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.mergeRelease', async () =>
                MergeReleaseCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.tag', async () =>
                TagCommand.run(context, dashboardProvider)
            ),
            vscode.commands.registerCommand('tomemiru-release.refreshStatusBar', async () => {
                if (statusBar) {
                    await statusBar.refresh()
                }
            }),
        )

        console.log('[Tomemiru Release] Setting up configuration change listener...')
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('tomemiruRelease.authMethod') || e.affectsConfiguration('tomemiruRelease.manualToken')) {
                if (statusBar) {
                    await statusBar.refresh()
                }
            }
        })

        console.log('[Tomemiru Release] Extension activation completed successfully')
    } catch (error) {
        console.error('[Tomemiru Release] Error activating extension', error)
        vscode.window.showErrorMessage(`Failed to activate Tomemiru Release extension: ${error}`)
    }
}

export function deactivate() {
    statusBar?.dispose()
}

