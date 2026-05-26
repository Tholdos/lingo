import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { LetterState } from '@/types/game'
import { io } from 'socket.io-client'

const MAX_ATTEMPTS = 5

function getTimerDuration(wordLen) {
  if (wordLen <= 7) return 14
  if (wordLen <= 9) return 19
  return 24 // wordLen === 10
}

export const useGameStore = defineStore('game', () => {
  // State
  const player1 = ref({ name: 'Speler 1', score: 0 })
  const player2 = ref({ name: 'Speler 2', score: 0 })
  const activePlayer = ref(1)
  const targetWord = ref('')
  const currentRow = ref(0)
  const currentColumn = ref(0)
  const wordLength = ref(6)
  const cells = ref([])
  const revealedPositions = ref(new Set())
  const timeRemaining = ref(14)
  const isTimerActive = ref(false)
  const showHintLetters = ref(true)
  const wordList = ref([])
  const checkWordList = ref([])
  const gameStarted = ref(false)
  const showGrid = ref(false)
  const showOverlay = ref(false)
  const overlayMessage = ref('')
  const isProcessingGuess = ref(false)
  const guessedWords = ref(new Set())
  const extraGuessCount = ref(0)
  const roundStartPlayer = ref(1)
  
  // Multiplayer
  const socket = ref(null)
  const roomId = ref(null)
  const isMultiplayer = ref(false)
  const isHost = ref(false)
  const isConnected = ref(false)
  const waitingForPlayer = ref(false)

  // Preload audio files for smoother playback
  const audioCache = {
    correct: null,
    wrongPosition: null,
    incorrect: null
  }
  
  // Preload audio files
  function preloadAudio() {
    try {
      audioCache.correct = new Audio('/sounds/correct.mp3')
      audioCache.correct.volume = 0.3
      audioCache.correct.load()
      
      audioCache.wrongPosition = new Audio('/sounds/wrongPosition.mp3')
      audioCache.wrongPosition.volume = 0.3
      audioCache.wrongPosition.load()
      
      audioCache.incorrect = new Audio('/sounds/incorrect.mp3')
      audioCache.incorrect.volume = 0.3
      audioCache.incorrect.load()
    } catch (e) {
      // Silently fail if preloading is not supported
    }
  }
  
  // Call preload on store initialization
  preloadAudio()

  // Computed
  const currentGuess = computed(() => {
    if (currentRow.value >= cells.value.length) return ''
    return cells.value[currentRow.value]
      .map(cell => cell.letter)
      .join('')
  })

  const activePlayerName = computed(() => 
    activePlayer.value === 1 ? player1.value.name : player2.value.name
  )

  // Timer interval
  let timerInterval = null

  // Actions
  function initializeGrid() {
    cells.value = Array(MAX_ATTEMPTS).fill(null).map(() =>
      Array(wordLength.value).fill(null).map(() => ({
        letter: '',
        state: LetterState.Empty
      }))
    )
  }

  function loadWords(smallWords, bigWords) {
    const normalizeIJ = (text) => {
      // Use uppercase Ÿ (U+0178) to represent IJ as a single character
      return text.toUpperCase().replace(/IJ/g, '\u0178')
    }

    wordList.value = smallWords
      .split('\n')
      .map(w => normalizeIJ(w.trim()))
      .filter(w => w.length > 0)

    checkWordList.value = bigWords
      .split('\n')
      .map(w => normalizeIJ(w.trim()))
      .filter(w => w.length > 0)
  }

  function startNewWord() {
    if (wordList.value.length === 0) return
    
    const filteredWords = wordList.value.filter(w => w.length === wordLength.value)
    if (filteredWords.length === 0) return
    
    targetWord.value = filteredWords[Math.floor(Math.random() * filteredWords.length)]
    
    currentRow.value = 0
    currentColumn.value = 0  // Start at position 0
    revealedPositions.value = new Set([0])
    guessedWords.value = new Set()  // Clear guessed words for new round
    extraGuessCount.value = 0
    roundStartPlayer.value = activePlayer.value
    
    initializeGrid()
    
    // Reveal first letter
    cells.value[0][0].letter = targetWord.value[0]
    cells.value[0][0].state = LetterState.Hint
    
    // Keep currentColumn at 0 - player must overwrite the hint
    
    showGrid.value = true
    startTimer()

    if (isMultiplayer.value && isHost.value) {
      emitGameState()
    }
  }

  function startGame(settings) {
    player1.value.name = settings.player1Name
    player2.value.name = settings.player2Name
    player1.value.score = 0
    player2.value.score = 0
    wordLength.value = settings.wordLength
    showHintLetters.value = settings.showHintLetters
    activePlayer.value = 1
    gameStarted.value = true
    showGrid.value = false
    
    // Play intro tune if enabled, then start game after 19 seconds
    if (settings.playIntroTune) {
      playIntroTune()
      // Wait 19 seconds before showing grid and starting word
      setTimeout(() => {
        startNewWord()
      }, 19000)
    } else {
      startNewWord()
    }
  }

  function addLetter(letter) {
    if (!gameStarted.value || isProcessingGuess.value) return
    if (isMultiplayer.value && !isMyTurn()) return

    const row = cells.value[currentRow.value]
    
    // Use current column directly - all letters are overwritable
    let col = currentColumn.value
    
    // Add the letter at current position (overwrite any existing letter)
    if (col < wordLength.value) {
      row[col].letter = letter.toUpperCase()
      // Keep track of original state for hints to restore visual styling
      if (row[col].state !== LetterState.Hint) {
        row[col].state = LetterState.Empty
      }
      currentColumn.value = col + 1
    }

    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  function replaceLastLetter(letter) {
    if (!gameStarted.value || isProcessingGuess.value) return
    if (isMultiplayer.value && !isMyTurn()) return

    const row = cells.value[currentRow.value]
    const col = currentColumn.value - 1
    
    if (col >= 0 && col < wordLength.value) {
      row[col].letter = letter.toUpperCase()
      // Keep track of original state for hints to restore visual styling
      if (row[col].state !== LetterState.Hint) {
        row[col].state = LetterState.Empty
      }
      // Don't advance currentColumn since we're replacing, not adding
    }

    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  function deleteLetter() {
    if (!gameStarted.value || isProcessingGuess.value) return
    if (isMultiplayer.value && !isMyTurn()) return

    const row = cells.value[currentRow.value]
    
    // Start from the position before current
    let col = currentColumn.value - 1
    
    // Find the last letter (including hints that were typed over)
    while (col >= 0 && row[col].letter === '') {
      col--
    }
    
    if (col >= 0) {
      // Check if this position should have a hint
      const shouldBeHint = revealedPositions.value.has(col) || 
                          (currentRow.value > 0 && cells.value[currentRow.value - 1][col].state === LetterState.Correct)
      
      if (shouldBeHint) {
        // Restore the hint letter
        row[col].letter = targetWord.value[col]
        row[col].state = LetterState.Hint
      } else {
        // Clear the cell
        row[col].letter = ''
        row[col].state = LetterState.Empty
      }
      currentColumn.value = col
    }

    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  async function submitGuess(bypassDictionaryCheck = false) {
    if (!gameStarted.value || isProcessingGuess.value) return null
    if (isMultiplayer.value && !isMyTurn()) return null

    const guess = currentGuess.value
    
    if (guess.length !== wordLength.value) return null

    // Check if all positions are filled
    const row = cells.value[currentRow.value]
    for (let i = 0; i < wordLength.value; i++) {
      if (row[i].letter === '') return null
    }

    isProcessingGuess.value = true
    
    // Check if word starts with the correct first letter (which is always revealed)
    if (!bypassDictionaryCheck && guess[0] !== targetWord.value[0]) {
      isProcessingGuess.value = false
      return 'wrongFirstLetter'
    }
    
    // Check if word has already been guessed in this round (unless bypassing)
    if (!bypassDictionaryCheck && guessedWords.value.has(guess)) {
      isProcessingGuess.value = false
      return 'duplicate'
    }
    
    // Check if word exists in dictionary (unless bypassed)
    if (!bypassDictionaryCheck && !checkWordList.value.includes(guess)) {
      isProcessingGuess.value = false
      return 'invalid'
    }
    
    // Add to guessed words only after validation passes or is bypassed
    guessedWords.value.add(guess)
    
    stopTimer()
    
    // Determine final states for all letters first
    const targetLetters = targetWord.value.split('')
    const guessLetters = guess.split('')
    const letterCounts = new Map()
    const finalStates = new Array(wordLength.value)
    
    // Count letters in target word
    targetLetters.forEach(letter => {
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1)
    })
    
    // First pass: mark correct positions
    for (let i = 0; i < wordLength.value; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        finalStates[i] = LetterState.Correct
        letterCounts.set(guessLetters[i], (letterCounts.get(guessLetters[i]) || 0) - 1)
        // Mark this position as revealed to avoid re-revealing it as a hint
        revealedPositions.value.add(i)
      }
    }
    
    // Second pass: mark wrong positions and incorrect
    for (let i = 0; i < wordLength.value; i++) {
      if (finalStates[i] !== LetterState.Correct) {
        if (letterCounts.get(guessLetters[i]) > 0) {
          finalStates[i] = LetterState.WrongPosition
          letterCounts.set(guessLetters[i], letterCounts.get(guessLetters[i]) - 1)
        } else {
          finalStates[i] = LetterState.Incorrect
        }
      }
    }
    
    // Apply states and play sounds with animation delay
    for (let i = 0; i < wordLength.value; i++) {
      row[i].state = finalStates[i]
      playLetterSound(finalStates[i])
      await sleep(250)
    }
    
    // Check if won
    if (guess === targetWord.value) {
      // Play victory tune
      playVictoryTune()
      
      if (activePlayer.value === 1) {
        player1.value.score += 50
      } else {
        player2.value.score += 50
      }
      
      overlayMessage.value = `${activePlayerName.value} heeft het woord geraden!`
      showOverlay.value = true
      
      isProcessingGuess.value = false
      
      if (isMultiplayer.value) {
        emitGameState()
      }
      
      return 'won'
    }
    
    // Check if we're at row 4 (5th attempt or beyond)
    if (currentRow.value >= MAX_ATTEMPTS - 1) {
      // Check if we've already used our 2 extra guesses
      if (extraGuessCount.value >= 2) {
        // Reveal the word - no points awarded
        await revealWord()
        isProcessingGuess.value = false
        return 'revealed'
      } else {
        // Increment extra guess count and switch players
        extraGuessCount.value++
        await switchPlayer()
        isProcessingGuess.value = false
        
        if (isMultiplayer.value) {
          emitGameState()
        }
        
        return 'switched'
      }
    } else {
      currentRow.value++
      currentColumn.value = 0
      copyHintsToNextRow()
      startTimer()
      
      isProcessingGuess.value = false
      
      if (isMultiplayer.value) {
        emitGameState()
      }
      
      return 'continue'
    }
  }

  function clearCurrentRow() {
    const row = cells.value[currentRow.value]
    for (let i = 0; i < wordLength.value; i++) {
      // Check if this position should have a hint
      const shouldBeHint = revealedPositions.value.has(i) || 
                          (currentRow.value > 0 && cells.value[currentRow.value - 1][i].state === LetterState.Correct)
      
      if (shouldBeHint) {
        // Restore the hint letter
        row[i].letter = targetWord.value[i]
        row[i].state = LetterState.Hint
      } else {
        // Clear the cell
        row[i].letter = ''
        row[i].state = LetterState.Empty
      }
    }
    currentColumn.value = 0
  }

  async function switchPlayer(isTimeout = false) {
    stopTimer()
    
    // Clear current row if timeout (and word wasn't complete)
    if (isTimeout) {
      clearCurrentRow()
    }
    
    // Play appropriate sound
    if (isTimeout) {
      playTimeoutBuzzer()
    } else {
      playTurnSwitchSound()
      playTurnOverSound()
    }
    
    activePlayer.value = activePlayer.value === 1 ? 2 : 1
    
    // Move to next row
    currentRow.value++
    
    // Shift rows up if we're past the 5th row (index 4)
    if (currentRow.value >= MAX_ATTEMPTS) {
      // Shift rows up and clear the last row
      for (let r = 0; r < MAX_ATTEMPTS - 1; r++) {
        for (let c = 0; c < wordLength.value; c++) {
          cells.value[r][c] = { ...cells.value[r + 1][c] }
        }
      }
      
      // Clear last row
      for (let c = 0; c < wordLength.value; c++) {
        cells.value[MAX_ATTEMPTS - 1][c] = {
          letter: '',
          state: LetterState.Empty
        }
      }
      
      // Stay on the last row after shifting
      currentRow.value = MAX_ATTEMPTS - 1
    }
    
    currentColumn.value = 0
    
    // Copy hints from previous row immediately
    copyHintsToNextRow()
    
    // Add delay before revealing NEW bonus letter (different for timeout vs normal turn)
    const delay = isTimeout ? 1000 : 1500
    await sleep(delay)
    
    // Reveal NEW bonus letter if hint letters are enabled
    if (showHintLetters.value) {
      await revealBonusLetter()
    }
    
    // Start timer after bonus letter is revealed
    startTimer()
  }

  async function revealBonusLetter() {
    // Count how many positions are currently unrevealed
    const unrevealedCount = Array.from({ length: wordLength.value }, (_, i) => i)
      .filter(i => !revealedPositions.value.has(i)).length
    
    // Don't reveal if only 1 unrevealed letter remains (keep at least one hidden)
    if (unrevealedCount <= 1) {
      return
    }
    
    // Find the first unrevealed position (excluding the last position)
    for (let i = 0; i < wordLength.value - 1; i++) {
      if (!revealedPositions.value.has(i)) {
        revealedPositions.value.add(i)
        // Play sound and reveal letter simultaneously
        playBonusLetterSound()
        cells.value[currentRow.value][i].letter = targetWord.value[i]
        cells.value[currentRow.value][i].state = LetterState.Hint
        return
      }
    }
  }

  function copyHintsToNextRow() {
    if (currentRow.value > 0) {
      for (let i = 0; i < wordLength.value; i++) {
        const prevCell = cells.value[currentRow.value - 1][i]
        if (prevCell.state === LetterState.Correct || prevCell.state === LetterState.Hint) {
          cells.value[currentRow.value][i].letter = prevCell.letter
          cells.value[currentRow.value][i].state = LetterState.Hint
        }
      }
    }
    
    // Also copy revealed positions
    for (const pos of revealedPositions.value) {
      if (cells.value[currentRow.value][pos].state !== LetterState.Correct) {
        cells.value[currentRow.value][pos].letter = targetWord.value[pos]
        cells.value[currentRow.value][pos].state = LetterState.Hint
      }
    }
  }

  function startTimer() {
    stopTimer()
    isTimerActive.value = true
    timeRemaining.value = getTimerDuration(wordLength.value)
    
    timerInterval = setInterval(async () => {
      if (timeRemaining.value > 0) {
        timeRemaining.value--
      } else {
        stopTimer()
        // Check if the current row is complete
        const row = cells.value[currentRow.value]
        let isComplete = true
        for (let i = 0; i < wordLength.value; i++) {
          if (row[i].letter === '') {
            isComplete = false
            break
          }
        }
        
        if (isComplete) {
          // Submit the word and check result
          const result = await submitGuess()
          // If invalid, clear row and retry on same row with buzzer
          if (result === 'invalid' || result === 'duplicate' || result === 'wrongFirstLetter') {
            retryAfterTimeout()
          }
        } else {
          // Incomplete word - retry on same row with timeout
          retryAfterTimeout()
        }
      }
    }, 1000)
  }

  function stopTimer() {
    isTimerActive.value = false
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function closeOverlay() {
    showOverlay.value = false
  }

  async function retryInvalidWord() {
    stopTimer()
    
    // Play turnover sound
    playTurnSwitchSound()
    playTurnOverSound()
    
    // Clear the current row (restores hints)
    clearCurrentRow()
    
    // Add delay before revealing bonus letter
    await sleep(1500)
    
    // Reveal bonus letter if hint letters are enabled
    if (showHintLetters.value) {
      await revealBonusLetter()
    }
    
    // Start timer after bonus letter is revealed
    startTimer()
  }

  async function retryAfterTimeout() {
    stopTimer()
    
    // If we're at row 4, check if we should reveal or continue
    if (currentRow.value >= MAX_ATTEMPTS - 1) {
      // Check if we've already used our 2 extra guesses
      if (extraGuessCount.value >= 2) {
        // Reveal the word - no points awarded
        await revealWord()
        return
      } else {
        // Increment extra guess count and switch to other player
        extraGuessCount.value++
        await switchPlayer(true)
        return
      }
    }
    
    // Play buzzer sound
    playTimeoutBuzzer()
    
    // Clear the current row (restores hints)
    clearCurrentRow()
    
    // Add delay before revealing bonus letter
    await sleep(1000)
    
    // Reveal bonus letter if hint letters are enabled
    if (showHintLetters.value) {
      await revealBonusLetter()
    }
    
    // Start timer after bonus letter is revealed
    startTimer()
  }

  async function revealWord() {
    stopTimer()
    
    // Shift all rows up once more and use last row for reveal
    for (let r = 0; r < MAX_ATTEMPTS - 1; r++) {
      for (let c = 0; c < wordLength.value; c++) {
        cells.value[r][c] = { ...cells.value[r + 1][c] }
      }
    }
    
    // Use the last row for reveal
    currentRow.value = MAX_ATTEMPTS - 1
    currentColumn.value = 0
    const row = cells.value[currentRow.value]
    
    // First set all letters
    for (let i = 0; i < wordLength.value; i++) {
      row[i].letter = targetWord.value[i]
      row[i].state = LetterState.Empty
    }
    
    // Reveal letters one by one with animation (like correct guess)
    for (let i = 0; i < wordLength.value; i++) {
      row[i].state = LetterState.Correct
      playLetterSound(LetterState.Correct)
      await sleep(250)
    }
    
    // Play victory tune
    playVictoryTune()
    
    // Wait a bit then show message
    await sleep(1000)
    
    // Set active player back to round start player for next word
    activePlayer.value = roundStartPlayer.value
    
    overlayMessage.value = `Niemand heeft het woord geraden. Het woord was: ${targetWord.value.replace(/\u0178/g, 'IJ')}`
    showOverlay.value = true
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Web Audio API for sound effects
  let audioContext = null
  
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContext
  }
  
  function playLetterSound(letterState) {
    try {
      let audio = null
      
      // Select audio from cache based on letter state
      switch (letterState) {
        case LetterState.Correct:
          audio = audioCache.correct
          break
        case LetterState.WrongPosition:
          audio = audioCache.wrongPosition
          break
        case LetterState.Incorrect:
          audio = audioCache.incorrect
          break
        default:
          audio = audioCache.incorrect
      }
      
      if (audio) {
        // Clone and play the preloaded audio
        const audioClone = audio.cloneNode()
        audioClone.volume = 0.3
        audioClone.play().catch(() => {
          // If audio file fails, try synthesized fallback
          playSynthesizedLetterSound(letterState)
        })
      } else {
        playSynthesizedLetterSound(letterState)
      }
    } catch (e) {
      // Fall back to synthesized sound
      playSynthesizedLetterSound(letterState)
    }
  }

  function playSynthesizedLetterSound(letterState) {
    try {
      const ctx = getAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Map MIDI note to frequency
      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
      
      // Set frequency based on letter state (matching the C# code)
      let midiNote
      switch (letterState) {
        case LetterState.Correct:
          midiNote = 60 // C4 (middle C)
          break
        case LetterState.WrongPosition:
          midiNote = 55 // G3
          break
        case LetterState.Incorrect:
          midiNote = 48 // C3
          break
        default:
          midiNote = 48
      }
      
      oscillator.frequency.value = midiToFreq(midiNote)
      oscillator.type = 'triangle' // Softer sound than square wave
      
      // Volume envelope
      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15) // Decay
      
      oscillator.start(now)
      oscillator.stop(now + 0.15)
    } catch (e) {
      // Silently fail if audio context is not available
    }
  }
  
  function playVictoryTune() {
    try {
      // Try to play audio file first (mp3 or wav)
      const audio = new Audio('/sounds/victory.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/victory.wav')
        audioWav.volume = 0.5
        audioWav.play().catch(() => {
          // If both fail, fall back to synthesized tune
          playSynthesizedVictoryTune()
        })
      })
    } catch (e) {
      // Fall back to synthesized tune
      playSynthesizedVictoryTune()
    }
  }

  function playSynthesizedVictoryTune() {
    try {
      const ctx = getAudioContext()
      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
      
      // Victory tune sequence
      const notes = [
        { midi: 66, duration: 400, gap: 50 },  // F#4
        { midi: 66, duration: 400, gap: 75 },  // F#4
        { midi: 63, duration: 200, gap: 1 },   // Eb4
        { midi: 63, duration: 200, gap: 1 },   // Eb4
        { midi: 65, duration: 200, gap: 1 },   // F4
        { midi: 66, duration: 200, gap: 1 }    // F#4
      ]
      
      let currentTime = ctx.currentTime
      
      notes.forEach(note => {
        // Create multiple oscillators for rich orchestral sound
        const oscillators = []
        const gainNodes = []
        
        // Orchestral ensemble with 5 layers
        for (let i = 0; i < 5; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          
          osc.connect(gain)
          gain.connect(ctx.destination)
          
          const freq = midiToFreq(note.midi)
          const noteDuration = note.duration / 1000
          
          if (i === 0) {
            // Brass (main voice)
            osc.frequency.value = freq
            osc.type = 'sawtooth'
            gain.gain.setValueAtTime(0, currentTime)
            gain.gain.linearRampToValueAtTime(0.05, currentTime + 0.01)
            gain.gain.linearRampToValueAtTime(0.04, currentTime + noteDuration * 0.8)
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
          } else if (i === 1) {
            // Strings (octave below)
            osc.frequency.value = freq / 2
            osc.type = 'triangle'
            gain.gain.setValueAtTime(0, currentTime)
            gain.gain.linearRampToValueAtTime(0.025, currentTime + 0.02) // Slower attack for strings
            gain.gain.linearRampToValueAtTime(0.022, currentTime + noteDuration * 0.9)
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
          } else if (i === 2) {
            // Harmonic overtone (fifth above)
            osc.frequency.value = freq * 1.5
            osc.type = 'sine'
            gain.gain.setValueAtTime(0, currentTime)
            gain.gain.linearRampToValueAtTime(0.02, currentTime + 0.01)
            gain.gain.linearRampToValueAtTime(0.017, currentTime + noteDuration * 0.8)
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
          } else if (i === 3) {
            // Timpani/bass (two octaves below)
            osc.frequency.value = freq / 4
            osc.type = 'sine'
            gain.gain.setValueAtTime(0, currentTime)
            gain.gain.linearRampToValueAtTime(0.03, currentTime + 0.005) // Very quick attack
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration * 0.6) // Quick decay
          } else {
            // Shimmer (third harmonic)
            osc.frequency.value = freq * 2
            osc.type = 'sine'
            gain.gain.setValueAtTime(0, currentTime)
            gain.gain.linearRampToValueAtTime(0.015, currentTime + 0.015)
            gain.gain.linearRampToValueAtTime(0.012, currentTime + noteDuration * 0.8)
            gain.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
          }
          
          osc.start(currentTime)
          osc.stop(currentTime + noteDuration)
          
          oscillators.push(osc)
          gainNodes.push(gain)
        }
        
        currentTime += (note.duration / 1000) + (note.gap / 1000)
      })
    } catch (e) {
      // Silently fail if audio context is not available
    }
  }
  
  function playTurnSwitchSound() {
    try {
      const ctx = getAudioContext()
      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
      
      // Descending notes for turn switch
      const notes = [60, 58, 56, 54, 52, 50, 48, 46, 44, 42]
      const duration = 75 // ms
      const gap = 1 // ms
      
      let currentTime = ctx.currentTime
      
      notes.forEach(midi => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = midiToFreq(midi)
        oscillator.type = 'triangle' // Acoustic bass-like
        
        const noteDuration = duration / 1000
        
        gainNode.gain.setValueAtTime(0, currentTime)
        gainNode.gain.linearRampToValueAtTime(0.2, currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
        
        oscillator.start(currentTime)
        oscillator.stop(currentTime + noteDuration)
        
        currentTime += noteDuration + (gap / 1000)
      })
    } catch (e) {
      // Silently fail if audio context is not available
    }
  }
  
  function playTimeoutBuzzer() {
    try {
      const audio = new Audio('/sounds/buzzer.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/buzzer.wav')
        audioWav.volume = 0.5
        audioWav.play().catch(() => {
          // Silently fail if both formats fail
        })
      })
    } catch (e) {
      // Silently fail
    }
  }

  function playIntroTune() {
    try {
      // Try to play audio file first (mp3 or wav)
      const audio = new Audio('/sounds/intro.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/intro.wav')
        audioWav.volume = 0.5
        audioWav.play().catch(() => {
          // If both fail, fall back to synthesized tune
          playSynthesizedIntroTune()
        })
      })
    } catch (e) {
      // Fall back to synthesized tune
      playSynthesizedIntroTune()
    }
  }

  function playSynthesizedIntroTune() {
    try {
      const ctx = getAudioContext()
      const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
      
      // Intro tune - uplifting and energetic
      const notes = [
        { midi: 60, duration: 200, gap: 10 },  // C4
        { midi: 64, duration: 200, gap: 10 },  // E4
        { midi: 67, duration: 200, gap: 10 },  // G4
        { midi: 72, duration: 400, gap: 50 }   // C5 (longer)
      ]
      
      let currentTime = ctx.currentTime
      
      notes.forEach(note => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = midiToFreq(note.midi)
        oscillator.type = 'triangle'
        
        const noteDuration = note.duration / 1000
        
        gainNode.gain.setValueAtTime(0, currentTime)
        gainNode.gain.linearRampToValueAtTime(0.15, currentTime + 0.01)
        gainNode.gain.linearRampToValueAtTime(0.12, currentTime + noteDuration * 0.7)
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + noteDuration)
        
        oscillator.start(currentTime)
        oscillator.stop(currentTime + noteDuration)
        
        currentTime += (note.duration / 1000) + (note.gap / 1000)
      })
    } catch (e) {
      // Silently fail if audio context is not available
    }
  }

  function playTurnOverSound() {
    try {
      // Try to play audio file first (mp3 or wav)
      const audio = new Audio('/sounds/turnOver.mp3')
      audio.volume = 0.4
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/turnOver.wav')
        audioWav.volume = 0.4
        audioWav.play().catch(() => {
          // If both fail, silently continue (no synthesized fallback for turn-over)
        })
      })
    } catch (e) {
      // Silently fail
    }
  }

  function playBonusLetterSound() {
    try {
      const audio = new Audio('/sounds/bonusLetter.mp3')
      audio.volume = 0.6
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/bonusLetter.wav')
        audioWav.volume = 0.6
        audioWav.play().catch(() => {
          // Silently fail if both formats fail
        })
      })
    } catch (e) {
      // Silently fail
    }
  }

  // Multiplayer functions
  function connectToServer(serverUrl) {
    socket.value = io(serverUrl)
    
    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('Connected to server')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Disconnected from server')
    })
    
    socket.value.on('roomCreated', (id) => {
      roomId.value = id
      waitingForPlayer.value = true
      console.log('Room created:', id)
    })

    socket.value.on('roomJoined', (id) => {
      roomId.value = id
      waitingForPlayer.value = false
      console.log('Room joined:', id)
    })
    
    socket.value.on('playerJoined', () => {
      waitingForPlayer.value = false
      console.log('Player joined the room')
    })

    socket.value.on('gameState', (state) => {
      if (!isHost.value || isProcessingGuess.value) {
        updateFromGameState(state)
      }
    })
    
    socket.value.on('playerLeft', () => {
      alert('Other player disconnected')
      resetMultiplayer()
    })

    socket.value.on('joinError', (message) => {
      alert(message)
    })
  }

  function createRoom() {
    isMultiplayer.value = true
    isHost.value = true
    socket.value?.emit('createRoom')
  }

  function joinRoom(id) {
    isMultiplayer.value = true
    isHost.value = false
    socket.value?.emit('joinRoom', id)
  }

  function emitGameState() {
    if (!socket.value || !roomId.value) return
    
    const state = {
      player1: player1.value,
      player2: player2.value,
      activePlayer: activePlayer.value,
      targetWord: isHost.value ? targetWord.value : '',
      currentRow: currentRow.value,
      currentColumn: currentColumn.value,
      wordLength: wordLength.value,
      cells: cells.value,
      revealedPositions: Array.from(revealedPositions.value),
      timeRemaining: timeRemaining.value,
      isTimerActive: isTimerActive.value,
      showHintLetters: showHintLetters.value,
      gameStarted: gameStarted.value
    }
    
    socket.value.emit('updateGameState', { roomId: roomId.value, gameState: state })
  }

  function updateFromGameState(state) {
    player1.value = state.player1
    player2.value = state.player2
    activePlayer.value = state.activePlayer
    if (state.targetWord) targetWord.value = state.targetWord
    currentRow.value = state.currentRow
    currentColumn.value = state.currentColumn
    wordLength.value = state.wordLength
    cells.value = state.cells
    revealedPositions.value = new Set(state.revealedPositions)
    timeRemaining.value = state.timeRemaining
    isTimerActive.value = state.isTimerActive
    showHintLetters.value = state.showHintLetters
    gameStarted.value = state.gameStarted
  }

  function isMyTurn() {
    if (!isMultiplayer.value) return true
    if (isHost.value && activePlayer.value === 1) return true
    if (!isHost.value && activePlayer.value === 2) return true
    return false
  }

  function resetMultiplayer() {
    isMultiplayer.value = false
    isHost.value = false
    roomId.value = null
    waitingForPlayer.value = false
    socket.value?.disconnect()
    socket.value = null
  }

  return {
    // State
    player1,
    player2,
    activePlayer,
    cells,
    timeRemaining,
    currentRow,
    currentColumn,
    isTimerActive,
    wordLength,
    wordList,
    checkWordList,
    gameStarted,
    showGrid,
    showOverlay,
    overlayMessage,
    isMultiplayer,
    roomId,
    isConnected,
    waitingForPlayer,
    isHost,
    
    // Computed
    currentGuess,
    activePlayerName,
    
    // Actions
    initializeGrid,
    loadWords,
    startGame,
    startNewWord,
    addLetter,
    replaceLastLetter,
    deleteLetter,
    submitGuess,
    clearCurrentRow,
    switchPlayer,
    closeOverlay,
    connectToServer,
    createRoom,
    joinRoom,
    isMyTurn,
    resetMultiplayer,
    stopTimer,
    startTimer,
    retryInvalidWord
  }
})