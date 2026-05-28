const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

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

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})