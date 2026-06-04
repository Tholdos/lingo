<template>
  <div class="dialog-overlay">
    <div class="dialog-content">
      <h1 class="dialog-title">LINGO</h1>
      
      <!-- Speaker icon for sound toggle -->
      <div class="speaker-icon-container">
        <SpeakerIcon />
      </div>
      
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          @click="activeTab = 'solo'"
          :class="['tab-button', { active: activeTab === 'solo' }]"
        >
          Solo
        </button>
        <button 
          @click="activeTab = 'local'"
          :class="['tab-button', { active: activeTab === 'local' }]"
        >
          Duel
        </button>
        <button 
          @click="activeTab = 'daily'"
          :class="['tab-button', { active: activeTab === 'daily' }]"
        >
          Lingo van de dag
        </button>
        <button 
          @click="activeTab = 'multiplayer'"
          :class="['tab-button', { active: activeTab === 'multiplayer' }]"
        >
          Multiplayer
        </button>
      </div>
      
      <!-- Solo Tab Content -->
      <div v-if="activeTab === 'solo'" class="tab-content">
        <div class="form-group">
          <label>Speler:</label>
          <input 
            v-model="player1Name" 
            type="text" 
            placeholder="Jouw naam" 
            ref="player1Input" 
            @focus="selectAll"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="words"
            spellcheck="false"
          />
        </div>

        <div class="form-group">
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

        <div class="form-group">
          <label><input type="checkbox" v-model="timerToggle" /> Timer gebruiken</label>
        </div>

        <div class="form-group" v-if="timerToggle">
          <label>Timer (seconden):</label>
          <input v-model.number="displayedTimerDuration" type="number" min="6" max="61" class="timer-input" />
        </div>

        <div class="button-group">
          <button @click="handleStartSoloGame" class="btn btn-primary" title="Druk op Enter">Start spel</button>
        </div>
      </div>
      
      <!-- Local Duel Tab Content -->
      <div v-if="activeTab === 'local'" class="tab-content">
        <div class="form-group">
          <label>Speler 1:</label>
          <input 
            v-model="player1Name" 
            type="text" 
            placeholder="Speler 1" 
            ref="player1Input" 
            @focus="selectAll"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="words"
            spellcheck="false"
          />
        </div>

        <div class="form-group">
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

        <div class="form-group">
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

        <div class="form-group">
          <label>Timer (seconden):</label>
          <input v-model.number="displayedTimerDuration" type="number" min="6" max="61" class="timer-input" />
        </div>

        <div class="form-group">
          <label><input type="checkbox" v-model="showHintLetters" /> Bonusletter weergeven bij beurtverlies</label>
        </div>

        <div class="form-group">
          <label><input type="checkbox" v-model="playIntroTune" /> Intro afspelen</label>
        </div>

        <div class="button-group">
          <button @click="handleStartGame" class="btn btn-primary" title="Druk op Enter">Start spel</button>
        </div>
      </div>
      
      <!-- Multiplayer Tab Content -->
      <div v-if="activeTab === 'multiplayer'" class="tab-content">
        <div v-if="!multiplayerMode" class="multiplayer-menu">
          <div class="form-group">
            <label>{{ playerNameLabel }}</label>
            <input 
              v-model="player1Name" 
              type="text" 
              placeholder="Jouw naam" 
              ref="player1Input" 
              @focus="selectAll"
              inputmode="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="words"
              spellcheck="false"
            />
          </div>
          
          <div class="button-group">
            <button @click="handleShowCreateDialog" class="btn btn-primary">Maak kamer</button>
            <button @click="handleShowJoinDialog" class="btn btn-secondary">Doe mee</button>
          </div>
        </div>
        
        <div v-if="multiplayerMode === 'create'" class="multiplayer-create">
          <div class="form-group">
            <label>{{ playerNameLabel }}</label>
            <input 
              v-model="player1Name" 
              type="text" 
              placeholder="Jouw naam" 
              ref="player1Input" 
              @focus="selectAll"
              inputmode="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="words"
              spellcheck="false"
            />
          </div>

          <div class="form-group">
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

          <div class="form-group">
            <label>Timer (seconden):</label>
            <input v-model.number="displayedTimerDuration" type="number" min="6" max="61" class="timer-input" />
          </div>

          <div class="form-group">
            <label><input type="checkbox" v-model="showHintLetters" /> Bonusletter weergeven bij beurtverlies</label>
          </div>

          <div class="button-group">
            <button @click="handleCreateRoom" class="btn btn-primary">Kamer maken</button>
            <button @click="handleCancelMultiplayer" class="btn btn-secondary">Terug</button>
          </div>
        </div>

        <div v-if="showJoinDialog" class="join-dialog">
          <div class="form-group">
            <label>{{ playerNameLabel }}</label>
            <input 
              v-model="player1Name" 
              type="text" 
              placeholder="Jouw naam" 
              @focus="selectAll"
              inputmode="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="words"
              spellcheck="false"
            />
          </div>
          
          <div class="form-group">
            <label>Kamercode:</label>
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
          </div>
          
          <div class="button-group">
            <button @click="handleJoinRoom" class="btn btn-primary">Deelnemen</button>
            <button @click="handleCancelJoin" class="btn btn-secondary">Terug</button>
          </div>
        </div>
      </div>
      
      <!-- Daily Lingo Tab Content -->
      <div v-if="activeTab === 'daily'" class="tab-content">
        <div class="form-group">
          <label>Speler:</label>
          <input 
            v-model="player1Name" 
            type="text" 
            placeholder="Jouw naam" 
            ref="player1Input" 
            @focus="selectAll"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="words"
            spellcheck="false"
          />
        </div>

        <div class="form-group">
          <label>Woordlengte:</label>
          <select v-model.number="dailyWordLength" class="word-length-select">
            <option :value="5">5 letters</option>
            <option :value="6">6 letters</option>
            <option :value="7">7 letters</option>
            <option :value="8">8 letters</option>
            <option :value="9">9 letters</option>
            <option :value="10">10 letters</option>
          </select>
        </div>

        <div v-if="dailyCompleted" class="daily-completed">
          <p>✅ Je hebt deze woordlengte vandaag al gespeeld!</p>
          <p class="hint">Probeer een andere woordlengte</p>
        </div>

        <div class="daily-info">
          <p>Raad zo veel mogelijk woorden in 5 minuten</p>
          <p class="hint">Elke woordlengte kan één keer per dag gespeeld worden</p>
        </div>

        <div class="leaderboard">
          <h3>Top 5 van vandaag</h3>
          <div v-if="dailyLeaderboard.length === 0" class="no-scores">
            Nog geen scores vandaag
          </div>
          <div v-else class="leaderboard-list">
            <div v-for="(entry, index) in dailyLeaderboard" :key="index" class="leaderboard-entry">
              <span class="rank">{{ index + 1 }}.</span>
              <span class="name">{{ entry.playerName }}</span>
              <span class="score">{{ entry.score }} ({{ entry.wordsGuessed }} woorden)</span>
            </div>
          </div>
        </div>

        <div class="button-group">
          <button 
            @click="handleStartDaily" 
            class="btn btn-primary" 
            :disabled="dailyCompleted || dailyLoading"
            title="Druk op Enter"
          >
            {{ dailyLoading ? 'Laden...' : 'Start' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import SpeakerIcon from './SpeakerIcon.vue'

const props = defineProps({
  initialTab: {
    type: String,
    default: 'solo'
  },
  initialWordLength: {
    type: Number,
    default: 6
  },
  initialPlayerName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'start', 'createRoom', 'joinRoom'])

const activeTab = ref(props.initialTab) // 'local', 'multiplayer', 'daily', 'solo'
const multiplayerMode = ref(null) // null = single player, 'create' = host, 'join' = joiner
const player1Name = ref('Speler 1')
const player2Name = ref('Speler 2')
const wordLength = ref(6)
const showHintLetters = ref(true)
const playIntroTune = ref(false)
const timerDuration = ref(14)
const timerToggle = ref(true)  // Timer enabled by default in solo mode
const showJoinDialog = ref(false)
const joinCode = ref('')
const player1Input = ref(null)
const player2Input = ref(null)

// Daily challenge state
const dailyWordLength = ref(props.initialWordLength)
const dailyCompleted = ref(false)
const dailyLeaderboard = ref([])
const dailyLoading = ref(false)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://lingo-server-oybx.onrender.com'

// Computed property for player name label
const playerNameLabel = computed(() => {
  if (activeTab.value === 'multiplayer') {
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

// Watch activeTab and reset multiplayerMode when switching tabs
watch(activeTab, (newTab) => {
  if (newTab !== 'multiplayer') {
    multiplayerMode.value = null
    showJoinDialog.value = false
  }
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
  
  // Override with initial player name if provided (for daily mode)
  if (props.initialPlayerName) {
    player1Name.value = props.initialPlayerName
  }
  
  // Set initial timer based on word length
  timerDuration.value = getDefaultTimer(wordLength.value)
  
  // If starting with daily tab, load leaderboard and check completion
  if (activeTab.value === 'daily') {
    loadDailyLeaderboard()
    checkDailyCompleted()
  }
  
  if (player1Input.value) {
    player1Input.value.focus()
  }
  
  // Add keyboard listener for Enter key
  window.addEventListener('keydown', handleKeyDown)
})

function handleKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    // Handle based on active tab and state
    if (activeTab.value === 'solo') {
      handleStartSoloGame()
    } else if (activeTab.value === 'local') {
      handleStartGame()
    } else if (activeTab.value === 'daily') {
      if (!dailyCompleted.value && !dailyLoading.value) {
        handleStartDaily()
      }
    } else if (activeTab.value === 'multiplayer') {
      if (showJoinDialog.value) {
        handleJoinRoom()
      } else if (multiplayerMode.value === 'create') {
        handleCreateRoom()
      }
    }
  }
}

function selectAll(event) {
  event.target.select()
}

function cleanup() {
  window.removeEventListener('keydown', handleKeyDown)
}

function handleStartSoloGame() {
  const settings = {
    player1Name: player1Name.value || 'Speler 1',
    player2Name: 'Computer',  // Placeholder for solo mode
    wordLength: wordLength.value,
    showHintLetters: false,  // No bonus letters in solo mode
    playIntroTune: false,  // No intro in solo mode
    timerDuration: timerToggle.value ? timerDuration.value : undefined,
    isSoloMode: true,
    timerEnabled: timerToggle.value
  }
  
  // Save settings to localStorage (don't save showHintLetters for solo mode)
  localStorage.setItem('lingoGameSettings', JSON.stringify({
    player1Name: settings.player1Name,
    player2Name: player2Name.value || 'Speler 2',
    wordLength: settings.wordLength,
    playIntroTune: playIntroTune.value
  }))
  
  cleanup()
  emit('start', settings)
  emit('close')
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
    // Save all settings for consistency
    localStorage.setItem('lingoGameSettings', JSON.stringify({
      player1Name: player1Name.value || 'Speler 1',
      player2Name: player2Name.value || 'Speler 2',
      wordLength: wordLength.value,
      showHintLetters: showHintLetters.value,
      playIntroTune: playIntroTune.value
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

// Daily challenge functions
async function loadDailyLeaderboard() {
  try {
    const response = await fetch(`${SERVER_URL}/api/daily/leaderboard/${dailyWordLength.value}`)
    const data = await response.json()
    dailyLeaderboard.value = data.leaderboard || []
  } catch (error) {
    console.error('Error loading leaderboard:', error)
    dailyLeaderboard.value = []
  }
}

async function checkDailyCompleted() {
  if (!player1Name.value) return
  
  try {
    const response = await fetch(`${SERVER_URL}/api/daily/completed/${dailyWordLength.value}/${encodeURIComponent(player1Name.value)}`)
    const data = await response.json()
    dailyCompleted.value = data.completed
  } catch (error) {
    console.error('Error checking completion:', error)
    dailyCompleted.value = false
  }
}

async function handleStartDaily() {
  if (!player1Name.value) {
    alert('Vul je naam in')
    return
  }
  
  dailyLoading.value = true
  
  try {
    // Check if already completed
    await checkDailyCompleted()
    if (dailyCompleted.value) {
      dailyLoading.value = false
      return
    }
    
    // Mark as started to prevent replays
    const startResponse = await fetch(`${SERVER_URL}/api/daily/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: player1Name.value,
        wordLength: dailyWordLength.value
      })
    })
    
    if (!startResponse.ok) {
      alert('Je hebt deze uitdaging vandaag al gespeeld')
      dailyLoading.value = false
      await checkDailyCompleted()
      return
    }
    
    // Fetch daily words
    const response = await fetch(`${SERVER_URL}/api/daily/words/${dailyWordLength.value}`)
    const data = await response.json()
    
    if (!data.words || data.words.length === 0) {
      alert('Geen woorden beschikbaar voor deze lengte')
      dailyLoading.value = false
      return
    }
    
    const settings = {
      player1Name: player1Name.value,
      player2Name: 'Computer',
      wordLength: dailyWordLength.value,
      showHintLetters: false,
      playIntroTune: false,
      isDailyMode: true,
      dailyWords: data.words,
      timerEnabled: true
    }
    
    // Set up callback for when challenge completes
    window.dailyChallenge = {
      onComplete: async (score, wordsGuessed) => {
        try {
          const response = await fetch(`${SERVER_URL}/api/daily/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerName: player1Name.value,
              wordLength: dailyWordLength.value,
              score,
              wordsGuessed
            })
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            console.error('Error submitting score:', data.error)
          } else {
            console.log('Score submitted successfully!')
            // Reload leaderboard to show updated scores
            await loadDailyLeaderboard()
          }
        } catch (error) {
          console.error('Error submitting score:', error)
        }
      }
    }
    
    cleanup()
    emit('start', settings)
    emit('close')
  } catch (error) {
    console.error('Error starting daily challenge:', error)
    alert('Fout bij het starten van de dagelijkse uitdaging')
  } finally {
    dailyLoading.value = false
  }
}

// Watch for changes to player name to check completion
watch(player1Name, () => {
  if (activeTab.value === 'daily') {
    checkDailyCompleted()
  }
})

// Watch for word length changes to update leaderboard and completion
watch(dailyWordLength, () => {
  if (activeTab.value === 'daily') {
    loadDailyLeaderboard()
    checkDailyCompleted()
  }
})

// Watch for tab changes to daily
watch(activeTab, (newTab) => {
  if (newTab === 'daily') {
    loadDailyLeaderboard()
    checkDailyCompleted()
  }
})

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
  background: #1a1a2e;
  padding: 2rem 2.5rem;
  border-radius: 10px;
  min-width: 350px;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  margin: auto;
  position: relative;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-title {
  text-align: center;
  font-size: 3rem;
  font-weight: 900;
  margin: 0 0 1.5rem 0;
  padding: 0.25rem 0;
  background: linear-gradient(to right, #FFD700, #FFA500, #FF8C00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(2px 2px 8px rgba(0, 0, 0, 0.8));
  user-select: none;
  caret-color: transparent;
  letter-spacing: 0.2em;
  line-height: 1.2;
}

.speaker-icon-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #2d2d44;
  padding-bottom: 0.5rem;
}

.tab-button {
  flex: 1;
  background: transparent;
  border: none;
  color: #888;
  padding: 0.75rem 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  font-weight: 500;
}

.tab-button:hover:not(:disabled) {
  color: #fff;
  border-bottom-color: #ffd700;
}

.tab-button.active {
  color: #ffd700;
  border-bottom-color: #ffd700;
}

.tab-button:disabled {
  color: #555;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Tab Content */
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: #fff;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 0.7rem;
  background: #2d2d44;
  border: 2px solid #3d3d5c;
  border-radius: 5px;
  color: #fff;
  font-size: 1rem;
  caret-color: #ffd700;
}

.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus,
.form-group select:focus {
  outline: none;
  border-color: #ffd700;
}

.form-group input[type="checkbox"] {
  margin-right: 0.5rem;
  cursor: pointer;
  width: auto;
}

.word-length-select,
.timer-input {
  cursor: pointer;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn {
  flex: 1;
  padding: 0.9rem;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.05em;
}

.btn-primary {
  background: #ffd700;
  color: #1a1a2e;
}

.btn-primary:hover {
  background: #ffed4e;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
}

.btn-secondary {
  background: #3d3d5c;
  color: #fff;
}

.btn-secondary:hover {
  background: #4d4d6c;
  transform: translateY(-2px);
}

.multiplayer-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #2d2d44;
}

.multiplayer-section h3 {
  color: #fff;
  text-align: center;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.join-dialog {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #2d2d44;
}

.coming-soon {
  text-align: center;
  padding: 2rem 1rem;
}

.coming-soon p {
  color: #fff;
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.coming-soon .description {
  color: #888;
  font-size: 0.9rem;
}

.daily-completed {
  background: #2d4d2d;
  border: 2px solid #4d8d4d;
  border-radius: 5px;
  padding: 1rem;
  margin-bottom: 1rem;
  text-align: center;
}

.daily-completed p {
  color: #6ddd6d;
  margin: 0;
  font-weight: 600;
}

.daily-completed .hint {
  color: #8dfd8d;
  margin-top: 0.5rem;
  font-weight: 400;
  font-size: 0.9rem;
}

.daily-info {
  background: #2d2d44;
  border-radius: 5px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.daily-info p {
  color: #ccc;
  margin: 0.25rem 0;
  font-size: 0.85rem;
}

.daily-info .hint {
  color: #888;
  font-size: 0.8rem;
  font-style: italic;
}

.leaderboard {
  background: #2d2d44;
  border-radius: 5px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.leaderboard h3 {
  color: #ffd700;
  text-align: center;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.no-scores {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 1rem;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.leaderboard-entry {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #1a1a2e;
  border-radius: 3px;
}

.leaderboard-entry .rank {
  color: #ffd700;
  font-weight: bold;
  min-width: 2rem;
}

.leaderboard-entry .name {
  color: #fff;
  flex: 1;
  font-weight: 500;
}

.leaderboard-entry .score {
  color: #6ddd6d;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:disabled:hover {
  transform: none;
  box-shadow: none;
}
</style>
