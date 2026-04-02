import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// In-memory database (replace with PostgreSQL in production)
interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignedAgent?: string
  createdAt: string
  updatedAt: string
  deadline?: string
}

let tasks: Task[] = []

// Task validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  deadline: z.string().optional()
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedAgent: z.string().optional(),
  deadline: z.string().optional()
})

// Agent assignment logic
const agents = ['laude', 'codex', 'clarity', 'sentinel', 'nexus']

function assignAgent(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): string {
  // Simple round-robin assignment
  const agentTasks = tasks.filter(t => t.assignedAgent)
  const agentCounts = agents.reduce((acc, agent) => {
    acc[agent] = agentTasks.filter(t => t.assignedAgent === agent).length
    return acc
  }, {} as Record<string, number>)

  // Find agent with least tasks
  const leastBusyAgent = agents.reduce((minAgent, agent) => {
    return agentCounts[agent] < agentCounts[minAgent] ? agent : minAgent
  })

  return leastBusyAgent
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/tasks', (req, res) => {
  res.json(tasks)
})

app.post('/api/tasks', (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body)
    
    const newTask: Task = {
      id: Date.now().toString(),
      ...validatedData,
      status: 'todo',
      assignedAgent: assignAgent({
        ...validatedData,
        status: 'todo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    tasks.push(newTask)
    
    // Broadcast to all connected clients
    io.emit('tasks-update', tasks)
    
    res.status(201).json(newTask)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid task data', details: error.errors })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

app.put('/api/tasks/:id', (req, res) => {
  try {
    const taskId = req.params.id
    const validatedData = updateTaskSchema.parse(req.body)
    
    const taskIndex = tasks.findIndex(t => t.id === taskId)
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...validatedData,
      updatedAt: new Date().toISOString()
    }

    // Broadcast to all connected clients
    io.emit('tasks-update', tasks)
    
    res.json(tasks[taskIndex])
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid task data', details: error.errors })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

app.delete('/api/tasks/:id', (req, res) => {
  const taskId = req.params.id
  const taskIndex = tasks.findIndex(t => t.id === taskId)
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' })
  }

  tasks.splice(taskIndex, 1)
  
  // Broadcast to all connected clients
  io.emit('tasks-update', tasks)
  
  res.status(204).send()
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  // Send current tasks to newly connected client
  socket.emit('tasks-update', tasks)
  
  socket.on('create-task', (taskData) => {
    try {
      const validatedData = createTaskSchema.parse(taskData)
      
      const newTask: Task = {
        id: Date.now().toString(),
        ...validatedData,
        status: 'todo',
        assignedAgent: assignAgent({
          ...validatedData,
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      tasks.push(newTask)
      
      // Broadcast to all clients
      io.emit('tasks-update', tasks)
      
      socket.emit('task-created', newTask)
    } catch (error) {
      socket.emit('error', { message: 'Invalid task data' })
    }
  })
  
  socket.on('move-task', (data: { taskId: string; newStatus: string; oldStatus: string }) => {
    const taskIndex = tasks.findIndex(t => t.id === data.taskId)
    
    if (taskIndex !== -1) {
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        status: data.newStatus as any,
        updatedAt: new Date().toISOString()
      }
      
      // Broadcast to all clients
      io.emit('tasks-update', tasks)
    }
  })
  
  socket.on('assign-agent', (data: { taskId: string; agentId: string }) => {
    const taskIndex = tasks.findIndex(t => t.id === data.taskId)
    
    if (taskIndex !== -1 && agents.includes(data.agentId)) {
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        assignedAgent: data.agentId,
        updatedAt: new Date().toISOString()
      }
      
      // Broadcast to all clients
      io.emit('tasks-update', tasks)
    }
  })
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Kanban Board Backend running on port ${PORT}`)
  console.log(`📊 Agent system ready with ${agents.length} agents`)
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
})