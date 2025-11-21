<template>
  <div v-if="dialog.visible" class="modal-mask">
    <div class="modal-panel">
      <div class="modal-header">
        <h3>{{ dialog.title }}</h3>
      </div>
      <p class="modal-description">{{ dialog.description }}</p>

      <div v-if="dialog.allowModeSwitch" class="mode-selector">
        <label>
          <input type="radio" value="execute" v-model="mode" />
          Chạy thật
        </label>
        <label>
          <input type="radio" value="dry-run" v-model="mode" />
          Dry-run
        </label>
      </div>

      <div class="modal-actions">
        <button class="secondary" @click="cancel">
          {{ dialog.cancelLabel }}
        </button>
        <button class="primary" @click="confirm">
          {{ dialog.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dashboardStore from '../store/dashboard'

const dialog = computed(() => dashboardStore.state.confirmDialog)

const mode = computed({
  get: () => dialog.value.mode,
  set: (value: 'execute' | 'dry-run') => dashboardStore.setConfirmMode(value)
})

function confirm() {
  dashboardStore.confirmPendingAction()
}

function cancel() {
  dashboardStore.cancelPendingAction()
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-panel {
  width: min(420px, calc(100% - 32px));
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.modal-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.modal-description {
  margin: 0 0 16px;
  color: var(--vscode-descriptionForeground);
  white-space: pre-line;
}
.mode-selector {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 13px;
}
.mode-selector input {
  margin-right: 6px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-actions button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--vscode-button-border);
  cursor: pointer;
  font-size: 13px;
}
.modal-actions button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border-color: var(--vscode-button-secondaryBorder);
}
.modal-actions button.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>


