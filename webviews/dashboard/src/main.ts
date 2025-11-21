import { createApp } from 'vue'
import App from './App.vue'
import store from './store/dashboard'
import type { DashboardInitialState } from './types'

declare global {
  interface Window {
    __INITIAL_STATE__?: DashboardInitialState
  }
}

const initialState = window.__INITIAL_STATE__ || {
  statusMessage: 'Chưa có workflow nào đang chạy.',
  repoOptions: [],
  repoBlocks: {},
  branchConfig: {
    default: {
      main: 'main',
      develop: 'develop',
      deployBranches: []
    }
  }
}

store.init(initialState)

const app = createApp(App)
app.mount('#app')

window.addEventListener('message', (event) => {
  if (event && event.data) {
    store.handleMessage(event.data)
  }
})
