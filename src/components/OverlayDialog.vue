<template>
  <div class="overlay" v-if="show">
    <div class="overlay-content">
      <h2>{{ message }}</h2>
      <div class="button-group">
        <button @click="handleNewWord" class="btn btn-primary" title="Druk op Enter">Nieuw woord</button>
        <button @click="handleNewGame" class="btn btn-secondary">Nieuw spel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: Boolean,
  message: String
})

const emit = defineEmits(['close', 'newWord', 'newGame'])

function handleNewWord() {
  emit('newWord')
}

function handleNewGame() {
  emit('newGame')
}

function handleKeyDown(event) {
  // Only handle Enter when overlay is visible
  if (props.show && event.key === 'Enter') {
    event.preventDefault()
    handleNewWord()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  user-select: none;
  caret-color: transparent;
}

.overlay-content {
  background: #1a202c;
  padding: 3rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  user-select: none;
  caret-color: transparent;
}

.overlay-content h2 {
  color: #fbbf24;
  font-size: 2rem;
  margin: 0 0 2rem 0;
  user-select: none;
  caret-color: transparent;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #fbbf24;
  color: #1a202c;
}

.btn-primary:hover {
  background: #f59e0b;
}

.btn-secondary {
  background: #4a5568;
  color: #f3f4f6;
}

.btn-secondary:hover {
  background: #2d3748;
}
</style>