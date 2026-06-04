<template>
  <div id="app">
    <StartupDialog 
      v-if="showStartup"
      :initial-tab="initialTab"
      :initial-word-length="initialWordLength"
      :initial-player-name="initialPlayerName"
      @close="showStartup = false"
      @start="handleStart"
      @create-room="handleCreateRoom"
      @join-room="handleJoinRoom"
    />

    <!-- Waiting for player screen -->
    <div v-if="gameStore.waitingForPlayer" class="waiting-screen">
      <div class="waiting-content">
        <h1>Wachten op speler...</h1>
        <div class="room-code">
          <p>Kamercode:</p>
          <div class="code-display">{{ gameStore.roomId }}</div>
          <button @click="copyRoomCode" class="btn btn-copy">{{ copyButtonText }}</button>
          <p class="code-instruction">Deel deze code met je medespeler</p>
        </div>
        <button @click="handleCancelRoom" class="btn btn-secondary">Annuleren</button>
      </div>
    </div>
    
    <!-- Reconnecting indicator -->
    <div v-if="gameStore.isReconnecting && gameStore.gameStarted" class="reconnecting-overlay">
      <div class="reconnecting-content">
        <div class="spinner"></div>
        <p>Verbinding herstellen...</p>
      </div>
    </div>

    <GameGrid v-if="gameStore.gameStarted" />

    <OverlayDialog
      :show="gameStore.showOverlay"
      :message="gameStore.overlayMessage"
      :is-multiplayer="gameStore.isMultiplayer"
      :is-host="gameStore.isHost"
      :host-name="gameStore.player1.name"
      :hide-new-word="gameStore.isDailyComplete"
      @close="gameStore.closeOverlay()"
      @new-word="handleNewWord"
      @new-game="handleNewGame"
    />

    <div v-if="invalidWordDialog" class="invalid-word-dialog">
      <div class="dialog-content">
        <h3 v-if="wrongFirstLetter">Verkeerde eerste letter</h3>
        <h3 v-else-if="duplicateWord">Woord al geraden</h3>
        <h3 v-else>Onbekend woord</h3>
        
        <p v-if="wrongFirstLetter">Het woord "{{ displayInvalidWord }}" begint niet met de juiste letter.</p>
        <p v-else-if="duplicateWord">Het woord "{{ displayInvalidWord }}" is al eerder geraden in deze ronde.</p>
        <p v-else>Het woord "{{ displayInvalidWord }}" is niet in de woordenlijst.</p>
        
        <!-- Show buttons only if not multiplayer or if host -->
        <template v-if="!gameStore.isMultiplayer || gameStore.isHost">
          <div class="button-group" v-if="!duplicateWord && !wrongFirstLetter">
            <button @click="acceptInvalidWord" @touchend.prevent="acceptInvalidWord" class="btn btn-primary" title="Druk op Enter">Accepteren</button>
            <button @click="rejectInvalidWord" @touchend.prevent="rejectInvalidWord" class="btn btn-secondary" title="Druk op Escape">Weigeren</button>
          </div>
          <div class="button-group" v-else>
            <button @click="rejectInvalidWord" @touchend.prevent="rejectInvalidWord" class="btn btn-primary" title="Druk op Enter">OK</button>
          </div>
        </template>
        
        <!-- Show waiting message for non-host in multiplayer -->
        <p v-else class="waiting-message">
          Wacht op {{ gameStore.player1.name }}...
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import StartupDialog from '@/components/StartupDialog.vue'
import GameGrid from '@/components/GameGrid.vue'
import OverlayDialog from '@/components/OverlayDialog.vue'

const gameStore = useGameStore()
const showStartup = ref(true)
const invalidWordDialog = ref(false)
const currentInvalidWord = ref('')
const duplicateWord = ref(false)
const wrongFirstLetter = ref(false)
const pendingGameSettings = ref(null)
const copyButtonText = ref('Kopieer code')
const initialTab = ref('solo')  // Default to solo tab
const initialWordLength = ref(6)  // Default word length for daily mode
const initialPlayerName = ref('')  // Player name for daily mode
let dialogJustOpened = false

