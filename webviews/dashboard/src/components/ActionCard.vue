<template>
  <section class="action-card">
    <div class="card-header">
      <div class="card-title">
        <span class="card-icon">{{ icon }}</span>
        <h4>{{ title }}</h4>
      </div>
      <slot name="toolbar" />
    </div>
    <div class="card-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  icon: string
  title: string
}

defineProps<Props>()
</script>

<style scoped>
.action-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 14px;
  padding: 16px;
  background: var(--vscode-editor-background);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 150px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.card-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.card-title {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.card-icon {
  font-size: 20px;
}
.card-title h4 {
  margin: 0;
  font-size: 14px;
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.card-body > :last-child {
  margin-top: auto;
}
</style>


