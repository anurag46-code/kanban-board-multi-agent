import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { io, Socket } from 'socket.io-client'
import { Plus, CheckCircle, Clock, AlertCircle, Users, Rocket } from 'lucide-react'
import { format } from 'date-fns'

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

interface Column {
  id: 'todo' | 'in-progress' | 'review' | 'done'
  title: string
  icon: React.ReactNode
  color: string
  tasks: Task[]
}

const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    icon: <Plus className="w-4 h-4" />,
    color: 'bg-blue-100 border-blue-300',
    tasks: []
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-yellow-100 border-yellow-300',
    tasks: []
  },
  {
    id: 'review',
    title: 'Review',
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'bg-orange-100 border-orange-300',
    tasks: []
  },
  {
    id: 'done',
    title: 'Done',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-green-100 border-green-300',
    tasks: []
  }
]

const agents = [
  { id: 'laude', name: '🎭 Laude', color: 'bg-amber-500' },
  { id: 'codex', name: '💻 Codex', color: 'bg-blue-500' },
  { id: 'clarity', name: '🎨 Clarity', color: 'bg-purple-500' },
  { id: 'sentinel', name: '🛡️ Sentinel', color: 'bg-red-500' },
  { id: 'nexus', name: '🔗 Nexus', color: 'bg-green-500' }
]

function App() {
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')

  useEffect(() => {
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001'
      : 'https://kanban-board-fawn-ten.vercel.app'
    
    const newSocket = io(socketUrl, {
      transports: ['websocket']
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
      console.log('Connected to server')
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Disconnected from server')
    })

    newSocket.on('tasks-update', (updatedTasks: Task[]) => {
      const updatedColumns = initialColumns.map(column => ({
        ...column,
        tasks: updatedTasks.filter(task => task.status === column.id)
      }))
      setColumns(updatedColumns)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result

    if (source.droppableId === destination.droppableId) return

    socket?.emit('move-task', {
      taskId: draggableId,
      newStatus: destination.droppableId,
      oldStatus: source.droppableId
    })
  }

  const addNewTask = () => {
    if (!newTaskTitle.trim()) return

    const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title: newTaskTitle,
      description: newTaskDescription,
      status: 'todo',
      priority: newTaskPriority
    }

    socket?.emit('create-task', newTask)

    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskPriority('medium')
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Rocket className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Multi-Agent Kanban</h1>
                <p className="text-sm text-gray-600">You add tasks, we pick them up automatically!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex -space-x-2">
                {agents.map(agent => (
                  <div key={agent.id} className={`w-8 h-8 rounded-full ${agent.color} border-2 border-white flex items-center justify-center text-white text-sm font-bold`}>
                    {agent.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Add Task Form */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Task</h2>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <textarea
                placeholder="Task description (optional)..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Priority:</span>
              <div className="flex space-x-2">
                {['low', 'medium', 'high'].map(priority => (
                  <button
                    key={priority}
                    onClick={() => setNewTaskPriority(priority as any)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      newTaskPriority === priority
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={addNewTask}
              disabled={!newTaskTitle.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add Task
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {columns.map(column => (
              <div key={column.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* Column Header */}
                <div className={`p-4 border-b ${column.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {column.icon}
                      <h3 className="font-semibold text-gray-900">{column.title}</h3>
                    </div>
                    <span className="bg-white px-2 py-1 rounded-full text-xs font-medium text-gray-700">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>

                {/* Task List */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] p-4 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      {column.tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg shadow-sm border p-3 mb-3 transition-transform ${
                                snapshot.isDragging ? 'rotate-3 shadow-lg' : 'hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-gray-900">{task.title}</h4>
                                <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`}></div>
                              </div>
                              {task.description && (
                                <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                              )}
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{format(new Date(task.createdAt), 'MMM d')}</span>
                                {task.assignedAgent && (
                                  <span className="flex items-center space-x-1">
                                    <Users className="w-3 h-3" />
                                    <span>{agents.find(a => a.id === task.assignedAgent)?.name}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}

export default App