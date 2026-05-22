<template>
  <div class="timer-container">
    <svg class="timer-svg" viewBox="0 0 100 100">
      <circle
        class="timer-background"
        cx="50"
        cy="50"
        r="45"
      />
      <circle
        class="timer-progress"
        cx="50"
        cy="50"
        r="45"
        :style="{ strokeDashoffset: dashOffset }"
      />
    </svg>
    <div class="timer-text">{{ displayTime }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  timeRemaining: Number,
  isActive: Boolean
})

const maxTime = 15
const circumference = 2 * Math.PI * 45

// Round up the displayed time so it never shows 0 before timeout
const displayTime = computed(() => {
  return Math.ceil(props.timeRemaining)
})

// Changed to make timer go clockwise (use progress directly instead of 1-progress)
const dashOffset = computed(() => {
  const progress = props.timeRemaining / maxTime
  return circumference * progress
})
</script>

<style scoped>
.timer-container {
  position: relative;
  width: 100px;
  height: 100px;
  user-select: none;
  cursor: default;
  caret-color: transparent;
}

.timer-container * {
  user-select: none;
  cursor: default;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  pointer-events: none;
}

.timer-background {
  fill: none;
  stroke: #2d3748;
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #fbbf24;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 282.7;
  transition: stroke-dashoffset 1s linear;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: bold;
  color: #f3f4f6;
  pointer-events: none;
  user-select: none;
  caret-color: transparent;
}

@media (max-width: 768px) {
  .timer-container {
    width: 70px;
    height: 70px;
  }
  
  .timer-text {
    font-size: 1.4rem;
  }
}

@media (max-width: 480px) {
  .timer-container {
    width: 55px;
    height: 55px;
  }
  
  .timer-text {
    font-size: 1.1rem;
  }
}
</style>