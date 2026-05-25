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
  width: 45px;
  height: 45px;
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
  flex-shrink: 0;
}

/* Word length specific sizing */
.word-length-5 .letter-cell,
.word-length-6 .letter-cell {
  width: 45px;
  height: 45px;
}

.word-length-7 .letter-cell {
  width: 50px;
  height: 50px;
}

.word-length-8 .letter-cell {
  width: 48px;
  height: 48px;
}

.word-length-9 .letter-cell {
  width: 45px;
  height: 45px;
}

.word-length-10 .letter-cell {
  width: 42px;
  height: 42px;
}

@media (max-width: 768px) {
  .letter-cell {
    width: 36px;
    height: 36px;
    border-width: 1.5px;
  }
  
  .word-length-7 .letter-cell {
    width: 40px;
    height: 40px;
  }
  
  .word-length-8 .letter-cell {
    width: 38px;
    height: 38px;
  }
  
  .word-length-9 .letter-cell {
    width: 36px;
    height: 36px;
  }
  
  .word-length-10 .letter-cell {
    width: 33px;
    height: 33px;
  }
}

@media (max-width: 480px) {
  .letter-cell {
    width: 32px;
    height: 32px;
  }
  
  .word-length-7 .letter-cell {
    width: 35px;
    height: 35px;
  }
  
  .word-length-8 .letter-cell {
    width: 33px;
    height: 33px;
  }
  
  .word-length-9 .letter-cell {
    width: 31px;
    height: 31px;
  }
  
  .word-length-10 .letter-cell {
    width: 28px;
    height: 28px;
  }
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
  font-size: 26px;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
  pointer-events: none;
  caret-color: transparent;
}

/* Font size adjustments for longer words */
.word-length-7 .letter-text {
  font-size: 28px;
}

.word-length-8 .letter-text {
  font-size: 26px;
}

.word-length-9 .letter-text {
  font-size: 24px;
}

.word-length-10 .letter-text {
  font-size: 22px;
}

@media (max-width: 768px) {
  .letter-text {
    font-size: 20px;
  }
  
  .word-length-7 .letter-text {
    font-size: 22px;
  }
  
  .word-length-8 .letter-text {
    font-size: 21px;
  }
  
  .word-length-9 .letter-text {
    font-size: 19px;
  }
  
  .word-length-10 .letter-text {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .letter-text {
    font-size: 18px;
  }
  
  .word-length-7 .letter-text {
    font-size: 19px;
  }
  
  .word-length-8 .letter-text {
    font-size: 18px;
  }
  
  .word-length-9 .letter-text {
    font-size: 17px;
  }
  
  .word-length-10 .letter-text {
    font-size: 15px;
  }
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
  background-color: #16a34a;
  border-color: #22c55e;
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

/* Landscape orientation on mobile - make cells smaller to fit */
@media (max-height: 600px) and (orientation: landscape) {
  .letter-cell {
    width: 28px;
    height: 28px;
    border-width: 1px;
  }
  
  .word-length-5 .letter-cell,
  .word-length-6 .letter-cell {
    width: 28px;
    height: 28px;
  }
  
  .word-length-7 .letter-cell {
    width: 35px;
    height: 35px;
  }
  
  .word-length-8 .letter-cell {
    width: 33px;
    height: 33px;
  }
  
  .word-length-9 .letter-cell {
    width: 31px;
    height: 31px;
  }
  
  .word-length-10 .letter-cell {
    width: 29px;
    height: 29px;
  }
  
  .letter-text {
    font-size: 16px;
  }
  
  .word-length-7 .letter-text {
    font-size: 20px;
  }
  
  .word-length-8 .letter-text {
    font-size: 19px;
  }
  
  .word-length-9 .letter-text {
    font-size: 17px;
  }
  
  .word-length-10 .letter-text {
    font-size: 16px;
  }
}
</style>