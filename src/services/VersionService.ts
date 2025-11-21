import semver from 'semver'
import * as fs from 'fs/promises'
import path from 'path'

export class VersionService {
    static bumpVersion(currentVersion: string): string {
        const parsed = semver.parse(currentVersion)
        if (!parsed) {
            throw new Error(`Invalid version format: ${currentVersion}`)
        }

        if (parsed.patch === 9) {
            return semver.inc(currentVersion, 'minor') || currentVersion
        }
        return semver.inc(currentVersion, 'patch') || currentVersion
    }

    static formatVersionTag(version: string): string {
        return `v${version}`
    }

    static async getPackageJsonVersion(repoPath: string): Promise<string> {
        const packageJsonPath = path.join(repoPath, 'package.json')
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(content)
        return packageJson.version
    }

    static async updatePackageJsonVersion(repoPath: string, newVersion: string): Promise<void> {
        const packageJsonPath = path.join(repoPath, 'package.json')
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(content)
        packageJson.version = newVersion
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')
    }

    static async updateDependencyVersion(
        repoPath: string,
        packageName: string,
        newVersion: string
    ): Promise<boolean> {
        const packageJsonPath = path.join(repoPath, 'package.json')
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(content)

        let updated = false
        if (packageJson.dependencies && packageJson.dependencies[packageName]) {
            packageJson.dependencies[packageName] = newVersion
            updated = true
        }
        if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
            packageJson.devDependencies[packageName] = newVersion
            updated = true
        }

        if (updated) {
            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')
        }
        return updated
    }
}

