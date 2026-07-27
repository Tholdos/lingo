<template>
  <button 
    @click="toggleCompactMode" 
    class="text-size-button" 
    :title="compactMode ? 'Normale tekstgrootte' : 'Kleinere tekstgrootte (voor kleine schermen)'"
    type="button"
  >
    <span class="label">{{ compactMode ? '+' : '-' }}</span>
  </button>
</template>

<script setup>
import { useGameStore } from '@/stores/gameStore'
import { storeToRefs } from 'pinia'

const gameStore = useGameStore()
const { compactMode } = storeToRefs(gameStore)

function toggleCompactMode() {
  gameStore.toggleCompactMode()
}
</script>

<style scoped>
.text-size-button {
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid #16a34a;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #16a34a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.text-size-button:hover {
  background: #fff;
  border-color: #15803d;
  color: #15803d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

.text-size-button:active {
  transform: scale(0.98);
}

.label {
  font-size: 0.85rem;
  font-weight: 900;
  line-height: 1;
  font-family: inherit;
}
</style>
