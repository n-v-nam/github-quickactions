<template>
  <section class="action-card">
    <div class="card-header">
      <div class="card-title">
        <span class="card-icon">{{ icon }}</span>
        <div>
          <h4>{{ title }}</h4>
          <p>{{ description }}</p>
        </div>
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
  description?: string
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
.card-title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>


