const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)

// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI
let db = null
let dailyCollection = null

async function connectDB() {
  if (!MONGODB_URI) {
    console.log('No MONGODB_URI found, using file-based storage')
    return false
  }
  
  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    db = client.db('lingo')
    dailyCollection = db.collection('daily_data')
    console.log('Connected to MongoDB')
    return true
  } catch (error) {
    console.error('MongoDB connection error:', error)
    return false
  }
}

// Initialize DB connection
connectDB()

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

// Seed version - increment this to regenerate words for the same date
const SEED_VERSION = 2  // Changed from 1 to get new words for today

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

// Load or initialize daily data (MongoDB or file-based)
async function loadDailyData() {
  if (dailyCollection) {
    try {
      const data = await dailyCollection.findOne({ _id: 'daily_data' })
      return data || { leaderboards: {}, completedPlayers: {}, startedPlayers: {} }
    } catch (error) {
      console.error('Error loading from MongoDB:', error)
    }
  }
  
  // Fall back to file-based storage
  try {
    if (fs.existsSync(DAILY_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DAILY_DATA_FILE, 'utf8'))
      return data
    }
  } catch (error) {
    console.error('Error loading daily data from file:', error)
  }
  return { leaderboards: {}, completedPlayers: {}, startedPlayers: {} }
}

// Save daily data (MongoDB or file-based)
async function saveDailyData(data) {
  if (dailyCollection) {
    try {
      await dailyCollection.updateOne(
        { _id: 'daily_data' },
        { $set: data },
        { upsert: true }
      )
      return
    } catch (error) {
      console.error('Error saving to MongoDB:', error)
    }
  }
  
  // Fall back to file-based storage
  try {
    fs.writeFileSync(DAILY_DATA_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error saving daily data to file:', error)
  }
}

// Generate daily words for a specific date and word length
function generateDailyWords(dateString, wordLength, wordList) {
  const seed = (parseInt(dateString.replace(/-/g, '')) + wordLength) * SEED_VERSION
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
    // Use large prime multiplier and position to create truly random sequences
    currentSeed = seed * (selectedWords.length + 1) * 9973 + selectedWords.length
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
app.get('/api/daily/completed/:wordLength/:playerName', async (req, res) => {
  const { wordLength, playerName } = req.params
  const dateString = getCETDateString()
  const dailyData = await loadDailyData()
  
  const key = `${dateString}-${wordLength}-${playerName}`
  // Check both started and completed to prevent replays
  const started = (dailyData.startedPlayers && dailyData.startedPlayers[key]) || false
  const completed = (dailyData.completedPlayers && dailyData.completedPlayers[key]) || false
  
  res.json({ completed: started || completed })
})

// API endpoint to mark player as started (to prevent replays even on abort)
app.post('/api/daily/start', async (req, res) => {
  const { playerName, wordLength } = req.body
  const dateString = getCETDateString()
  const dailyData = await loadDailyData()
  
  const key = `${dateString}-${wordLength}-${playerName}`
  
  // Check if already started
  if (dailyData.startedPlayers && dailyData.startedPlayers[key]) {
    return res.status(400).json({ error: 'Already started today' })
  }
  
  // Mark as started
  if (!dailyData.startedPlayers) dailyData.startedPlayers = {}
  dailyData.startedPlayers[key] = true
  await saveDailyData(dailyData)
  
  res.json({ success: true })
})

// API endpoint to submit score
app.post('/api/daily/submit', async (req, res) => {
  const { playerName, wordLength, score, wordsGuessed } = req.body
  const dateString = getCETDateString()
  const dailyData = await loadDailyData()
  
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
  
  await saveDailyData(dailyData)
  
  res.json({ success: true })
})

// API endpoint to get leaderboard
app.get('/api/daily/leaderboard/:wordLength', async (req, res) => {
  const wordLength = req.params.wordLength
  const dateString = getCETDateString()
  const dailyData = await loadDailyData()
  
  const leaderboardKey = `${dateString}-${wordLength}`
  const leaderboard = dailyData.leaderboards[leaderboardKey] || []
  
  res.json({
    date: dateString,
    wordLength,
    leaderboard: leaderboard.slice(0, 5) // Return top 5
  })
})

// Get all daily data (for admin/debugging)
// API endpoint to get all daily data (for admin/debugging)
app.get('/api/daily/data', async (req, res) => {
  const dailyData = await loadDailyData()
  res.json(dailyData)
})

// Admin endpoint to clear today's data
app.post('/api/daily/clear-today', async (req, res) => {
  const { adminKey } = req.body
  
  // Simple admin key check (you can set this as environment variable)
  const ADMIN_KEY = process.env.DAILY_ADMIN_KEY || 'lingo-admin-2026'
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' })
  }
  
  const dateString = getCETDateString()
  const dailyData = await loadDailyData()
  
  // Clear all entries for today
  let clearedCount = 0
  
  // Clear startedPlayers for today
  if (dailyData.startedPlayers) {
    Object.keys(dailyData.startedPlayers).forEach(key => {
      if (key.startsWith(dateString)) {
        delete dailyData.startedPlayers[key]
        clearedCount++
      }
    })
  }
  
  // Clear completedPlayers for today
  if (dailyData.completedPlayers) {
    Object.keys(dailyData.completedPlayers).forEach(key => {
      if (key.startsWith(dateString)) {
        delete dailyData.completedPlayers[key]
        clearedCount++
      }
    })
  }
  
  // Clear leaderboards for today
  if (dailyData.leaderboards) {
    Object.keys(dailyData.leaderboards).forEach(key => {
      if (key.startsWith(dateString)) {
        delete dailyData.leaderboards[key]
        clearedCount++
      }
    })
  }
  
  await saveDailyData(dailyData)
  
  res.json({ 
    success: true, 
    message: `Cleared ${clearedCount} entries for ${dateString}`,
    date: dateString
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})