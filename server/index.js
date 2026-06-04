const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  // Add your production URL after deploying to Vercel:
  // 'https://your-project.vercel.app'
]

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://lingo-eta-vert.vercel.app'
    ],
    methods: ['GET', 'POST']
  }
})

const rooms = new Map()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('createRoom', () => {
    const roomId = generateRoomId()
    rooms.set(roomId, {
      host: socket.id,
      guest: null,
      gameState: null
    })
    socket.join(roomId)
    socket.emit('roomCreated', roomId)
    console.log('Room created:', roomId)
  })

  socket.on('joinRoom', (data) => {
    // Handle both old format (string) and new format (object)
    const roomId = typeof data === 'string' ? data : data.roomId
    const playerName = typeof data === 'string' ? null : data.playerName
    
    const room = rooms.get(roomId)
    if (room && !room.guest) {
      room.guest = socket.id
      socket.join(roomId)
      socket.emit('roomJoined', roomId)
      // Send player name to host
      io.to(room.host).emit('playerJoined', { playerName })
      console.log('Player joined room:', roomId, 'with name:', playerName)
    } else {
      socket.emit('joinError', 'Kamer niet gevonden of vol')
    }
  })

  socket.on('updateGameState', ({ roomId, gameState }) => {
    const room = rooms.get(roomId)
    if (room) {
      room.gameState = gameState
      socket.to(roomId).emit('gameState', gameState)
    }
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    for (const [roomId, room] of rooms.entries()) {
      if (room.host === socket.id || room.guest === socket.id) {
        io.to(roomId).emit('playerLeft')
        rooms.delete(roomId)
      }
    }
  })
})

function generateRoomId() {
  // Generate 6-letter code (A-Z only, no numbers)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length))
  }
  return code
}

// Daily Challenge functionality
const DAILY_DATA_FILE = path.join(__dirname, 'daily-data.json')

// Seeded random number generator (for consistent daily words)
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

// Get date string in CET timezone
function getCETDateString() {
  const now = new Date()
  // Convert to CET (UTC+1 or UTC+2 during DST)
  const cetOffset = 1 // Base CET offset
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const cetTime = new Date(utc + (3600000 * cetOffset))
  return cetTime.toISOString().split('T')[0]
}

// Load or initialize daily data
function loadDailyData() {
  try {
    if (fs.existsSync(DAILY_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DAILY_DATA_FILE, 'utf8'))
      return data
    }
  } catch (error) {
    console.error('Error loading daily data:', error)
  }
  return { leaderboards: {}, completedPlayers: {}, startedPlayers: {} }
}

// Save daily data
function saveDailyData(data) {
  try {
    fs.writeFileSync(DAILY_DATA_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving daily data:', error)
  }
}

// Generate daily words for a specific date and word length
function generateDailyWords(dateString, wordLength, wordList) {
  const seed = parseInt(dateString.replace(/-/g, '')) + wordLength
  const filtered = wordList.filter(w => w.length === wordLength)
  
  if (filtered.length === 0) return []
  
  // Generate up to 20 words for the 5-minute challenge
  const wordsToGenerate = Math.min(20, filtered.length)
  const selectedWords = []
  const usedIndices = new Set()
  
  let currentSeed = seed
  while (selectedWords.length < wordsToGenerate && usedIndices.size < filtered.length) {
    const index = Math.floor(seededRandom(currentSeed) * filtered.length)
    if (!usedIndices.has(index)) {
      usedIndices.add(index)
      selectedWords.push(filtered[index])
    }
    currentSeed++
  }
  
  return selectedWords
}

// Load word list from file
function loadWordList() {
  try {
    const wordListPath = path.join(__dirname, '..', 'public', 'wordlists', 'words_small.txt')
    const content = fs.readFileSync(wordListPath, 'utf8')
    return content.split('\n')
      .map(w => w.trim().toUpperCase().replace(/IJ/g, '\u0178'))
      .filter(w => w.length > 0)
  } catch (error) {
    console.error('Error loading word list:', error)
    return []
  }
}

const wordList = loadWordList()

// API endpoint to get daily words
app.get('/api/daily/words/:wordLength', (req, res) => {
  const wordLength = parseInt(req.params.wordLength)
  const dateString = getCETDateString()
  const words = generateDailyWords(dateString, wordLength, wordList)
  
  res.json({
    date: dateString,
    wordLength,
    words
  })
})

// API endpoint to check if player has completed/started today's challenge
app.get('/api/daily/completed/:wordLength/:playerName', (req, res) => {
  const { wordLength, playerName } = req.params
  const dateString = getCETDateString()
  const dailyData = loadDailyData()
  
  const key = `${dateString}-${wordLength}-${playerName}`
  // Check both started and completed to prevent replays
  const started = (dailyData.startedPlayers && dailyData.startedPlayers[key]) || false
  const completed = (dailyData.completedPlayers && dailyData.completedPlayers[key]) || false
  
  res.json({ completed: started || completed })
})

// API endpoint to mark player as started (to prevent replays even on abort)
app.post('/api/daily/start', (req, res) => {
  const { playerName, wordLength } = req.body
  const dateString = getCETDateString()
  const dailyData = loadDailyData()
  
  const key = `${dateString}-${wordLength}-${playerName}`
  
  // Check if already started
  if (dailyData.startedPlayers && dailyData.startedPlayers[key]) {
    return res.status(400).json({ error: 'Already started today' })
  }
  
  // Mark as started
  if (!dailyData.startedPlayers) dailyData.startedPlayers = {}
  dailyData.startedPlayers[key] = true
  saveDailyData(dailyData)
  
  res.json({ success: true })
})

// API endpoint to submit score
app.post('/api/daily/submit', (req, res) => {
  const { playerName, wordLength, score, wordsGuessed } = req.body
  const dateString = getCETDateString()
  const dailyData = loadDailyData()
  
  // Check if already submitted a score
  const completionKey = `${dateString}-${wordLength}-${playerName}`
  if (dailyData.completedPlayers && dailyData.completedPlayers[completionKey]) {
    return res.status(400).json({ error: 'Already submitted score today' })
  }
  
  // Mark as completed
  if (!dailyData.completedPlayers) dailyData.completedPlayers = {}
  dailyData.completedPlayers[completionKey] = true
  
  // Add to leaderboard
  const leaderboardKey = `${dateString}-${wordLength}`
  if (!dailyData.leaderboards[leaderboardKey]) {
    dailyData.leaderboards[leaderboardKey] = []
  }
  
  dailyData.leaderboards[leaderboardKey].push({
    playerName,
    score,
    wordsGuessed,
    timestamp: new Date().toISOString()
  })
  
  // Sort by score (descending) and keep top 10
  dailyData.leaderboards[leaderboardKey].sort((a, b) => b.score - a.score)
  dailyData.leaderboards[leaderboardKey] = dailyData.leaderboards[leaderboardKey].slice(0, 10)
  
  saveDailyData(dailyData)
  
  res.json({ success: true })
})

// API endpoint to get leaderboard
app.get('/api/daily/leaderboard/:wordLength', (req, res) => {
  const wordLength = req.params.wordLength
  const dateString = getCETDateString()
  const dailyData = loadDailyData()
  
  const leaderboardKey = `${dateString}-${wordLength}`
  const leaderboard = dailyData.leaderboards[leaderboardKey] || []
  
  res.json({
    date: dateString,
    wordLength,
    leaderboard: leaderboard.slice(0, 5) // Return top 5
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})