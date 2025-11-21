declare function acquireVsCodeApi<TState = unknown>(): {
  postMessage: (message: unknown) => void
  getState: () => TState | undefined
  setState: (state: TState) => void
}

const vscode = acquireVsCodeApi()

export default vscode
