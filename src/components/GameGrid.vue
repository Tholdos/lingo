<template>
  <div class="game-container" ref="gameContainer" @click="focusMobileInput">
    <h1 class="lingo-title">LINGO</h1>
    
    <!-- Hidden input for mobile keyboard -->
    <input 
      ref="mobileInput"
      class="mobile-input"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="characters"
      spellcheck="false"
      @input="handleMobileInput"
      @keydown="handleMobileKeydown"
    />
    
    <div v-if="gameStore.isMultiplayer" class="multiplayer-status">
      <div v-if="gameStore.waitingForPlayer" class="waiting">
        Wachten op speler... kamercode: <strong>{{ gameStore.roomId }}</strong>
      </div>
      <div v-else class="connected">
        Verbonden - Kamer: {{ gameStore.roomId }}
      </div>
    </div>

    <div class="players-panel">
      <PlayerPanel 
        :player="gameStore.player1" 
        :is-active="gameStore.activePlayer === 1"
      />
      <CircularTimer 
        :time-remaining="gameStore.timeRemaining"
        :is-active="gameStore.isTimerActive"
      />
      <PlayerPanel 
        :player="gameStore.player2" 
        :is-active="gameStore.activePlayer === 2"
      />
    </div>
    
    <!-- Game grid with dynamic sizing based on word length -->
    <div class="game-grid" ref="gameGridRef" :class="'word-length-' + gameStore.wordLength">
      <div v-for="(row, rowIndex) in gameStore.cells" :key="rowIndex" class="row">
        <LetterCell 
          v-for="(cell, colIndex) in row" 
          :key="colIndex"
          :letter="cell.letter"
          :state="cell.state"
          :is-active="rowIndex === gameStore.currentRow && colIndex === gameStore.currentColumn"
        />
      </div>
    </div>
    <!-- END OF CHANGED SECTION -->

    <div class="status-message" v-if="gameStore.isMultiplayer && !gameStore.isMyTurn()">
      Wacht op {{ gameStore.activePlayerName }}...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useGameStore } from '../stores/gameStore'
import PlayerPanel from './PlayerPanel.vue'
import LetterCell from './LetterCell.vue'
import CircularTimer from './CircularTimer.vue'

const gameStore = useGameStore()
const mobileInput = ref(null)
const gameContainer = ref(null)
const gameGridRef = ref(null)
let lastInputValue = ''
let keyboardVisible = false
let initialViewportHeight = window.innerHeight

function focusMobileInput() {
  if (gameStore.gameStarted && mobileInput.value) {
    mobileInput.value.focus()
  }
}

function scrollToActiveRow() {
  // Disabled - keeping game at top with keyboard underneath
  return
}

function handleMobileInput(event) {
  const newValue = event.target.value.toUpperCase()
  const oldValue = lastInputValue
  
  if (newValue.length > oldValue.length) {
    // Letter added
    const addedLetter = newValue[newValue.length - 1]
    if (addedLetter.match(/^[A-Z]$/)) {
      // Dispatch keyboard event for letter
      window.dispatchEvent(new KeyboardEvent('keydown', { key: addedLetter }))
    }
  } else if (newValue.length < oldValue.length) {
    // Letter deleted
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
  }
  
  lastInputValue = newValue
  // Clear input to allow continuous typing
  setTimeout(() => {
    if (mobileInput.value) {
      mobileInput.value.value = ''
      lastInputValue = ''
    }
  }, 10)
}

function handleMobileKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    // Create a more complete keyboard event
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    })
    window.dispatchEvent(enterEvent)
  }
}

function handleViewportChange() {
  const currentHeight = window.visualViewport?.height || window.innerHeight
  const heightDifference = initialViewportHeight - currentHeight
  
  // Track keyboard state but don't trigger scrolling
  keyboardVisible = heightDifference > 150
}

// Watch for changes in current row
watch(() => gameStore.currentRow, () => {
  // Disabled auto-scroll
})

onMounted(() => {
  // Auto-focus on mobile when game starts
  setTimeout(() => focusMobileInput(), 500)
  
  // Listen for viewport changes (keyboard show/hide)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange)
  } else {
    window.addEventListener('resize', handleViewportChange)
  }
  
  // Store initial viewport height
  initialViewportHeight = window.visualViewport?.height || window.innerHeight
})

onUnmounted(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportChange)
  } else {
    window.removeEventListener('resize', handleViewportChange)
  }
})
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem 2rem 1rem;
  min-height: 100vh;
  overflow: visible;
}

@media (max-width: 768px) {
  .game-container {
    padding: 0.5rem;
    gap: 0.25rem;
    padding-bottom: 10vh; /* Reduced padding since no auto-scroll */
  }
}

.mobile-input {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.lingo-title {
  font-size: 36px;
  font-weight: 900;
  margin: 0.5rem 0;
  padding: 0.25rem 0;
  background: linear-gradient(to right, #FFD700, #FFA500, #FF8C00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(2px 2px 8px rgba(0, 0, 0, 0.8));
  user-select: none;
  caret-color: transparent;
  letter-spacing: 0.1em;
  line-height: 1.2;
}

@media (max-width: 768px) {
  .lingo-title {
    font-size: 28px;
    margin: 0.25rem 0;
  }
}

.multiplayer-status {
  background: #2d3748;
  padding: 1rem 2rem;
  border-radius: 8px;
  text-align: center;
  user-select: none;
  caret-color: transparent;
}

.waiting {
  color: #fbbf24;
  font-size: 1.1rem;
  user-select: none;
  caret-color: transparent;
}

.connected {
  color: #10b981;
  font-size: 1rem;
  user-select: none;
  caret-color: transparent;
}

.players-panel {
  display: flex;
  gap: 3rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
}

@media (max-width: 768px) {
  .players-panel {
    gap: 0.75rem;
  }
}

@media (max-width: 480px) {
  .players-panel {
    gap: 0.5rem;
    padding: 0 0.5rem;
  }
}

.game-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 100%;
}

/* Adjust gap for longer words */
.word-length-9 .row,
.word-length-10 .row {
  gap: 0.4rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 768px) {
  .game-grid {
    gap: 0.3rem;
  }
  
  .word-length-9 .row,
  .word-length-10 .row {
    gap: 0.3rem;
  }
}

@media (max-width: 480px) {
  .word-length-9 .row,
  .word-length-10 .row {
    gap: 0.25rem;
  }
}

.status-message {
  font-size: 1.5rem;
  color: #fbbf24;
  font-weight: 600;
  text-align: center;
  user-select: none;
  caret-color: transparent;
}

@media (max-width: 768px) {
  .game-container {
    padding: 0.5rem;
    gap: 0.25rem;
  }
  
  .game-grid {
    gap: 0.3rem;
  }
  
  .row {
    gap: 0.3rem;
  }
  
  .multiplayer-status {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  
  .status-message {
    font-size: 1.1rem;
  }
}
</style>