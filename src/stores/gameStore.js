import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { LetterState } from '@/types/game'
import { io } from 'socket.io-client'

const MAX_ATTEMPTS = 5

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
  const soundEnabled = ref(true)  // Toggle for all sound effects
  
  // Custom timer durations (default: 14, 19, 24)
  const timerShort = ref(14)  // For words 5-7 letters
  const timerMedium = ref(19) // For words 8-9 letters
  const timerLong = ref(24)   // For words 10 letters
  
  // Helper function to get timer duration based on word length
  function getTimerDuration(wordLen) {
    if (wordLen <= 7) return timerShort.value
    if (wordLen <= 9) return timerMedium.value
    return timerLong.value
  }
  const wordList = ref([])
  const checkWordList = ref([])
  const gameStarted = ref(false)
  const showGrid = ref(false)
  const showOverlay = ref(false)
  const overlayMessage = ref('')
  const isProcessingGuess = ref(false)
  const guessedWords = ref(new Set())
  const turnSwitchCount = ref(0)  // Tracks number of turn switches in current round
  const roundStartPlayer = ref(1)
  const isVictoryMode = ref(false)
  const isAnimatingReveal = ref(false)
  const invalidWordData = ref(null)  // { word: string, type: 'invalid' | 'duplicate' | 'wrongFirstLetter' }
  const bypassNextValidation = ref(false)  // Flag to bypass dictionary check on next submit (for accepted invalid words)
  
  // Solo mode
  const isSoloMode = ref(false)
  const timerEnabled = ref(true)  // Whether timer is enabled in solo mode
  const soloGuessCount = ref(0)  // Track number of guesses in solo mode (max 5)
  
  // Daily challenge mode
  const isDailyMode = ref(false)
  const dailyWordsRemaining = ref([])
  const dailyWordsGuessed = ref(0)
  const dailyGuessCount = ref(0)  // Track number of guesses per word in daily mode (max 5, includes invalid)
  const dailyTimeLimit = ref(120)  // 2 minutes in seconds
  const dailyStartTime = ref(null)
  const isDailyComplete = ref(false)  // Track if daily challenge is finished
  const pendingDailyEnd = ref(false)  // Track if timer ended and we're waiting for guess to complete
  
  // Game mode tracking for return navigation
  const lastGameMode = ref('local')  // 'local', 'solo', 'daily', 'multiplayer'
  const lastWordLength = ref(6)  // Remember word length for daily mode
  
  // Multiplayer
  const socket = ref(null)
  const roomId = ref(null)
  const joinerName = ref(null) // Store joiner's name when they join
  const isMultiplayer = ref(false)
  const isHost = ref(false)
  const isConnected = ref(false)
  const waitingForPlayer = ref(false)
  const isReconnecting = ref(false)
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5
  let rejoinTimeout = null
  let serverUrl = null
  const targetScore = ref(500) // Target score for multiplayer games
  const gameWinner = ref(null) // Winner name when target score reached
  
  // Emoji reactions
  const receivedEmoji = ref(null) // Currently displayed emoji from opponent
  const emojiTimestamp = ref(0) // Timestamp for auto-hiding emoji

  // Load sound preference from localStorage
  try {
    const savedSound = localStorage.getItem('lingoSoundEnabled')
    if (savedSound !== null) {
      soundEnabled.value = JSON.parse(savedSound)
    }
  } catch (e) {
    console.error('Failed to load sound preference:', e)
  }

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

  // Computed property for current timer max duration
  const currentTimerDuration = computed(() => {
    return getTimerDuration(wordLength.value)
  })

  // Timer interval
  let timerInterval = null

  // Actions
  function initializeGrid() {
    // Create 7 rows to accommodate 5 initial attempts + 2 extra turns
    cells.value = Array(7).fill(null).map(() =>
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
    
    // In daily mode, check if we should end instead of starting new word
    if (isDailyMode.value && pendingDailyEnd.value) {
      endDailyChallenge(false)  // Don't reveal, word was already processed
      return
    }
    
    // In daily mode, pick from the daily words list
    if (isDailyMode.value) {
      if (dailyWordsRemaining.value.length === 0) {
        // No more words, end the challenge
        endDailyChallenge(false)
        return
      }
      targetWord.value = dailyWordsRemaining.value.shift()
    } else {
      const filteredWords = wordList.value.filter(w => w.length === wordLength.value)
      if (filteredWords.length === 0) return
      targetWord.value = filteredWords[Math.floor(Math.random() * filteredWords.length)]
    }
    
    currentRow.value = 0
    currentColumn.value = 0  // Start at position 0
    revealedPositions.value = new Set([0])
    guessedWords.value = new Set()  // Clear guessed words for new round
    turnSwitchCount.value = 0  // Reset turn switch counter
    bypassNextValidation.value = false  // Reset bypass flag
    roundStartPlayer.value = activePlayer.value
    isVictoryMode.value = false
    soloGuessCount.value = 0  // Reset solo guess counter
    dailyGuessCount.value = 0  // Reset daily guess counter
    
    initializeGrid()
    
    // Reveal first letter
    cells.value[0][0].letter = targetWord.value[0]
    cells.value[0][0].state = LetterState.Hint
    
    // Keep currentColumn at 0 - player must overwrite the hint
    
    showGrid.value = true
    
    // In daily mode, don't start the word timer (only the overall 2-minute timer runs)
    if (!isDailyMode.value) {
      startTimer()
    }

    if (isMultiplayer.value && isHost.value) {
      emitGameState()
    }
  }

  function startGame(settings) {
    player1.value.name = settings.player1Name
    // If we're multiplayer and have joiner's name (either as host or joiner), use it
    if (isMultiplayer.value && joinerName.value) {
      player2.value.name = joinerName.value
    } else {
      player2.value.name = settings.player2Name
    }
    player1.value.score = 0
    player2.value.score = 0
    wordLength.value = settings.wordLength
    showHintLetters.value = settings.showHintLetters
    
    // Set target score for multiplayer
    if (isMultiplayer.value && settings.targetScore) {
      targetScore.value = settings.targetScore
    }
    gameWinner.value = null
    
    // Track game mode and word length
    if (settings.isDailyMode) {
      lastGameMode.value = 'daily'
      lastWordLength.value = settings.wordLength
    } else if (settings.isSoloMode) {
      lastGameMode.value = 'solo'
    } else if (isMultiplayer.value) {
      lastGameMode.value = 'multiplayer'
    } else {
      lastGameMode.value = 'local'
    }
    
    // Solo mode settings
    isSoloMode.value = settings.isSoloMode || false
    timerEnabled.value = settings.timerEnabled !== undefined ? settings.timerEnabled : true
    
    // Daily mode settings
    isDailyMode.value = settings.isDailyMode || false
    isDailyComplete.value = false
    if (isDailyMode.value) {
      dailyWordsRemaining.value = [...(settings.dailyWords || [])]
      dailyWordsGuessed.value = 0
      dailyStartTime.value = Date.now()
      // Start the 2-minute countdown timer
      startDailyTimer()
    }
    
    // Apply custom timer duration if provided, otherwise use defaults
    if (settings.timerDuration !== undefined) {
      // Set all three timer values based on provided duration
      // User can customize, so we use their value for all word lengths
      const customDuration = settings.timerDuration
      if (wordLength.value <= 7) {
        timerShort.value = customDuration
      } else if (wordLength.value <= 9) {
        timerMedium.value = customDuration
      } else {
        timerLong.value = customDuration
      }
    }
    
    activePlayer.value = 1
    gameStarted.value = true
    showGrid.value = false
    
    // Play intro tune only if:
    // 1. Not in multiplayer mode, not solo mode, and not daily mode
    // 2. Sound is enabled
    // 3. User has enabled playIntroTune
    const shouldPlayIntro = !isMultiplayer.value && !isSoloMode.value && !isDailyMode.value && soundEnabled.value && settings.playIntroTune
    
    if (shouldPlayIntro) {
      playIntroTune()
      // Wait 19 seconds before showing grid and starting word
      setTimeout(() => {
        startNewWord()
      }, 19000)
    } else {
      startNewWord()
    }
    
    // Emit initial game state for multiplayer
    if (isMultiplayer.value && isHost.value) {
      emitGameState()
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
    
    // Check if we should bypass validation due to accepted invalid word
    if (bypassNextValidation.value) {
      bypassDictionaryCheck = true
      bypassNextValidation.value = false
    }
    
    // Check if word starts with the correct first letter (which is always revealed)
    if (!bypassDictionaryCheck && guess[0] !== targetWord.value[0]) {
      // In daily mode, auto-reject without dialog and count the guess
      if (isDailyMode.value) {
        dailyGuessCount.value++
        await markWordIncorrect()
        isProcessingGuess.value = false
        
        // Check if timer ended while processing
        if (pendingDailyEnd.value) {
          endDailyChallenge(true)  // Reveal word since it wasn't guessed
        }
        
        return 'incorrect'
      }
      // In solo mode and multiplayer: show dialog to allow contesting
      invalidWordData.value = { word: guess, type: 'wrongFirstLetter' }
      if (isMultiplayer.value) {
        emitGameState()
      }
      isProcessingGuess.value = false
      return 'wrongFirstLetter'
    }
    
    // Check if word has already been guessed in this round (unless bypassing)
    if (!bypassDictionaryCheck && guessedWords.value.has(guess)) {
      // In daily mode, auto-reject without dialog and count the guess
      if (isDailyMode.value) {
        dailyGuessCount.value++
        await markWordIncorrect()
        isProcessingGuess.value = false
        
        // Check if timer ended while processing
        if (pendingDailyEnd.value) {
          endDailyChallenge(true)  // Reveal word since it wasn't guessed
        }
        
        return 'incorrect'
      }
      // In solo mode and multiplayer: show dialog to allow contesting
      invalidWordData.value = { word: guess, type: 'duplicate' }
      if (isMultiplayer.value) {
        emitGameState()
      }
      isProcessingGuess.value = false
      return 'duplicate'
    }
    
    // Check if word exists in dictionary (unless bypassed)
    if (!bypassDictionaryCheck && !checkWordList.value.includes(guess)) {
      // In daily mode, auto-reject without dialog and count the guess
      if (isDailyMode.value) {
        dailyGuessCount.value++
        await markWordIncorrect()
        isProcessingGuess.value = false
        
        // Check if timer ended while processing
        if (pendingDailyEnd.value) {
          endDailyChallenge(true)  // Reveal word since it wasn't guessed
        }
        
        return 'incorrect'
      }
      // In solo mode and multiplayer: show dialog to allow contesting
      invalidWordData.value = { word: guess, type: 'invalid' }
      if (isMultiplayer.value) {
        emitGameState()
      }
      isProcessingGuess.value = false
      return 'invalid'
    }
    
    // Clear invalid word data since word is valid (or bypassed)
    invalidWordData.value = null
    
    // Add to guessed words only after validation passes or is bypassed
    guessedWords.value.add(guess)
    
    // Don't stop the daily timer on each guess
    if (!isDailyMode.value) {
      stopTimer()
    }
    
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
    
    // Check if this is a winning guess (before animating)
    const isWinningGuess = guess === targetWord.value
    
    // Apply states and play sounds with animation delay
    for (let i = 0; i < wordLength.value; i++) {
      row[i].state = finalStates[i]
      playLetterSound(finalStates[i])
      await sleep(250)
      
      // Emit state for multiplayer to sync letter reveal animation
      // But skip emissions for winning guesses to avoid rapid state updates
      if (isMultiplayer.value && !isWinningGuess) {
        emitGameState()
      }
    }
    
    // Add small delay after animation to prevent race condition with quick typing
    // This ensures the animation completes before accepting new input
    if (!isWinningGuess) {
      await sleep(100)
    }
    
    // Check if won
    if (isWinningGuess) {
      // Stop the timer immediately (but not in daily mode where the 2-minute timer keeps running)
      if (!isDailyMode.value) {
        stopTimer()
      }
      
      // Enable victory mode for animations
      isVictoryMode.value = true
      
      // Update score
      if (activePlayer.value === 1) {
        player1.value.score += 50
      } else {
        player2.value.score += 50
      }
      
      // Check if target score reached in multiplayer mode
      if (isMultiplayer.value && targetScore.value > 0) {
        if (player1.value.score >= targetScore.value) {
          gameWinner.value = player1.value.name
          stopTimer()
          isVictoryMode.value = true
          overlayMessage.value = `🏆 ${player1.value.name} heeft gewonnen! (${player1.value.score} punten)`
          playVictoryTune()
          setTimeout(() => {
            showOverlay.value = true
            if (isMultiplayer.value) {
              emitGameState()
            }
          }, 2000)
          isProcessingGuess.value = false
          return 'won'
        } else if (player2.value.score >= targetScore.value) {
          gameWinner.value = player2.value.name
          stopTimer()
          isVictoryMode.value = true
          overlayMessage.value = `🏆 ${player2.value.name} heeft gewonnen! (${player2.value.score} punten)`
          playVictoryTune()
          setTimeout(() => {
            showOverlay.value = true
            if (isMultiplayer.value) {
              emitGameState()
            }
          }, 2000)
          isProcessingGuess.value = false
          return 'won'
        }
      }
      
      // In daily mode, increment words guessed and continue to next word
      if (isDailyMode.value) {
        dailyWordsGuessed.value++
        
        // Play victory tune
        playVictoryTune()
        
        // Wait for animations then start next word or end if timer expired
        setTimeout(() => {
          isVictoryMode.value = false
          
          // Check if timer ended while processing this guess
          if (pendingDailyEnd.value) {
            endDailyChallenge(false)  // Don't reveal, word was guessed
          } else {
            startNewWord()
          }
        }, 1500)
        
        isProcessingGuess.value = false
        return 'won'
      }
      
      // In solo mode, always show player 1's name
      const winnerName = isSoloMode.value ? player1.value.name : activePlayerName.value
      overlayMessage.value = isSoloMode.value ? 'Woord geraden!' : `${winnerName} heeft het woord geraden!`
      
      // Emit state immediately for multiplayer sync (victory mode, stopped timer, updated score)
      if (isMultiplayer.value) {
        emitGameState()
      }
      
      // Play victory tune
      playVictoryTune()
      
      // Delay overlay to show victory animations first
      setTimeout(() => {
        showOverlay.value = true
        if (isMultiplayer.value) {
          emitGameState()
        }
      }, 2000)
      
      isProcessingGuess.value = false
      
      return 'won'
    }
    
    // Wrong guess - check row and turn switch count to determine action
    // In solo mode and daily mode, check guess count instead
    if (isSoloMode.value) {
      soloGuessCount.value++
      
      if (soloGuessCount.value >= 5) {
        // Max guesses reached in solo mode, reveal word
        await revealWord()
        isProcessingGuess.value = false
        return 'revealed'
      } else {
        // Continue to next row
        currentRow.value++
        currentColumn.value = 0
        copyHintsToNextRow()
        if (timerEnabled.value) {
          startTimer()
        }
        
        isProcessingGuess.value = false
        return 'continue'
      }
    }
    
    if (isDailyMode.value) {
      dailyGuessCount.value++
      
      if (dailyGuessCount.value >= 5) {
        // Max guesses reached in daily mode, reveal word and move to next
        await revealWord()
        
        // Start next word immediately (delays are built into revealWord)
        startNewWord()
        
        isProcessingGuess.value = false
        return 'revealed'
      } else {
        // Continue to next row
        currentRow.value++
        currentColumn.value = 0
        copyHintsToNextRow()
        
        isProcessingGuess.value = false
        
        // Check if timer ended while processing this guess
        if (pendingDailyEnd.value) {
          endDailyChallenge(true)  // Reveal word since it wasn't guessed
        }
        
        return 'continue'
      }
    }
    
    if (currentRow.value >= 4) {
      // Row 4+: Wrong word triggers turn switch
      if (turnSwitchCount.value >= 2) {
        // Already had 2 turn switches, reveal word
        // Make sure activePlayer is set to round starter before revealing
        activePlayer.value = roundStartPlayer.value
        await revealWord()
        isProcessingGuess.value = false
        return 'revealed'
      } else {
        // Switch players
        switchPlayer()
        isProcessingGuess.value = false
        return 'switched'
      }
    } else {
      // Rows 0-3: Move to next row and continue with same player
      currentRow.value++
      currentColumn.value = 0
      copyHintsToNextRow()
      if (!isDailyMode.value) {
        startTimer()
      }
      
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
        row[i] = {
          letter: targetWord.value[i],
          state: LetterState.Hint
        }
      } else {
        // Clear the cell
        row[i] = {
          letter: '',
          state: LetterState.Empty
        }
      }
    }
    currentColumn.value = 0
  }

  function switchPlayer() {
    stopTimer()
    
    // Increment turn switch counter
    turnSwitchCount.value++
    
    // Play turnover sounds (non-blocking)
    playTurnSwitchSound()
    playTurnOverSound()
    
    activePlayer.value = activePlayer.value === 1 ? 2 : 1
    
    // Move to next row
    currentRow.value++
    
    // Shift rows up if we're past the 5th row (index 4) to keep only 5 rows visible
    if (currentRow.value >= MAX_ATTEMPTS) {
      // Shift all 7 rows up by one, moving rows 1-6 into positions 0-5
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < wordLength.value; c++) {
          cells.value[r][c] = { ...cells.value[r + 1][c] }
        }
      }
      
      // Clear the last row (row 6)
      for (let c = 0; c < wordLength.value; c++) {
        cells.value[6][c] = {
          letter: '',
          state: LetterState.Empty
        }
      }
      
      // Stay on row 4 after shifting (the visible last row)
      currentRow.value = MAX_ATTEMPTS - 1
    }
    
    currentColumn.value = 0
    
    // Copy hints from previous row immediately
    copyHintsToNextRow()
    
    // Start timer immediately so new player can start typing
    startTimer()
    
    // Reveal bonus letter asynchronously without blocking
    sleep(1500).then(() => {
      if (showHintLetters.value) {
        revealBonusLetter()
      }
    })
    
    // Emit game state for multiplayer (final state after all changes)
    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  async function revealBonusLetter() {
    // Don't reveal bonus letters in solo mode
    if (isSoloMode.value) {
      return
    }
    
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
        
        // Emit state for multiplayer
        if (isMultiplayer.value) {
          emitGameState()
        }
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
    
    // Skip timer if disabled in solo mode
    if (isSoloMode.value && !timerEnabled.value) {
      isTimerActive.value = false
      return
    }
    
    isTimerActive.value = true
    timeRemaining.value = getTimerDuration(wordLength.value)
    
    // Only the host should run the timer interval in multiplayer mode
    // Non-host players receive timer updates via state sync
    if (isMultiplayer.value && !isHost.value) {
      return
    }
    
    timerInterval = setInterval(async () => {
      if (timeRemaining.value > 0) {
        timeRemaining.value--
        
        // Sync timer for multiplayer
        if (isMultiplayer.value) {
          emitGameState()
        }
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

  let dailyTimerInterval = null

  function startDailyTimer() {
    if (dailyTimerInterval) clearInterval(dailyTimerInterval)
    
    isTimerActive.value = true
    timeRemaining.value = dailyTimeLimit.value
    
    dailyTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - dailyStartTime.value) / 1000)
      timeRemaining.value = Math.max(0, dailyTimeLimit.value - elapsed)
      
      if (timeRemaining.value <= 0) {
        clearInterval(dailyTimerInterval)
        dailyTimerInterval = null
        handleDailyTimerEnd()
      }
    }, 1000)
  }

  function handleDailyTimerEnd() {
    // If a guess is currently being processed, wait for it to complete
    if (isProcessingGuess.value) {
      pendingDailyEnd.value = true
      return
    }
    
    // Check if all letters are filled (treat as submitted guess)
    const row = cells.value[currentRow.value]
    const allFilled = row.every(cell => cell.letter !== '')
    
    if (allFilled && currentGuess.value.length === wordLength.value) {
      // Submit the guess, then end
      pendingDailyEnd.value = true
      submitGuess()
    } else {
      // End immediately and reveal the current word
      endDailyChallenge(true)
    }
  }

  async function endDailyChallenge(revealCurrentWord = false) {
    stopTimer()
    if (dailyTimerInterval) {
      clearInterval(dailyTimerInterval)
      dailyTimerInterval = null
    }
    isTimerActive.value = false
    isDailyComplete.value = true
    pendingDailyEnd.value = false
    
    // Award partial points for the final word if time ran out
    if (revealCurrentWord && targetWord.value && currentRow.value < MAX_ATTEMPTS) {
      const targetLetters = targetWord.value.split('')
      let partialScore = 0
      
      // Track how many times each letter was awarded 5 points in first loop
      const letterCorrectCounts = new Map()
      
      // First loop: Award 5 points for each target position found at correct position
      for (let targetPos = 1; targetPos < wordLength.value; targetPos++) {
        const targetLetter = targetLetters[targetPos]
        
        // Check if any guess has this letter at this exact position
        let foundCorrect = false
        for (let row = 0; row <= currentRow.value; row++) {
          const cellLetter = cells.value[row][targetPos].letter
          if (cellLetter === targetLetter) {
            foundCorrect = true
            break
          }
        }
        
        if (foundCorrect) {
          partialScore += 5
          letterCorrectCounts.set(targetLetter, (letterCorrectCounts.get(targetLetter) || 0) + 1)
        }
      }
      
      // Calculate max count of each letter across all guesses
      const maxLetterCounts = new Map()
      for (let row = 0; row <= currentRow.value; row++) {
        const letterCounts = new Map()
        for (let col = 0; col < wordLength.value; col++) {
          const letter = cells.value[row][col].letter
          if (letter) {
            letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1)
          }
        }
        // Update max counts
        for (const [letter, count] of letterCounts) {
          maxLetterCounts.set(letter, Math.max(maxLetterCounts.get(letter) || 0, count))
        }
      }
      
      // Track how many times we've processed each letter in second loop
      const letterWrongPosCounts = new Map()
      
      // Second loop: Award 2 points for wrong positions (only if player had enough of this letter)
      for (let targetPos = 1; targetPos < wordLength.value; targetPos++) {
        const targetLetter = targetLetters[targetPos]
        const correctCount = letterCorrectCounts.get(targetLetter) || 0
        const wrongPosCount = letterWrongPosCounts.get(targetLetter) || 0
        const requiredCount = correctCount + wrongPosCount + 1 // +1 for this iteration
        
        // Check if player had at least requiredCount of this letter in any guess
        const maxCount = maxLetterCounts.get(targetLetter) || 0
        if (maxCount >= requiredCount) {
          // Check if this position was already awarded in first loop
          let foundCorrect = false
          for (let row = 0; row <= currentRow.value; row++) {
            const cellLetter = cells.value[row][targetPos].letter
            if (cellLetter === targetLetter) {
              foundCorrect = true
              break
            }
          }
          
          if (!foundCorrect) {
            // Check if any guess has this letter at a different position
            let foundWrongPos = false
            for (let row = 0; row <= currentRow.value; row++) {
              for (let col = 0; col < wordLength.value; col++) {
                const cellLetter = cells.value[row][col].letter
                if (cellLetter === targetLetter && col !== targetPos) {
                  foundWrongPos = true
                  break
                }
              }
              if (foundWrongPos) break
            }
            
            if (foundWrongPos) {
              partialScore += 2
              letterWrongPosCounts.set(targetLetter, wrongPosCount + 1)
            }
          }
        }
      }
      
      // Add partial score to player
      if (partialScore > 0) {
        player1.value.score += partialScore
      }
    }
    
    const score = player1.value.score
    const wordsGuessed = dailyWordsGuessed.value
    
    // Reveal word if requested and word exists
    if (revealCurrentWord && targetWord.value) {
      await revealWord()
    }
    
    const wordText = wordsGuessed === 1 ? 'woord' : 'woorden'
    overlayMessage.value = `Tijd voorbij! Score: ${score} (${wordsGuessed} ${wordText} geraden)`
    showOverlay.value = true
    
    // Emit completion event with score
    if (window.dailyChallenge) {
      window.dailyChallenge.onComplete(score, wordsGuessed)
    }
  }

  async function submitDailyScore() {
    // Submit current daily challenge score
    if (isDailyMode.value && !isDailyComplete.value && window.dailyChallenge) {
      const score = player1.value.score
      const wordsGuessed = dailyWordsGuessed.value
      console.log('Submitting daily score on early quit:', score, wordsGuessed)
      await window.dailyChallenge.onComplete(score, wordsGuessed)
      isDailyComplete.value = true  // Mark as complete to avoid double submission
    }
  }

  function closeOverlay() {
    showOverlay.value = false
    
    // Emit state for multiplayer to sync overlay closing
    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  function retryInvalidWord() {
    stopTimer()
    
    // Clear invalid word data
    invalidWordData.value = null
    
    // Check if we've already had 2 turn switches
    if (turnSwitchCount.value >= 2) {
      // Reveal word instead of switching again
      revealWord()
      return
    }
    
    // Increment turn switch counter
    turnSwitchCount.value++
    
    // Clear the current row (restores hints)
    clearCurrentRow()
    
    // Play turnover sound (non-blocking)
    playTurnSwitchSound()
    playTurnOverSound()
    
    // Switch to the other player
    activePlayer.value = activePlayer.value === 1 ? 2 : 1
    
    // DON'T increment currentRow - stay on the same row for retry
    // currentColumn is already reset by clearCurrentRow()
    
    // Start timer immediately so new player can start typing
    startTimer()
    
    // Reveal bonus letter asynchronously without blocking
    sleep(1500).then(() => {
      if (showHintLetters.value) {
        revealBonusLetter()
      }
    })
    
    // Emit game state for multiplayer
    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  async function retryAfterTimeout() {
    stopTimer()
    
    // In solo mode, treat timeout as an invalid guess
    if (isSoloMode.value) {
      soloGuessCount.value++
      await markWordIncorrect()
      return
    }
    
    // Check if we've already had 2 turn switches
    if (turnSwitchCount.value >= 2) {
      // Reveal word instead of switching again
      // Make sure activePlayer is set to round starter before revealing
      activePlayer.value = roundStartPlayer.value
      await revealWord()
      return
    }
    
    // Increment turn switch counter
    turnSwitchCount.value++
    
    // Clear the current row (restores hints)
    clearCurrentRow()
    
    // Play buzzer sound (non-blocking)
    playTimeoutBuzzer()
    
    // Switch to the other player
    activePlayer.value = activePlayer.value === 1 ? 2 : 1
    
    // DON'T increment currentRow - stay on the same row for retry
    // currentColumn is already reset by clearCurrentRow()
    
    // Start timer immediately so new player can start typing
    startTimer()
    
    // Reveal bonus letter asynchronously without blocking
    sleep(1000).then(() => {
      if (showHintLetters.value) {
        revealBonusLetter()
      }
    })
    
    // Emit game state for multiplayer
    if (isMultiplayer.value) {
      emitGameState()
    }
  }

  async function markWordIncorrect() {
    // Mark all letters in current row as incorrect
    const row = cells.value[currentRow.value]
    for (let i = 0; i < wordLength.value; i++) {
      row[i].state = LetterState.Incorrect
      playLetterSound(LetterState.Incorrect)
      await sleep(100)
    }
    
    // Wait a bit, then check if we can continue
    await sleep(500)
    
    // In solo mode, check guess count (already incremented before calling this function)
    if (isSoloMode.value) {
      if (soloGuessCount.value >= 5) {
        // Max guesses reached, reveal word
        await revealWord()
      } else {
        // Continue to next row
        currentRow.value++
        currentColumn.value = 0
        copyHintsToNextRow()
        if (timerEnabled.value) {
          startTimer()
        }
      }
    } else if (isDailyMode.value) {
      // In daily mode, check guess count (already incremented before calling this function)
      if (dailyGuessCount.value >= 5) {
        // Max guesses reached, reveal word and move to next
        await revealWord()
        startNewWord()
      } else {
        // Continue to next row
        currentRow.value++
        currentColumn.value = 0
        copyHintsToNextRow()
      }
    } else {
      // Non-daily/solo mode: check if we have more rows available
      if (currentRow.value < 4) {
        currentRow.value++
        currentColumn.value = 0
        copyHintsToNextRow()
      }
    }
  }

  async function revealWord() {
    stopTimer()
    
    // Set animation flag
    isAnimatingReveal.value = true
    
    // Play reveal answer sound (duration ~750ms)
    playRevealAnswerSound()
    
    // Check if there's an empty row available (first 5 visible rows)
    let revealRowIndex = -1
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const rowIsEmpty = cells.value[r].every(cell => cell.letter === '' || cell.state === LetterState.Hint)
      if (rowIsEmpty) {
        revealRowIndex = r
        break
      }
    }
    
    // If no empty row available, shift rows up and use the last visible row
    if (revealRowIndex === -1) {
      // Shift all rows up immediately (animation runs for 750ms to sync with sound)
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < wordLength.value; c++) {
          cells.value[r][c] = { ...cells.value[r + 1][c] }
        }
      }
      
      // Clear the last row (row 6) completely and use row 4 for reveal
      revealRowIndex = MAX_ATTEMPTS - 1
      const row = cells.value[revealRowIndex]
      for (let i = 0; i < wordLength.value; i++) {
        row[i] = {
          letter: '',
          state: LetterState.Empty
        }
      }
    } else {
      // Empty row found, clear it for reveal
      const row = cells.value[revealRowIndex]
      for (let i = 0; i < wordLength.value; i++) {
        row[i] = {
          letter: '',
          state: LetterState.Empty
        }
      }
    }
    
    currentRow.value = revealRowIndex
    currentColumn.value = 0
    
    // Emit state for multiplayer
    if (isMultiplayer.value) {
      emitGameState()
    }
    
    // Wait for animation to complete (750ms) - skip if sound off and not multiplayer
    const animationTime = (soundEnabled.value || isMultiplayer.value) ? 750 : 0
    await sleep(animationTime)
    
    // Clear animation flag
    isAnimatingReveal.value = false
    
    // Small delay to show blank row - skip if sound off and not multiplayer
    const blankRowDelay = (soundEnabled.value || isMultiplayer.value) ? 250 : 0
    await sleep(blankRowDelay)
    
    // Reveal letters one by one with letter and green animation simultaneously
    const row = cells.value[revealRowIndex]
    for (let i = 0; i < wordLength.value; i++) {
      row[i] = {
        letter: targetWord.value[i],
        state: LetterState.Correct
      }
      playLetterSound(LetterState.Correct)
      await sleep(250)
      
      // Emit state for multiplayer to see each letter appear
      if (isMultiplayer.value) {
        emitGameState()
      }
    }
    
    // Wait a bit then show message (no victory tune)
    // Use shorter delay for solo/daily mode to continue faster
    const postRevealDelay = (isSoloMode.value || isDailyMode.value) ? 300 : 1000
    await sleep(postRevealDelay)
    
    // Set active player back to round start player for next word
    activePlayer.value = roundStartPlayer.value
    
    // In daily mode, don't show overlay - just continue to next word
    if (!isDailyMode.value) {
      const failureMessage = isSoloMode.value
        ? `Woord niet geraden. Het woord was: ${targetWord.value.replace(/\u0178/g, 'IJ')}`
        : `Niemand heeft het woord geraden. Het woord was: ${targetWord.value.replace(/\u0178/g, 'IJ')}`
      overlayMessage.value = failureMessage
      showOverlay.value = true
      
      // Emit state for multiplayer
      if (isMultiplayer.value) {
        emitGameState()
      }
    }
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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
    if (!soundEnabled.value) return
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

  function playRevealAnswerSound() {
    if (!soundEnabled.value) return
    try {
      const audio = new Audio('/sounds/revealAnswer.mp3')
      audio.volume = 0.6
      audio.play().catch(() => {
        // If mp3 fails, try wav
        const audioWav = new Audio('/sounds/revealAnswer.wav')
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
  function connectToServer(url) {
    serverUrl = url
    socket.value = io(url)
    
    socket.value.on('connect', () => {
      isConnected.value = true
      reconnectAttempts = 0
      console.log('Connected to server')
      
      // If we were reconnecting and have a room, try to rejoin
      if (isReconnecting.value && roomId.value) {
        attemptRejoinRoom()
      }
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Disconnected from server')
      
      // If we're in a multiplayer game, attempt to reconnect
      if (isMultiplayer.value && roomId.value && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        isReconnecting.value = true
      }
    })
    
    // Note: roomCreated and roomJoined events are now handled
    // in the createRoom() and joinRoom() functions with promises
    
    socket.value.on('playerJoined', (data) => {
      waitingForPlayer.value = false
      // Store the joiner's name if provided
      if (data && data.playerName) {
        joinerName.value = data.playerName
      }
      console.log('Player joined the room with name:', data?.playerName)
    })

    socket.value.on('gameState', (state) => {
      // Always update from received state to keep both players in sync
      // Don't update if we're currently processing a guess to avoid conflicts
      if (!isProcessingGuess.value) {
        updateFromGameState(state)
        // If we were reconnecting and received game state, reconnection was successful
        if (isReconnecting.value) {
          isReconnecting.value = false
          if (rejoinTimeout) {
            clearTimeout(rejoinTimeout)
            rejoinTimeout = null
          }
          console.log('Successfully reconnected and synced game state')
        }
      }
    })
    
    socket.value.on('playerLeft', () => {
      alert('Andere speler heeft de verbinding verbroken')
      resetMultiplayer()
    })

    socket.value.on('joinError', (message) => {
      // Only handle reconnection errors here
      // Regular join errors are handled in the joinRoom() promise
      if (isReconnecting.value) {
        isReconnecting.value = false
        console.log('Reconnection failed:', message)
        // If we were trying to reconnect, inform the user
        if (reconnectAttempts > 0) {
          alert('Kan niet opnieuw verbinden met de kamer. De kamer bestaat mogelijk niet meer.')
          resetMultiplayer()
        }
      }
      // Don't alert for regular join errors - those are handled by joinRoom() promise
    })
    
    // Emoji reactions
    socket.value.on('emojiReceived', (emoji) => {
      console.log('Emoji received from opponent:', emoji)
      receivedEmoji.value = emoji
      emojiTimestamp.value = Date.now()
      // Auto-hide after 3 seconds
      setTimeout(() => {
        if (Date.now() - emojiTimestamp.value >= 2900) {
          receivedEmoji.value = null
        }
      }, 3000)
    })
  }
  
  async function attemptRejoinRoom() {
    if (!roomId.value || !socket.value || !isConnected.value) {
      isReconnecting.value = false
      return
    }
    
    console.log('Attempting to rejoin room:', roomId.value)
    reconnectAttempts++
    
    // Set a timeout to clear reconnecting state if rejoin doesn't work
    rejoinTimeout = setTimeout(() => {
      if (isReconnecting.value) {
        console.log('Rejoin timeout - clearing reconnecting state')
        isReconnecting.value = false
        // If we're still not in a game after timeout, reset
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          alert('Kan geen verbinding maken met de kamer. De sessie is mogelijk verlopen.')
          resetMultiplayer()
        }
      }
    }, 5000) // 5 second timeout for rejoin attempt
    
    // Try to rejoin the room
    const playerName = isHost.value ? player1.value.name : (joinerName.value || player2.value.name)
    socket.value.emit('joinRoom', { roomId: roomId.value, playerName })
    
    // If we're the host, re-emit the current game state
    if (isHost.value && gameStarted.value) {
      setTimeout(() => {
        if (isConnected.value) {
          emitGameState()
        }
      }, 500)
    }
  }
  
  async function reconnectSocket() {
    if (!serverUrl || !isMultiplayer.value || !roomId.value) return
    
    isReconnecting.value = true
    
    // Close existing socket if any
    if (socket.value) {
      socket.value.close()
    }
    
    // Reconnect
    connectToServer(serverUrl)
  }

  async function createRoom() {
    isMultiplayer.value = true
    isHost.value = true
    
    // Wait for socket connection if not connected yet
    if (!socket.value || !isConnected.value) {
      console.log('Waiting for socket connection...')
      // Wait up to 5 seconds for connection
      for (let i = 0; i < 50; i++) {
        await sleep(100)
        if (socket.value && isConnected.value) {
          break
        }
      }
    }
    
    if (!socket.value || !isConnected.value) {
      console.error('Socket not connected')
      alert('Kan geen verbinding maken met de server. Controleer je internetverbinding en probeer het opnieuw.')
      resetMultiplayer()
      return
    }
    
    // Create a promise that resolves when roomCreated event is received
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('Room creation timeout - retrying...')
        // Retry once
        socket.value.emit('createRoom')
        
        // Set a second timeout for the retry
        const retryTimeout = setTimeout(() => {
          console.error('Room creation failed after retry')
          reject(new Error('Room creation timeout'))
        }, 5000)
        
        // Listen for the retry response
        const retryHandler = (id) => {
          clearTimeout(retryTimeout)
          socket.value.off('roomCreated', retryHandler)
          roomId.value = id
          waitingForPlayer.value = true
          isReconnecting.value = false
          console.log('Room created (after retry):', id)
          resolve()
        }
        socket.value.once('roomCreated', retryHandler)
      }, 5000)
      
      // Set up one-time listener for the room creation response
      const handler = (id) => {
        clearTimeout(timeout)
        roomId.value = id
        waitingForPlayer.value = true
        isReconnecting.value = false
        console.log('Room created:', id)
        resolve()
      }
      
      socket.value.once('roomCreated', handler)
      socket.value.emit('createRoom')
    }).catch((error) => {
      console.error('Failed to create room:', error)
      alert('Kon geen kamer aanmaken. Probeer het opnieuw.')
      resetMultiplayer()
    })
  }

  async function joinRoom(id, playerName = null) {
    isMultiplayer.value = true
    isHost.value = false
    
    // Store joiner's name if provided
    if (playerName) {
      joinerName.value = playerName
    }
    
    // Wait for socket connection if not connected yet
    if (!socket.value || !isConnected.value) {
      console.log('Waiting for socket connection...')
      // Wait up to 5 seconds for connection
      for (let i = 0; i < 50; i++) {
        await sleep(100)
        if (socket.value && isConnected.value) {
          break
        }
      }
    }
    
    if (!socket.value || !isConnected.value) {
      console.error('Socket not connected')
      alert('Kan geen verbinding maken met de server. Controleer je internetverbinding en probeer het opnieuw.')
      resetMultiplayer()
      return
    }
    
    // Create a promise that resolves when roomJoined event is received
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('Room join timeout - retrying...')
        // Retry once
        socket.value.emit('joinRoom', { roomId: id, playerName: playerName || 'Speler 2' })
        
        // Set a second timeout for the retry
        const retryTimeout = setTimeout(() => {
          console.error('Room join failed after retry')
          reject(new Error('Room join timeout'))
        }, 5000)
        
        // Listen for the retry response
        const retryHandler = (joinedId) => {
          clearTimeout(retryTimeout)
          socket.value.off('roomJoined', retryHandler)
          socket.value.off('joinError', errorHandler)
          roomId.value = joinedId
          waitingForPlayer.value = false
          isReconnecting.value = false
          console.log('Room joined (after retry):', joinedId)
          resolve()
        }
        socket.value.once('roomJoined', retryHandler)
      }, 5000)
      
      // Handle join errors
      const errorHandler = (message) => {
        clearTimeout(timeout)
        socket.value.off('roomJoined', successHandler)
        console.error('Join error:', message)
        reject(new Error(message))
      }
      
      // Set up one-time listener for the room join response
      const successHandler = (joinedId) => {
        clearTimeout(timeout)
        socket.value.off('joinError', errorHandler)
        roomId.value = joinedId
        waitingForPlayer.value = false
        isReconnecting.value = false
        console.log('Room joined:', joinedId)
        resolve()
      }
      
      socket.value.once('roomJoined', successHandler)
      socket.value.once('joinError', errorHandler)
      socket.value.emit('joinRoom', { roomId: id, playerName: playerName || 'Speler 2' })
    }).catch((error) => {
      console.error('Failed to join room:', error)
      alert(`Kon niet deelnemen aan kamer: ${error.message}`)
      resetMultiplayer()
    })
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
      gameStarted: gameStarted.value,
      showGrid: showGrid.value,
      showOverlay: showOverlay.value,
      overlayMessage: overlayMessage.value,
      turnSwitchCount: turnSwitchCount.value,
      roundStartPlayer: roundStartPlayer.value,
      isVictoryMode: isVictoryMode.value,
      isAnimatingReveal: isAnimatingReveal.value,
      invalidWordData: invalidWordData.value,
      bypassNextValidation: bypassNextValidation.value,
      guessedWords: Array.from(guessedWords.value),
      timerShort: timerShort.value,
      timerMedium: timerMedium.value,
      timerLong: timerLong.value
    }
    
    socket.value.emit('updateGameState', { roomId: roomId.value, gameState: state })
  }

  function updateFromGameState(state) {
    player1.value = state.player1
    player2.value = state.player2
    activePlayer.value = state.activePlayer
    if (state.targetWord) targetWord.value = state.targetWord
    currentRow.value = state.currentRow
    wordLength.value = state.wordLength
    revealedPositions.value = new Set(state.revealedPositions)
    timeRemaining.value = state.timeRemaining
    isTimerActive.value = state.isTimerActive
    showHintLetters.value = state.showHintLetters
    gameStarted.value = state.gameStarted
    showGrid.value = state.showGrid || gameStarted.value
    
    // Update timer settings if provided
    if (state.timerShort !== undefined) timerShort.value = state.timerShort
    if (state.timerMedium !== undefined) timerMedium.value = state.timerMedium
    if (state.timerLong !== undefined) timerLong.value = state.timerLong
    
    // Only skip cell/column updates if it's our turn AND we've started typing (prevents overwriting while typing)
    // Check the INCOMING state's currentColumn, not our local one
    const incomingColumnEmpty = state.currentColumn === 0
    const shouldUpdateCells = !isMyTurn() || incomingColumnEmpty
    
    if (shouldUpdateCells) {
      currentColumn.value = state.currentColumn
      cells.value = state.cells
    }
    
    // Sync overlay state
    if (state.showOverlay !== undefined) {
      showOverlay.value = state.showOverlay
      overlayMessage.value = state.overlayMessage || ''
    }
    
    // Sync additional game state
    if (state.turnSwitchCount !== undefined) turnSwitchCount.value = state.turnSwitchCount
    if (state.roundStartPlayer !== undefined) roundStartPlayer.value = state.roundStartPlayer
    if (state.isVictoryMode !== undefined) isVictoryMode.value = state.isVictoryMode
    if (state.isAnimatingReveal !== undefined) isAnimatingReveal.value = state.isAnimatingReveal
    if (state.invalidWordData !== undefined) invalidWordData.value = state.invalidWordData
    if (state.bypassNextValidation !== undefined) bypassNextValidation.value = state.bypassNextValidation
    if (state.guessedWords) guessedWords.value = new Set(state.guessedWords)
  }

  function isMyTurn() {
    if (!isMultiplayer.value) return true
    if (isHost.value && activePlayer.value === 1) return true
    if (!isHost.value && activePlayer.value === 2) return true
    return false
  }

  function sendEmoji(emoji) {
    if (!isMultiplayer.value || !socket.value || !isConnected.value || !roomId.value) return
    
    console.log('Sending emoji to opponent:', emoji, 'in room:', roomId.value)
    
    // Send to opponent
    socket.value.emit('sendEmoji', {
      roomId: roomId.value,
      emoji: emoji
    })
    
    // Also display locally for sender
    receivedEmoji.value = emoji
    emojiTimestamp.value = Date.now()
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (Date.now() - emojiTimestamp.value >= 2900) {
        receivedEmoji.value = null
      }
    }, 3000)
  }

  function resetMultiplayer() {
    isMultiplayer.value = false
    isHost.value = false
    roomId.value = null
    waitingForPlayer.value = false
    joinerName.value = null
    isReconnecting.value = false
    reconnectAttempts = 0
    gameWinner.value = null
    targetScore.value = 500
    receivedEmoji.value = null
    // Clear rejoin timeout if it exists
    if (rejoinTimeout) {
      clearTimeout(rejoinTimeout)
      rejoinTimeout = null
    }
    socket.value?.disconnect()
    socket.value = null
  }

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value
    // Save to localStorage
    try {
      localStorage.setItem('lingoSoundEnabled', JSON.stringify(soundEnabled.value))
    } catch (e) {
      console.error('Failed to save sound preference:', e)
    }
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
    isVictoryMode,
    isAnimatingReveal,
    invalidWordData,
    bypassNextValidation,
    soundEnabled,
    turnSwitchCount,
    isReconnecting,
    isSoloMode,
    timerEnabled,
    soloGuessCount,
    isDailyMode,
    dailyWordsRemaining,
    dailyWordsGuessed,
    dailyGuessCount,
    dailyTimeLimit,
    isDailyComplete,
    lastGameMode,
    lastWordLength,
    
    // Computed
    currentGuess,
    activePlayerName,
    currentTimerDuration,
    
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
    retryInvalidWord,
    markWordIncorrect,
    toggleSound,
    emitGameState,
    reconnectSocket,
    sendEmoji,
    targetScore,
    gameWinner,
    receivedEmoji,
    submitDailyScore,
    isDailyMode,
    isDailyComplete
  }
})