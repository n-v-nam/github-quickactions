import { spawn } from 'child_process'

export class ShellService {
    static run(command: string, args: string[] = [], options: { cwd?: string } = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options.cwd,
                shell: true,
                stdio: 'inherit',
            })

            child.on('error', (error) => reject(error))
            child.on('close', (code) => {
                if (code === 0) {
                    resolve()
                } else {
                    reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
                }
            })
        })
    }
}

