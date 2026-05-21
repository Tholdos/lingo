<template>
  <div :class="['player-panel', { active: isActive }]">
    <div class="player-info">
      <h2 class="player-name">{{ player.name }}</h2>
      <div class="player-score">{{ player.score }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  player: Object,
  isActive: Boolean
})
</script>

<style scoped>
.player-panel {
  padding: 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  border: 3px solid #4a5568;
  transition: all 0.3s ease;
  min-width: 200px;
  user-select: none;
  cursor: default;
  outline: none;
}

.player-panel * {
  user-select: none;
  cursor: default;
}

.player-panel.active {
  border-color: #fbbf24;
  box-shadow: 0 0 30px rgba(251, 191, 36, 0.5);
  transform: scale(1.05);
}

.player-info {
  text-align: center;
  pointer-events: none;
}

.player-name {
  font-size: 1.5rem;
  font-weight: bold;
  color: #f3f4f6;
  margin: 0 0 0.5rem 0;
  user-select: none;
  caret-color: transparent;
}

.player-score {
  font-size: 1.25rem;
  color: #fbbf24;
  font-weight: 600;
  user-select: none;
  caret-color: transparent;
}
</style>