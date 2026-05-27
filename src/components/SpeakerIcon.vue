<template>
  <button 
    @click="toggleSound" 
    class="speaker-button" 
    :title="soundEnabled ? 'Geluid uitschakelen' : 'Geluid inschakelen'"
    type="button"
  >
    <svg 
      v-if="soundEnabled" 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
    <svg 
      v-else 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    </svg>
  </button>
</template>

<script setup>
import { useGameStore } from '@/stores/gameStore'
import { storeToRefs } from 'pinia'

const gameStore = useGameStore()
const { soundEnabled } = storeToRefs(gameStore)

function toggleSound() {
  gameStore.toggleSound()
}
</script>

<style scoped>
.speaker-button {
  background: transparent;
  border: 2px solid #333;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #333;
}

.speaker-button:hover {
  background: #f0f0f0;
  border-color: #16a34a;
  color: #16a34a;
}

.speaker-button:active {
  transform: scale(0.95);
}

.speaker-button svg {
  display: block;
  width: 24px;
  height: 24px;
}
</style>
