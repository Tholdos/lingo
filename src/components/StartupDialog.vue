<template>
  <div class="dialog-overlay">
    <div class="dialog-content">
      <h1 class="dialog-title">LINGO</h1>
      
      <!-- Speaker icon for sound toggle -->
      <div class="speaker-icon-container">
        <SpeakerIcon />
      </div>
      
      <div class="form-group">
        <label>{{ playerNameLabel }}</label>
        <input 
          v-model="player1Name" 
          type="text" 
          :placeholder="multiplayerMode ? 'Jouw naam' : 'Speler 1'" 
          ref="player1Input" 
          @focus="selectAll"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="words"
          spellcheck="false"
        />
      </div>

      <div v-if="!multiplayerMode" class="form-group">
        <label>Speler 2:</label>
        <input 
          v-model="player2Name" 
          type="text" 
          placeholder="Speler 2" 
          ref="player2Input" 
          @focus="selectAll"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="words"
          spellcheck="false"
        />
      </div>

      <div v-if="multiplayerMode !== 'join'" class="form-group">
        <label>Woordlengte:</label>
        <select v-model.number="wordLength" class="word-length-select">
          <option :value="5">5 letters</option>
          <option :value="6">6 letters</option>
          <option :value="7">7 letters</option>
          <option :value="8">8 letters</option>
          <option :value="9">9 letters</option>
          <option :value="10">10 letters</option>
        </select>
      </div>

      <div v-if="multiplayerMode !== 'join'" class="form-group">
        <label>Timer (seconden):</label>
        <input v-model.number="displayedTimerDuration" type="number" min="6" max="61" class="timer-input" />
      </div>

      <div v-if="multiplayerMode !== 'join'" class="form-group">
        <label><input type="checkbox" v-model="showHintLetters" /> Bonusletter weergeven bij beurtverlies</label>
      </div>

      <div v-if="!multiplayerMode" class="form-group">
        <label><input type="checkbox" v-model="playIntroTune" /> Intro afspelen</label>
      </div>

      <div v-if="!multiplayerMode" class="button-group">
        <button @click="handleStartGame" class="btn btn-primary" title="Druk op Enter">Start spel</button>
      </div>

      <div v-if="multiplayerMode === 'create'" class="button-group">
        <button @click="handleCreateRoom" class="btn btn-primary">Kamer maken</button>
        <button @click="handleCancelMultiplayer" class="btn btn-secondary">Terug</button>
      </div>

      <div v-if="!multiplayerMode" class="multiplayer-section">
        <h3>Multiplayer</h3>
        <div class="button-group">
          <button @click="handleShowCreateDialog" class="btn btn-secondary">Maak kamer</button>
          <button @click="handleShowJoinDialog" class="btn btn-secondary">Doe mee</button>
        </div>
      </div>

      <div v-if="showJoinDialog" class="join-dialog">
        <input 
          v-model="joinCode" 
          type="text" 
          placeholder="Kamercode"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
          @input="handleJoinCodeInput"
        />
        <div class="button-group">
          <button @click="handleJoinRoom" class="btn btn-primary">Deelnemen</button>
          <button @click="handleCancelJoin" class="btn btn-secondary">Terug</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import SpeakerIcon from './SpeakerIcon.vue'

const emit = defineEmits(['close', 'start', 'createRoom', 'joinRoom'])

const multiplayerMode = ref(null) // null = single player, 'create' = host, 'join' = joiner
const player1Name = ref('Speler 1')
const player2Name = ref('Speler 2')
const wordLength = ref(6)
const showHintLetters = ref(true)
const playIntroTune = ref(false)
const timerDuration = ref(14)
const showJoinDialog = ref(false)
const joinCode = ref('')
const player1Input = ref(null)
const player2Input = ref(null)

// Computed property for player name label
const playerNameLabel = computed(() => {
  if (multiplayerMode.value === 'create' || multiplayerMode.value === 'join') {
    return 'Jouw naam:'
  }
  return 'Speler 1:'
})

// Computed property to display timer + 1 to user (more intuitive)
const displayedTimerDuration = computed({
  get: () => timerDuration.value + 1,
  set: (value) => {
    timerDuration.value = value - 1
  }
})

// Helper function to get default timer for word length
function getDefaultTimer(len) {
  if (len <= 7) return 14
  if (len <= 9) return 19
  return 24
}

// Watch wordLength and update timer to default for that length
watch(wordLength, (newLength) => {
  timerDuration.value = getDefaultTimer(newLength)
})

onMounted(() => {
  // Load saved settings from localStorage
  const savedSettings = localStorage.getItem('lingoGameSettings')
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings)
      if (settings.player1Name) player1Name.value = settings.player1Name
      if (settings.player2Name) player2Name.value = settings.player2Name
      if (settings.wordLength) wordLength.value = settings.wordLength
      if (settings.showHintLetters !== undefined) showHintLetters.value = settings.showHintLetters
      if (settings.playIntroTune !== undefined) playIntroTune.value = settings.playIntroTune
      // Don't load timerDuration - let it default based on word length
    } catch (e) {
      console.error('Failed to load saved settings:', e)
    }
  }
  
  // Set initial timer based on word length
  timerDuration.value = getDefaultTimer(wordLength.value)
  
  if (player1Input.value) {
    player1Input.value.focus()
  }
  
  // Add keyboard listener for Enter key
  window.addEventListener('keydown', handleKeyDown)
})

function handleKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    // If join dialog is active, press the "Deelnemen" button instead
    if (showJoinDialog.value) {
      handleJoinRoom()
    } else if (multiplayerMode.value === 'create') {
      handleCreateRoom()
    } else if (!multiplayerMode.value) {
      handleStartGame()
    }
  }
}

function selectAll(event) {
  event.target.select()
}

function cleanup() {
  window.removeEventListener('keydown', handleKeyDown)
}

function handleStartGame() {
  const settings = {
    player1Name: player1Name.value || 'Speler 1',
    player2Name: player2Name.value || 'Speler 2',
    wordLength: wordLength.value,
    showHintLetters: showHintLetters.value,
    playIntroTune: playIntroTune.value,
    timerDuration: timerDuration.value
  }
  
  // Save settings to localStorage (except timer - it auto-updates based on word length)
  localStorage.setItem('lingoGameSettings', JSON.stringify({
    player1Name: settings.player1Name,
    player2Name: settings.player2Name,
    wordLength: settings.wordLength,
    showHintLetters: settings.showHintLetters,
    playIntroTune: settings.playIntroTune
  }))
  
  cleanup()
  emit('start', settings)
  emit('close')
}

function handleCreateRoom() {
  const settings = {
    player1Name: player1Name.value || 'Speler 1',
    player2Name: 'Speler 2', // Default name for player 2
    wordLength: wordLength.value,
    showHintLetters: showHintLetters.value,
    playIntroTune: playIntroTune.value,
    timerDuration: timerDuration.value
  }
  
  // Save settings to localStorage (except timer - it auto-updates based on word length)
  localStorage.setItem('lingoGameSettings', JSON.stringify({
    player1Name: settings.player1Name,
    player2Name: player2Name.value || 'Speler 2', // Always save for consistency
    wordLength: settings.wordLength,
    showHintLetters: settings.showHintLetters,
    playIntroTune: settings.playIntroTune
  }))
  
  cleanup()
  emit('createRoom', settings)
  emit('close')
}

function handleShowCreateDialog() {
  multiplayerMode.value = 'create'
}

function handleShowJoinDialog() {
  multiplayerMode.value = 'join'
  showJoinDialog.value = true
}

function handleJoinRoom() {
  const code = joinCode.value.trim()
  if (code) {
    // Save player names for consistency
    localStorage.setItem('lingoGameSettings', JSON.stringify({
      player1Name: player1Name.value || 'Speler 1',
      player2Name: player2Name.value || 'Speler 2'
    }))
    
    cleanup()
    // Pass the player name as joiner's name
    emit('joinRoom', code.toUpperCase(), player1Name.value || 'Speler 2')
    emit('close')
  }
}

function handleCancelJoin() {
  multiplayerMode.value = null
  showJoinDialog.value = false
  joinCode.value = ''
}

function handleCancelMultiplayer() {
  multiplayerMode.value = null
}

function handleJoinCodeInput(event) {
  // Force uppercase for room code
  joinCode.value = event.target.value.toUpperCase()
}

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  user-select: none;
  caret-color: transparent;
  overflow-y: auto;
  padding: 2rem 0;
}

.dialog-content {
  background: #1a202c;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  user-select: none;
  caret-color: transparent;
  margin: auto 0;
}

.dialog-title {
  text-align: center;
  font-size: 48px;
  font-weight: 900;
  margin: 0 0 2rem 0;
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

.speaker-icon-container {
  position: absolute;
  top: 2rem;
  right: 2rem;
  z-index: 1100;
}

@media (max-width: 768px) {
  .speaker-icon-container {
    top: 1rem;
    right: 1rem;
  }
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: #f3f4f6;
  margin-bottom: 0.5rem;
  font-weight: 600;
  user-select: none;
  caret-color: transparent;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 2px solid #4a5568;
  background: #2d3748;
  color: #f3f4f6;
  font-size: 1rem;
  user-select: text;
  caret-color: auto;
}

.timer-input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 2px solid #4a5568;
  background: #2d3748;
  color: #f3f4f6;
  font-size: 1rem;
}

.timer-input:focus {
  outline: none;
  border-color: #fbbf24;
}

.word-length-select {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 2px solid #4a5568;
  background: #2d3748;
  color: #f3f4f6;
  font-size: 1rem;
  cursor: pointer;
  user-select: none;
  caret-color: transparent;
}

.word-length-select:focus {
  outline: none;
  border-color: #fbbf24;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
}

.btn-primary {
  background: #fbbf24;
  color: #1a202c;
}

.btn-primary:hover {
  background: #f59e0b;
  transform: translateY(-2px);
}

.btn-secondary {
  background: #4a5568;
  color: #f3f4f6;
}

.btn-secondary:hover {
  background: #2d3748;
}

.multiplayer-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #4a5568;
}

.multiplayer-section h3 {
  color: #f3f4f6;
  text-align: center;
  margin-bottom: 1rem;
}

.join-dialog {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.join-dialog input {
  flex: 1;
  min-width: 150px;
  padding: 0.75rem;
  border-radius: 6px;
  border: 2px solid #4a5568;
  background: #2d3748;
  color: #f3f4f6;
  caret-color: #fbbf24;
  text-transform: uppercase;
}
</style>