// Display invalid word with IJ normalization
const displayInvalidWord = computed(() => {
  return currentInvalidWord.value.replace(/\u0178/g, 'IJ')
})

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

// Watch for invalid word dialog changes to blur mobile input
watch(invalidWordDialog, (newValue) => {
  if (newValue) {
    // Dialog opened - stop timer and blur any active input to hide mobile keyboard
    gameStore.stopTimer()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    // Set flag to prevent immediate Enter key processing
    dialogJustOpened = true
    setTimeout(() => {
      dialogJustOpened = false
    }, 300)
  }
})

// Watch for victory/overlay dialog to blur mobile keyboard
watch(() => gameStore.showOverlay, (newValue) => {
  if (newValue) {
    // Dialog opened - blur any active input to hide mobile keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }
})

// Watch for player joining the room to start the game
watch(() => gameStore.waitingForPlayer, (newValue, oldValue) => {
  if (oldValue === true && newValue === false && pendingGameSettings.value) {
    // Player joined, start the game with saved settings
    setTimeout(() => {
      handleStart(pendingGameSettings.value)
      pendingGameSettings.value = null
    }, 500)
  }
})

// Watch for invalid word in multiplayer to show dialog on both clients
watch(() => gameStore.invalidWordData, (newValue) => {
  if (newValue && gameStore.isMultiplayer) {
    currentInvalidWord.value = newValue.word
    if (newValue.type === 'duplicate') {
      duplicateWord.value = true
      wrongFirstLetter.value = false
    } else if (newValue.type === 'wrongFirstLetter') {
      duplicateWord.value = false
      wrongFirstLetter.value = true
    } else {
      duplicateWord.value = false
      wrongFirstLetter.value = false
    }
    invalidWordDialog.value = true
  } else if (!newValue && invalidWordDialog.value) {
    // Clear dialog when host clears the invalid word data
    invalidWordDialog.value = false
  }
})

// Watch for bypass flag to auto-submit in multiplayer when host accepts invalid word
watch(() => gameStore.bypassNextValidation, async (newValue) => {
  if (newValue && gameStore.isMultiplayer && gameStore.isMyTurn()) {
    // Close dialog first
    invalidWordDialog.value = false
    // Wait a tick then submit
    await new Promise(resolve => setTimeout(resolve, 10))
    await gameStore.submitGuess()
  }
})

onMounted(async () => {
  // Load word lists
  try {
    const smallWords = await fetch('/wordlists/words_small.txt').then(r => r.text())
    const bigWords = await fetch('/wordlists/words_big.txt').then(r => r.text())
    gameStore.loadWords(smallWords, bigWords)
  } catch (error) {
    console.error('Failed to load word lists:', error)
    alert('Fout bij het laden van woordenlijsten. Controleer of de bestanden bestaan.')
  }

  // Connect to multiplayer server
  gameStore.connectToServer(SERVER_URL)

  // Keyboard handling
  window.addEventListener('keydown', handleKeyPress)
  
  // Handle app visibility changes (backgrounding/foregrounding)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

function handleVisibilityChange() {
  if (!document.hidden) {
    // App came back to foreground
    console.log('App returned to foreground')
    
    // If we're in multiplayer and not connected, try to reconnect
    if (gameStore.isMultiplayer && !gameStore.isConnected && gameStore.roomId) {
      console.log('Attempting to reconnect...')
      gameStore.reconnectSocket()
    }
  } else {
    // App went to background
    console.log('App went to background')
  }
}

function handleStart(settings: { player1Name: string, player2Name: string, wordLength: number, showHintLetters: boolean, playIntroTune: boolean }) {
  gameStore.startGame(settings)
}

async function handleCreateRoom(settings: { player1Name: string, player2Name: string, wordLength: number, showHintLetters: boolean, playIntroTune?: boolean }) {
  pendingGameSettings.value = settings
  await gameStore.createRoom()
}

async function handleJoinRoom(code: string, playerName: string) {
  await gameStore.joinRoom(code, playerName)
}

function handleCancelRoom() {
  gameStore.resetMultiplayer()
  showStartup.value = true
}

function copyRoomCode() {
  if (gameStore.roomId) {
    navigator.clipboard.writeText(gameStore.roomId).then(() => {
      copyButtonText.value = 'Gekopieerd!'
      setTimeout(() => {
        copyButtonText.value = 'Kopieer code'
      }, 2000)
    }).catch(() => {
      copyButtonText.value = 'Fout'
      setTimeout(() => {
        copyButtonText.value = 'Kopieer code'
      }, 2000)
    })
  }
}

function handleNewWord() {
  // Only host controls game flow in multiplayer
  if (gameStore.isMultiplayer && !gameStore.isHost) {
    return
  }
  
  gameStore.closeOverlay()
  gameStore.startNewWord()
}

function handleNewGame() {
  gameStore.closeOverlay()
  gameStore.resetMultiplayer()
  
  // Set initial tab based on last game mode
  initialTab.value = gameStore.lastGameMode
  if (gameStore.lastGameMode === 'daily') {
    initialWordLength.value = gameStore.lastWordLength
    initialPlayerName.value = gameStore.player1.name
  } else {
    initialPlayerName.value = ''
  }
  
  showStartup.value = true
}

async function handleKeyPress(event) {
  // Handle invalid word dialog keyboard shortcuts
  if (invalidWordDialog.value) {
    // Ignore key presses if dialog just opened to prevent immediate acceptance
    if (dialogJustOpened) {
      event.preventDefault()
      return
    }
    
    // In multiplayer, only host can accept/reject invalid words
    if (gameStore.isMultiplayer && !gameStore.isHost) {
      event.preventDefault()
      return
    }
    
    if (event.key === 'Enter') {
      event.preventDefault()
      if (duplicateWord.value || wrongFirstLetter.value) {
        rejectInvalidWord()
      } else {
        acceptInvalidWord()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      rejectInvalidWord()
    }
    return
  }
  
  // Don't handle game keys if startup dialog or overlay is showing
  if (!gameStore.gameStarted || showStartup.value || gameStore.showOverlay) return
  if (gameStore.isMultiplayer && !gameStore.isMyTurn()) return

  if (event.key === 'Enter') {
    event.preventDefault()
    const result = await gameStore.submitGuess()
    if (result === 'invalid') {
      currentInvalidWord.value = gameStore.currentGuess
      duplicateWord.value = false
      wrongFirstLetter.value = false
      invalidWordDialog.value = true
    } else if (result === 'duplicate') {
      currentInvalidWord.value = gameStore.currentGuess
      duplicateWord.value = true
      wrongFirstLetter.value = false
      invalidWordDialog.value = true
    } else if (result === 'wrongFirstLetter') {
      currentInvalidWord.value = gameStore.currentGuess
      duplicateWord.value = false
      wrongFirstLetter.value = true
      invalidWordDialog.value = true
    }
  } else if (event.key === 'Backspace') {
    event.preventDefault()
    gameStore.deleteLetter()
  } else if (event.key.match(/^[a-zA-Z]$/)) {
    event.preventDefault()
    
    // Handle IJ as a single letter (Ÿ internally)
    if (event.key.toUpperCase() === 'J') {
      // Check if the current position (not previous) has 'I'
      const row = gameStore.cells[gameStore.currentRow]
      const currentCol = gameStore.currentColumn
      
      // If we're not at the first column and current cell has 'I', replace it with 'Ÿ' (IJ)
      if (currentCol > 0 && currentCol <= row.length) {
        const prevCol = currentCol - 1
        if (row[prevCol].letter === 'I') {
          // Replace the I with Ÿ (which displays as IJ)
          gameStore.replaceLastLetter('\u0178')
          return
        }
      }
    }
    
    gameStore.addLetter(event.key)
  } else if (event.key === 'Escape') {
    if (confirm('Weet je zeker dat je wilt afsluiten?')) {
      window.close()
    }
  }
}

async function acceptInvalidWord() {
  // Clear invalid word data
  gameStore.invalidWordData = null
  // Set flag to bypass validation on next submit
  gameStore.bypassNextValidation = true
  // Close the dialog
  invalidWordDialog.value = false
  // Emit immediately for multiplayer sync
  if (gameStore.isMultiplayer) {
    gameStore.emitGameState()
  }
  // If it's our turn in single player, submit immediately
  if (!gameStore.isMultiplayer) {
    await new Promise(resolve => setTimeout(resolve, 10))
    await gameStore.submitGuess(true)
  }
}

async function rejectInvalidWord() {
  // Clear invalid word data
  gameStore.invalidWordData = null
  // Close the dialog first
  invalidWordDialog.value = false
  
  // In solo mode, mark as incorrect and move to next row
  if (gameStore.isSoloMode) {
    gameStore.soloGuessCount++
    await gameStore.markWordIncorrect()
  } else {
    // Emit immediately for multiplayer sync
    if (gameStore.isMultiplayer) {
      gameStore.emitGameState()
    }
    // Clear the state (this will emit state for multiplayer)
    gameStore.retryInvalidWord()
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f3f4f6;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}

.invalid-word-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  user-select: none;
  caret-color: transparent;
  -webkit-tap-highlight-color: transparent;
}

.invalid-word-dialog .dialog-content {
  background: #1a202c;
  padding: 2rem;
  border-radius: 12px;
  max-width: 400px;
  text-align: center;
  user-select: none;
  caret-color: transparent;
  touch-action: manipulation;
}

@media (max-width: 768px) {
  .invalid-word-dialog .dialog-content {
    padding: 1.5rem;
    max-width: 90%;
  }
}

.invalid-word-dialog h3 {
  color: #ef4444;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  user-select: none;
  caret-color: transparent;
}

.invalid-word-dialog p {
  color: #f3f4f6;
  margin-bottom: 2rem;
  user-select: none;
  caret-color: transparent;
}

.invalid-word-dialog .waiting-message {
  color: #f3f4f6;
  font-size: 1.2rem;
  margin: 0;
  font-style: italic;
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
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
  min-width: 100px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
}

@media (max-width: 768px) {
  .btn {
    min-height: 52px;
    padding: 1rem 2rem;
    font-size: 1.05rem;
  }
}

.btn:active {
  transform: scale(0.95);
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

/* Waiting screen styles */
.waiting-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}

.waiting-content {
  text-align: center;
  padding: 3rem;
  background: #1a202c;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.waiting-content h1 {
  color: #fbbf24;
  font-size: 2rem;
  margin-bottom: 2rem;
}

.room-code {
  margin: 2rem 0;
}

.room-code p {
  color: #f3f4f6;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.code-display {
  background: #0f172a;
  color: #fbbf24;
  font-size: 2.5rem;
  font-weight: bold;
  letter-spacing: 0.5rem;
  padding: 1.5rem 2rem;
  border-radius: 8px;
  margin: 1rem 0 0.5rem 0;
  border: 2px solid #fbbf24;
}

.btn-copy {
  background: #22c55e;
  color: white;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.btn-copy:hover {
  background: #16a34a;
}

.code-instruction {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .waiting-content {
    padding: 2rem;
    max-width: 90%;
  }
  
  .waiting-content h1 {
    font-size: 1.5rem;
  }
  
  .code-display {
    font-size: 2rem;
    letter-spacing: 0.3rem;
    padding: 1rem 1.5rem;
  }
}

/* Reconnecting overlay styles */
.reconnecting-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
  backdrop-filter: blur(4px);
}

.reconnecting-content {
  background: #1a202c;
  padding: 2rem 3rem;
  border-radius: 12px;
  text-align: center;
  border: 2px solid #fbbf24;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.reconnecting-content p {
  color: #fbbf24;
  font-size: 1.2rem;
  margin: 0;
  font-weight: 500;
}

.spinner {
  border: 4px solid #2d3748;
  border-top: 4px solid #fbbf24;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .reconnecting-content {
    padding: 1.5rem 2rem;
    max-width: 90%;
  }
  
  .reconnecting-content p {
    font-size: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
  }
}
</style>