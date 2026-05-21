<template>
  <div :class="['letter-cell', stateClass, { active: isActive }]">
    <span class="letter-text">{{ displayLetter }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { LetterState } from '../types/game'

const props = defineProps({
  letter: String,
  state: String,
  isActive: Boolean
})

const displayLetter = computed(() => {
  return props.letter === '\u0178' ? 'IJ' : props.letter
})

const stateClass = computed(() => {
  switch (props.state) {
    case LetterState.Correct:
      return 'correct'
    case LetterState.WrongPosition:
      return 'wrong-position'
    case LetterState.Incorrect:
      return 'incorrect'
    case LetterState.Hint:
      return 'hint'
    default:
      return 'empty'
  }
})
</script>

<style scoped>
.letter-cell {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #333;
  border-radius: 4px;
  background-color: #1a1a1a;
  transition: all 0.3s ease;
  user-select: none;
  cursor: default;
  outline: none;
  caret-color: transparent;
}

.letter-cell.active {
  border-color: #fbbf24;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  transform: scale(1.05);
}

.letter-cell * {
  cursor: default;
  user-select: none;
}

.letter-text {
  font-size: 32px;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
  pointer-events: none;
  caret-color: transparent;
}

.letter-cell.empty {
  background-color: #1a1a1a;
  border-color: #444;
}

.letter-cell.incorrect {
  background-color: #1e3a5f;
  border-color: #2a5490;
}

.letter-cell.wrong-position {
  background-color: #d97706;
  border-color: #f59e0b;
  border-radius: 50%;
}

.letter-cell.correct {
  background-color: #dc2626;
  border-color: #ef4444;
}

.letter-cell.hint {
  background-color: #1e40af;
  border-color: #3b82f6;
}

/* Make it clear when typing over a hint */
.letter-cell.hint.active {
  background-color: #2563eb;
  border-color: #fbbf24;
}
</style>