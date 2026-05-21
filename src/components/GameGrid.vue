<template>
  <div class="game-container">
    <h1 class="lingo-title">LINGO</h1>
    
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
    
    <!-- THIS IS THE SECTION THAT CHANGED - REPLACE YOUR EXISTING game-grid div with this: -->
    <div class="game-grid">
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
import { useGameStore } from '../stores/gameStore'
import PlayerPanel from './PlayerPanel.vue'
import LetterCell from './LetterCell.vue'
import CircularTimer from './CircularTimer.vue'

const gameStore = useGameStore()
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem 2rem 1rem;
  min-height: 100vh;
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
}

.game-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.row {
  display: flex;
  gap: 0.5rem;
}

.status-message {
  font-size: 1.5rem;
  color: #fbbf24;
  font-weight: 600;
  text-align: center;
  user-select: none;
  caret-color: transparent;
}
</style>