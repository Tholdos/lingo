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

  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId)
    if (room && !room.guest) {
      room.guest = socket.id
      socket.join(roomId)
      socket.emit('roomJoined', roomId)
      io.to(roomId).emit('playerJoined')
      console.log('Player joined room:', roomId)
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
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})