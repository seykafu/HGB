import { useState, useEffect, useRef } from 'react'
import { Card } from '../ui/components/Card'
import { Button } from '../ui/components/Button'
import { Textarea } from '../ui/components/Input'
import { Bubble } from '../ui/components/Bubble'
import { MessageContent } from '../ui/components/MessageContent'
import { Mascot } from '../ui/mascot/Mascot'
import { orchestrate } from '../agents/orchestrator'
import { readStream } from '../lib/stream'
import type { ChatMessage } from '../lib/openai'
import { PhaserGameRuntime } from '../game/engine/phaserRuntime'
import { DialogueUI } from '../game/narrative/ui'
import { DialogueRunner } from '../game/narrative/runner'
import type { DialogueGraph } from '../game/narrative/types'
import { saveFiles, getGame, loadFiles } from '../services/projects'
import { exportGame } from '../services/export'
import { FileTree } from '../components/FileTree'
import { get, set } from '../lib/storage'
const TypingAnimation = () => {
  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"></div>
      <div
        className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"
        style={{ animationDelay: '0.2s' }}
      ></div>
      <div
        className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"
        style={{ animationDelay: '0.4s' }}
      ></div>
    </div>
  )
}

interface PlaygroundProps {
  gameId: string | null
  initialPrompt?: string
  onBack: () => void
}

export const Playground = ({ gameId, initialPrompt, onBack }: PlaygroundProps) => {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [phaserContainer, setPhaserContainer] = useState<HTMLDivElement | null>(null)
  const [gameRuntime, setGameRuntime] = useState<PhaserGameRuntime | null>(null)
  const [dialogueRunner, setDialogueRunner] = useState<DialogueRunner | null>(null)
  const [projectName, setProjectName] = useState('Untitled Game')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)
  const [fileTreeRefresh, setFileTreeRefresh] = useState(0)
  const [gameStructure, setGameStructure] = useState<{ type?: string; description?: string; scenes?: string[] } | null>(null)
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ type: string; name: string; url: string; path: string }>>([])
  const [isUploading, setIsUploading] = useState(false)
  const [keptAssets, setKeptAssets] = useState<Set<string>>(new Set()) // Track which assets are marked as "keep"
  const [existingAssets, setExistingAssets] = useState<Array<{ path: string; url: string; name: string }>>([]) // Assets loaded from file tree
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLDivElement>(null)
  const initialPromptSentRef = useRef(false)

  // Resizable panel state
  const [fileTreeWidth, setFileTreeWidth] = useState(256) // 64 * 4 = 256px (w-64)
  const [chatWidth, setChatWidth] = useState(384) // 96 * 4 = 384px (w-96)
  const [designBoardHeight, setDesignBoardHeight] = useState(50) // Percentage
  const [fileTreeVisible, setFileTreeVisible] = useState(true)
  
  // Drag state
  const [isDragging, setIsDragging] = useState<'fileTree' | 'chat' | 'designBoard' | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; startWidth?: number; startHeight?: number } | null>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Initialize Phaser runtime
  useEffect(() => {
    if (phaserContainer && !gameRuntime) {
      const runtime = new PhaserGameRuntime(phaserContainer)
      setGameRuntime(runtime)
    }

    return () => {
      if (gameRuntime) {
        gameRuntime.destroy()
      }
    }
  }, [phaserContainer])

  // Load game info and chat history
  useEffect(() => {
    if (!gameId) return
    
    const initializeGame = async () => {
      // Load game info
      await loadGameInfo()
      
      // Load kept assets state from storage
      if (gameId) {
        try {
          const storageKey = `keptAssets_${gameId}`
          const savedKeptAssets = await get<string[]>(storageKey, [])
          if (savedKeptAssets && savedKeptAssets.length > 0) {
            setKeptAssets(new Set(savedKeptAssets))
          }
        } catch (error) {
          console.error('Failed to load kept assets state:', error)
        }
      }
      
      // Load existing assets from file tree
      if (gameId) {
        try {
          const files = await loadFiles(gameId)
          const assetFiles = Object.keys(files)
            .filter(path => path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')))
            .map(path => ({
              path,
              url: files[path],
              name: path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
            }))
          setExistingAssets(assetFiles)
        } catch (error: any) {
          // Suppress offline errors - they're expected when internet is disconnected
          const errorMessage = error?.message || error?.toString() || ''
          const isOfflineError = errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
                                errorMessage.includes('Failed to fetch') ||
                                errorMessage.includes('AuthRetryableFetchError') ||
                                error?.name === 'AuthRetryableFetchError'
          
          if (!isOfflineError) {
            console.error('Failed to load existing assets:', error)
          }
          // Silently continue if offline - assets will load when connection is restored
        }
      }
      
      // Load chat history from storage
      try {
        const storageKey = `chatHistory_${gameId}`
        const savedMessages = await get<ChatMessage[]>(storageKey, [])
        if (savedMessages && savedMessages.length > 0) {
          console.log(`Playground: Restored ${savedMessages.length} messages from storage`)
          setMessages(savedMessages)
          
          // Check if there's a pending request that was interrupted
          const pendingRequestKey = `pendingRequest_${gameId}`
          const pendingRequest = await get<{
            prompt: string
            timestamp: number
            conversationHistory: ChatMessage[]
          } | null>(pendingRequestKey, null)
          
          if (pendingRequest) {
            // Check if the request is recent (within last hour) and hasn't completed
            const timeSinceRequest = Date.now() - pendingRequest.timestamp
            const oneHour = 60 * 60 * 1000
            
            if (timeSinceRequest < oneHour) {
              // Check if the last message is the user's prompt (meaning it didn't complete)
              const lastMessage = savedMessages[savedMessages.length - 1]
              if (lastMessage && lastMessage.role === 'user' && lastMessage.content === pendingRequest.prompt) {
                console.log('Playground: Found incomplete request from sleep/wake, resuming automatically...')
                // Wait a bit for the app to fully initialize, then resume
                // Use a longer delay to ensure everything is ready
                setTimeout(() => {
                  handleSend(pendingRequest.prompt)
                }, 2000)
              } else {
                // Request completed, clear pending state
                await set(pendingRequestKey, null)
              }
            } else {
              // Request is too old, clear it
              console.log('Playground: Pending request is too old, clearing...')
              await set(pendingRequestKey, null)
            }
          }
          // Mark initial prompt as sent if we have messages
          initialPromptSentRef.current = true
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }
    
    initializeGame()
  }, [gameId]) // Only depend on gameId

  // Save chat history to storage whenever messages change
  useEffect(() => {
    if (gameId && messages.length > 0) {
      const storageKey = `chatHistory_${gameId}`
      set(storageKey, messages).catch(error => {
        console.error('Failed to save chat history:', error)
      })
    }
  }, [messages, gameId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, statusMessage])

  // Drag handlers
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      if (isDragging === 'fileTree') {
        const deltaX = e.clientX - dragStartRef.current.x
        const newWidth = Math.max(150, Math.min(500, (dragStartRef.current.startWidth || fileTreeWidth) + deltaX))
        setFileTreeWidth(newWidth)
      } else if (isDragging === 'chat') {
        const deltaX = e.clientX - dragStartRef.current.x
        const newWidth = Math.max(250, Math.min(800, (dragStartRef.current.startWidth || chatWidth) + deltaX))
        setChatWidth(newWidth)
      } else if (isDragging === 'designBoard') {
        const deltaY = e.clientY - dragStartRef.current.y
        // Get the parent container height (main content area)
        const containerHeight = mainContentRef.current?.clientHeight || window.innerHeight - 60
        const deltaPercent = (deltaY / containerHeight) * 100
        const newHeight = Math.max(20, Math.min(80, (dragStartRef.current.startHeight || designBoardHeight) + deltaPercent))
        setDesignBoardHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
      dragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, fileTreeWidth, chatWidth, designBoardHeight])

  const handleDragStart = (type: 'fileTree' | 'chat' | 'designBoard', e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(type)
    if (type === 'fileTree') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startWidth: fileTreeWidth }
    } else if (type === 'chat') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startWidth: chatWidth }
    } else if (type === 'designBoard') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, startHeight: designBoardHeight }
    }
  }

  const loadGameInfo = async () => {
    if (!gameId) return
    try {
      const game = await getGame(gameId)
      setProjectName(game.title || 'Untitled Game')
    } catch (error) {
      console.error('Failed to load game info:', error)
    }
  }

  const handleNameEditStart = () => {
    setEditingName(projectName)
    setIsEditingName(true)
  }

  const handleNameEditSave = async () => {
    if (!gameId) return
    
    const trimmedName = editingName.trim()
    if (trimmedName === projectName || trimmedName === '') {
      // No change or empty, just cancel
      setIsEditingName(false)
      return
    }

    try {
      const { updateGame } = await import('../services/projects')
      await updateGame(gameId, { title: trimmedName })
      setProjectName(trimmedName)
      setIsEditingName(false)
    } catch (error) {
      console.error('Failed to update game name:', error)
      alert('Failed to update game name. Please try again.')
      setIsEditingName(false)
    }
  }

  const handleNameEditCancel = () => {
    setIsEditingName(false)
    setEditingName('')
  }

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim()
    if (!messageToSend || isLoading || !gameId) return

    // Check if this is a new game build request (not a modification request)
    const isModificationRequest = /(fix|update|change|modify|improve|add|remove|edit|adjust|tweak|enhance|refactor|debug|make|set)/i.test(messageToSend)
    const isGameBuildRequest = /build|create|make|generate|design/i.test(messageToSend) && 
                               /game/i.test(messageToSend) &&
                               !isModificationRequest
    
    // Only show warning for NEW game builds, not modifications
    if (isGameBuildRequest && !isModificationRequest) {
      try {
        const { listFilePaths } = await import('../services/projects')
        const existingFiles = await listFilePaths(gameId)
        const existingAssets = existingFiles.filter(path => path.startsWith('assets/'))
        
        if (existingAssets.length > 0) {
          const confirmed = window.confirm(
            `This game already has ${existingAssets.length} asset(s) in the assets folder.\n\n` +
            `Generating new assets will delete the existing ones.\n\n` +
            `Do you want to proceed?`
          )
          
          if (!confirmed) {
            // User cancelled - don't proceed
            return
          }
          
          // User confirmed - delete existing assets (but keep assets marked as "keep")
          const { deleteAssets } = await import('../services/projects')
          // Only delete assets that are NOT marked as "keep"
          await deleteAssets(gameId, keptAssets)
          console.log('Playground: Deleted existing assets (kept', keptAssets.size, 'assets), proceeding with generation')
          // Refresh file tree to show assets are deleted
          setFileTreeRefresh(prev => prev + 1)
        }
      } catch (error) {
        console.error('Playground: Error checking/deleting assets:', error)
        // Continue anyway - don't block the user
      }
    }

    const userMessage: ChatMessage = { role: 'user', content: messageToSend }
    setInput('')
    setIsLoading(true)
    setStatusMessage(null)

    // Save pending request state so it can be resumed if interrupted
    if (gameId) {
      const pendingRequestKey = `pendingRequest_${gameId}`
      const fullConversationHistory = [...messages, userMessage]
      await set(pendingRequestKey, {
        prompt: messageToSend,
        timestamp: Date.now(),
        conversationHistory: fullConversationHistory,
      }).catch(err => console.error('Failed to save pending request:', err))
    }

    // Include the current user message in the conversation history for context
    const fullConversationHistory = [...messages, userMessage]
    setMessages(prev => [...prev, userMessage])

    try {
      const result = await orchestrate(messageToSend, fullConversationHistory, (status) => {
        setStatusMessage(status)
      }, gameId, () => {
        // Callback when assets are generated - refresh file tree immediately
        console.log('Playground: Assets generated, refreshing file tree...')
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 100)
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 1000)
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 3000)
      })

      if (!result.stream) {
        throw new Error('Failed to get stream')
      }

      // Display generated assets in Design Board if available
      if (result.generatedAssets && result.generatedAssets.length > 0) {
        console.log('Playground: Received generated assets:', result.generatedAssets.length)
        setGeneratedAssets(result.generatedAssets)
        
        // Wait a bit for assets to be saved, then refresh preview
        setTimeout(async () => {
          if (gameRuntime && gameId) {
            console.log('Playground: Auto-refreshing preview after asset generation...')
            await handleRefreshPreview()
          }
        }, 2000) // Wait 2 seconds for assets to be saved
      } else {
        console.log('Playground: No generated assets in result')
      }

      let fullResponse = ''
      const assistantMessage: ChatMessage = { role: 'assistant', content: '', citations: result.citations }
      setMessages(prev => [...prev, assistantMessage])

      for await (const chunk of readStream(result.stream)) {
        fullResponse += chunk
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: fullResponse }
          }
          return updated
        })
      }

      setStatusMessage(null)
      setHasUnsavedChanges(true)
      
      // Clear pending request state since request completed successfully
      if (gameId) {
        const pendingRequestKey = `pendingRequest_${gameId}`
        await set(pendingRequestKey, null).catch(err => console.error('Failed to clear pending request:', err))
      }
      
      // Refresh file tree if game was built (check for keywords or tool results)
      if (fullResponse.toLowerCase().includes('generated') || 
          fullResponse.toLowerCase().includes('built') || 
          fullResponse.toLowerCase().includes('created') ||
          fullResponse.toLowerCase().includes('game files have been saved') ||
          fullResponse.toLowerCase().includes('asset')) {
        // Multiple refreshes with delays to ensure files are loaded
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 500)
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 1500)
        setTimeout(() => {
          setFileTreeRefresh(prev => prev + 1)
        }, 3000)
        
        // Try to load and display the game in the preview and Design Board
        if (gameRuntime && gameId) {
          try {
            const files = await loadFiles(gameId)
            const gameJson = files['game.json']
            if (gameJson) {
              const gameData = JSON.parse(gameJson)
              
              // Update Design Board with game structure
              const scenes = Object.keys(files)
                .filter(path => path.startsWith('scenes/') && path.endsWith('.json'))
                .map(path => path.replace('scenes/', '').replace('.json', ''))
              
              setGameStructure({
                type: gameData.type,
                description: gameData.description,
                scenes,
              })
              
              // Load existing assets from file tree for Design Board
              const assetFiles = Object.keys(files)
                .filter(path => path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')))
                .map(path => ({
                  path,
                  url: files[path],
                  name: path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
                }))
              setExistingAssets(assetFiles)
              
              // Load and start the game in preview
              const sceneName = gameData.mainScene || scenes[0] || 'ticTacToe'
              
              // Try to load the game script if it exists
              const scriptFile = files[`scripts/${sceneName}.ts`] || files[`scripts/${sceneName}.js`]
              if (scriptFile) {
                // Collect asset URLs from files (images are stored as blob URLs)
                const assets: Record<string, string> = {}
                Object.keys(files).forEach(path => {
                  if (path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg'))) {
                    const assetName = path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
                    assets[assetName] = files[path] // This is already a blob URL
                  }
                })
                
                // Load the script code
                console.log('Playground: Loading script file for scene:', sceneName)
                await gameRuntime.loadGameScript(scriptFile, sceneName)
                
                // Get the scene class from the global scope (set by the script)
                // Try multiple naming patterns
                const sceneNameCapitalized = sceneName.charAt(0).toUpperCase() + sceneName.slice(1).replace(/[-_]/g, '')
                const SceneClass = (window as any)[sceneNameCapitalized + 'Scene'] || 
                                  (window as any)[sceneName + 'Scene'] ||
                                  (window as any)[sceneNameCapitalized] ||
                                  (window as any)['MazeScene'] ||
                                  (window as any)['TicTacToeScene'] || 
                                  (window as any)['GameScene'] ||
                                  (window as any)['PacmanScene']
                
                console.log('Playground: Looking for scene class:', sceneNameCapitalized + 'Scene')
                console.log('Playground: Found scene class:', SceneClass ? SceneClass.name : 'none')
                console.log('Playground: All window scene classes:', Object.keys(window).filter(k => k.endsWith('Scene') || k.includes('Scene')))
                
                if (SceneClass) {
                  // Start the game with the custom scene class and assets
                  await gameRuntime.startScene(sceneName, SceneClass, assets)
                } else {
                  console.warn('Playground: No scene class found, trying fallback')
                  // Fallback to scene definition
                  const sceneFile = files[`scenes/${sceneName}.json`]
                  if (sceneFile) {
                    const scene = JSON.parse(sceneFile)
                    await gameRuntime.loadScene(scene)
                    await gameRuntime.startScene(sceneName)
                  } else {
                    console.error('Playground: No scene class or scene definition found for:', sceneName)
                    console.error('Playground: Available files:', Object.keys(files))
                  }
                }
              } else {
                // Fallback to scene definition
                const sceneFile = files[`scenes/${sceneName}.json`]
                if (sceneFile) {
                  const scene = JSON.parse(sceneFile)
                  await gameRuntime.loadScene(scene)
                  await gameRuntime.startScene(sceneName)
                }
              }
            }
          } catch (error) {
            console.error('Failed to load game for preview:', error)
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setStatusMessage(null)
      
      // Don't clear pending request on error - keep it so user can retry
      // Only clear if it's a rate limit error (user needs to contact support)
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        if (gameId) {
          const pendingRequestKey = `pendingRequest_${gameId}`
          await set(pendingRequestKey, null).catch(err => console.error('Failed to clear pending request:', err))
        }
      }
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      }])
    } finally {
      setIsLoading(false)
      setStatusMessage(null)
    }
  }

  const handleSave = async () => {
    if (!gameId) return
    try {
      // TODO: Collect current project state and save
      await saveFiles(gameId, [])
      setHasUnsavedChanges(false)
      setFileTreeRefresh(prev => prev + 1) // Refresh file tree
      alert('Game saved!')
    } catch (error) {
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExport = async () => {
    if (!gameId) return
    try {
      // Debug: Check if electronAPI is available
      if (typeof window !== 'undefined') {
        console.log('electronAPI available:', !!window.electronAPI)
        console.log('export API available:', !!window.electronAPI?.export)
        console.log('exportGame available:', !!window.electronAPI?.export?.exportGame)
      }
      const exportPath = await exportGame(gameId)
      alert(`Game exported to: ${exportPath}`)
    } catch (error) {
      console.error('Export error:', error)
      alert(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRefreshPreview = async () => {
    if (!gameRuntime || !gameId) return
    
    try {
      // Load game files
      const files = await loadFiles(gameId)
      const gameJson = files['game.json']
      
      if (!gameJson) {
        console.warn('No game.json found')
        return
      }
      
      const gameData = JSON.parse(gameJson)
      const sceneName = gameData.mainScene || 'ticTacToe'
      
      // Try to load the game script if it exists
      const scriptFile = files[`scripts/${sceneName}.js`] || files[`scripts/${sceneName}.ts`]
      if (scriptFile) {
        // Collect asset URLs from files (images are stored as blob URLs)
        const assets: Record<string, string> = {}
        Object.keys(files).forEach(path => {
          if (path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg'))) {
            const assetName = path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
            assets[assetName] = files[path] // This is already a blob URL
          }
        })
        
        console.log('Playground: All file paths:', Object.keys(files))
        console.log('Playground: Asset file paths:', Object.keys(files).filter(p => p.startsWith('assets/')))
        console.log('Playground: Collected assets for game:', Object.keys(assets))
        console.log('Playground: Asset count:', Object.keys(assets).length)
        if (Object.keys(assets).length > 0) {
          console.log('Playground: Asset URLs (first 100 chars each):', Object.fromEntries(
            Object.entries(assets).map(([key, url]) => [key, typeof url === 'string' ? url.substring(0, 100) + '...' : 'not a string'])
          ))
        } else {
          console.warn('Playground: No assets found in files! Available files:', Object.keys(files))
        }
        
        // Clear any previously loaded scripts from window
        delete (window as any)[sceneName.charAt(0).toUpperCase() + sceneName.slice(1) + 'Scene']
        delete (window as any)['TicTacToeScene']
        delete (window as any)['GameScene']
        
        // Load the script code
        await gameRuntime.loadGameScript(scriptFile, sceneName)
        
        // Get the scene class from the global scope (set by the script)
        // Try multiple naming patterns to find the scene class
        const sceneNameCapitalized = sceneName.charAt(0).toUpperCase() + sceneName.slice(1)
        const SceneClass = (window as any)[sceneNameCapitalized + 'Scene'] || 
                          (window as any)[sceneName.charAt(0).toUpperCase() + sceneName.slice(1).replace(/([A-Z])/g, '$1') + 'Scene'] ||
                          (window as any)['TictactoeScene'] ||
                          (window as any)['TicTacToeScene'] || 
                          (window as any)['PacmanScene'] ||
                          (window as any)['MazeScene'] ||
                          (window as any)['GameScene']
        
        console.log('Playground: Looking for scene class. Scene name:', sceneName, 'Trying:', [
          sceneNameCapitalized + 'Scene',
          'TictactoeScene',
          'TicTacToeScene',
          'PacmanScene',
          'MazeScene',
          'GameScene'
        ])
        console.log('Playground: Found scene class:', SceneClass ? SceneClass.name : 'none')
        
        if (SceneClass) {
          // Start the game with the custom scene class and assets
          await gameRuntime.startScene(sceneName, SceneClass, assets)
        } else {
          // Fallback to scene definition
          const sceneFile = files[`scenes/${sceneName}.json`]
          if (sceneFile) {
            const scene = JSON.parse(sceneFile)
            await gameRuntime.loadScene(scene)
            await gameRuntime.startScene(sceneName)
          }
        }
      } else {
        // Fallback to scene definition
        const sceneFile = files[`scenes/${sceneName}.json`]
        if (sceneFile) {
          const scene = JSON.parse(sceneFile)
          await gameRuntime.loadScene(scene)
          await gameRuntime.startScene(sceneName)
        }
      }
      
      // Load existing assets from file tree for Design Board
      const assetFiles = Object.keys(files)
        .filter(path => path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')))
        .map(path => ({
          path,
          url: files[path],
          name: path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
        }))
      setExistingAssets(assetFiles)
      
      // Refresh file tree to show updated files
      setFileTreeRefresh(prev => prev + 1)
    } catch (error) {
      console.error('Failed to refresh preview:', error)
      alert(`Failed to refresh preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !gameId) return

    // Limit to 10 PNG files
    const pngFiles = Array.from(files).filter(file => 
      file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
    ).slice(0, 10)

    if (pngFiles.length === 0) {
      alert('Please select PNG files only. Files must be in PNG format with transparent backgrounds for best results.')
      return
    }

    if (files.length > 10) {
      alert(`You selected ${files.length} files. Only the first 10 PNG files will be uploaded.`)
    }

    setIsUploading(true)
    try {
      // Load existing files to get asset URLs after upload
      const { loadFiles } = await import('../services/projects')
      const { saveFiles } = await import('../services/projects')
      
      // Prepare files for upload
      // Check existing assets to avoid duplicates
      const { listFilePaths } = await import('../services/projects')
      const existingFiles = await listFilePaths(gameId)
      const existingAssetNames = new Set(existingFiles.filter(p => p.startsWith('assets/')).map(p => p.replace('assets/', '')))
      
      // Validate and ensure PNG format for all files
      const filesToUpload = await Promise.all(pngFiles.map(async (file, index) => {
        // Use the original filename, sanitized
        let sanitizedName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .toLowerCase()
          .replace(/\.png$/i, '') // Remove .png extension (we'll add it back)
        
        // Handle duplicate names
        let finalName = sanitizedName
        let counter = 1
        while (existingAssetNames.has(`${finalName}.png`)) {
          finalName = `${sanitizedName}_${counter}`
          counter++
        }
        existingAssetNames.add(`${finalName}.png`) // Track for this batch
        
        const assetPath = `assets/${finalName}.png`
        
        // Ensure the file is in PNG format
        let fileContent: Blob = file
        if (!file.type.includes('png')) {
          // Convert to PNG if needed
          fileContent = await convertImageToPNG(file)
        }
        
        return {
          path: assetPath,
          content: fileContent,
        }
      }))

      // Upload files
      await saveFiles(gameId, filesToUpload)
      
      console.log(`Playground: Uploaded ${filesToUpload.length} asset(s)`)
      
      // Refresh file tree
      setFileTreeRefresh(prev => prev + 1)
      
      // Reload assets from file tree to show newly uploaded assets
      const updatedFiles = await loadFiles(gameId)
      const assetFiles = Object.keys(updatedFiles)
        .filter(path => path.startsWith('assets/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')))
        .map(path => ({
          path,
          url: updatedFiles[path],
          name: path.replace('assets/', '').replace(/\.(png|jpg|jpeg)$/i, '')
        }))
      setExistingAssets(assetFiles)
      
      // Show success message
      alert(`Successfully uploaded ${filesToUpload.length} asset(s) to the assets folder!\n\nNote: For best results, ensure your PNG files have transparent backgrounds.`)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload files:', error)
      alert(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  // Helper function to convert image to PNG format
  const convertImageToPNG = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        
        // Draw image to canvas (preserves transparency if present)
        ctx.drawImage(img, 0, 0)
        
        // Convert to PNG blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert to PNG'))
          }
        }, 'image/png')
      }
      
      img.onerror = () => reject(new Error('Failed to load image for conversion'))
      img.src = URL.createObjectURL(file)
    })
  }

  return (
    <div 
      className={`w-full h-full flex flex-col bg-[#F8F1E3] ${isDragging === 'fileTree' || isDragging === 'chat' ? 'cursor-col-resize select-none' : isDragging === 'designBoard' ? 'cursor-row-resize select-none' : ''}`}
      style={isDragging ? { userSelect: 'none' } : {}}
    >
      {/* Top Bar */}
      <div className="p-3 border-b border-[#533F31]/20 bg-[#FBF7EF] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} size="sm">
            ← Back
          </Button>
          {isEditingName ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleNameEditSave()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleNameEditCancel()
                }
              }}
              autoFocus
              className="font-display text-lg text-[#2E2A25] bg-transparent border-b-2 border-[#533F31] outline-none px-1 min-w-[200px]"
              style={{ fontFamily: 'inherit' }}
            />
          ) : (
            <h2 
              className="font-display text-lg text-[#2E2A25] cursor-pointer hover:text-[#533F31] hover:bg-[#E9C46A]/20 hover:px-2 hover:py-1 hover:rounded transition-all duration-150"
              onClick={handleNameEditStart}
              title="Click to edit game name"
            >
              {projectName}
            </h2>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs text-[#533F31]/60">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" onClick={handleSave} size="sm">
            Save
          </Button>
          <Button variant="outlined" onClick={handleExport} size="sm">
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div ref={mainContentRef} className="flex-1 flex overflow-hidden">
        {/* File Tree (Leftmost) */}
        {fileTreeVisible && (
          <>
            <div 
              className="border-r border-[#533F31]/20 bg-[#F8F1E3] flex flex-col flex-shrink-0"
              style={{ width: `${fileTreeWidth}px` }}
            >
              <div className="p-4 pt-12 border-b border-[#533F31]/20 flex items-center justify-between">
                <h3 className="font-medium text-[#2E2A25] text-sm">Files</h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFileTreeRefresh(prev => prev + 1)}
                    className="text-xs"
                    title="Refresh file tree"
                  >
                    ↻
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFileTreeVisible(false)}
                    className="text-xs"
                  >
                    ×
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <FileTree 
                  gameId={gameId} 
                  refreshTrigger={fileTreeRefresh}
                  onFileSelect={(path, content) => {
                    setSelectedFile({ path, content })
                  }}
                />
              </div>
            </div>
            {/* File Tree Resize Handle */}
            <div
              className="w-1 bg-[#533F31]/20 hover:bg-[#533F31]/40 cursor-col-resize flex-shrink-0 transition-colors"
              onMouseDown={(e) => handleDragStart('fileTree', e)}
            />
          </>
        )}
        {!fileTreeVisible && (
          <div className="flex-shrink-0 border-r border-[#533F31]/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFileTreeVisible(true)}
              className="rounded-r-lg rounded-l-none h-full px-2"
            >
              ▶
            </Button>
          </div>
        )}

        {/* Chat Panel (Middle) */}
        <div 
          className="border-r border-[#533F31]/20 bg-[#FBF7EF] flex flex-col flex-shrink-0"
          style={{ width: `${chatWidth}px` }}
        >
          <div className="p-4 pt-12 border-b border-[#533F31]/20">
            <div className="flex items-center gap-2 mb-2">
              <Mascot className="h-6 w-6" />
              <h3 className="font-medium text-[#2E2A25]">AI Assistant</h3>
            </div>
            <p className="text-xs text-[#2E2A25]/70">
              Describe your game, add NPCs, create scenes, and build dialogue.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="space-y-3">
                <Bubble from="npc">
                  <p>Welcome! Try one of these prompts to get started:</p>
                  <p className="mt-2 text-sm text-[#2E2A25]/80">
                    <strong>Tip:</strong> Be specific with your prompts! Each prompt can generate up to 10 game assets at once. For best results, describe exactly what you want (e.g., "Build me a pacman game with a yellow player, red ghost, blue ghost, pink ghost, orange ghost, dots, power pellets, and wall tiles").
                  </p>
                </Bubble>
                <div className="space-y-2">
                  <button
                    onClick={() => handleSend('Build me a pacman game.')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    Build me a pacman game.
                  </button>
                  <button
                    onClick={() => handleSend('Build me a Donkey Kong game.')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    Build me a Donkey Kong game.
                  </button>
                  <button
                    onClick={() => handleSend('Build me a game of Tic-Tac-Toe.')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    Build me a game of Tic-Tac-Toe.
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <Bubble key={i} from={msg.role === 'user' ? 'you' : 'npc'}>
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : (
                  <MessageContent content={msg.content} />
                )}
              </Bubble>
            ))}

            {statusMessage && (
              <div className="px-3 py-2 rounded-lg bg-[#E9C46A]/40 ring-1 ring-[#533F31]/20 text-sm text-[#2E2A25]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#533F31] animate-pulse"></div>
                  <span>{statusMessage}</span>
                </div>
              </div>
            )}

            {isLoading && !statusMessage && (
              <Bubble from="npc">
                <TypingAnimation />
              </Bubble>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[#533F31]/20">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  // Update input state - this handles ALL characters including letters, space, WASD, etc.
                  setInput(e.target.value)
                }}
                onKeyDown={(e) => {
                  // Stop propagation to prevent Phaser game from capturing these keys
                  // This ensures WASD, spacebar, and other keys work in the textarea
                  if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    e.stopPropagation()
                  }
                  
                  // Only handle Enter without Shift - prevent default to stop any form submission
                  // For ALL other keys (W, A, S, D, Space, letters, numbers, etc.), do NOTHING
                  // Let the browser handle them normally through onChange
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (input.trim()) {
                      handleSend()
                    }
                  }
                  // Explicitly allow all other keys to work normally - no preventDefault() for anything else
                }}
                onKeyPress={(e) => {
                  // Stop propagation for all keypress events to prevent game from capturing them
                  if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    e.stopPropagation()
                  }
                }}
                placeholder={initialPrompt || "Add an NPC, create a scene, branch dialogue..."}
                className="flex-1 min-h-[60px] max-h-[120px]"
                rows={2}
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
              />
              <Button 
                onClick={(e) => {
                  e.preventDefault()
                  if (!isLoading && input.trim()) {
                    handleSend()
                  }
                }}
                disabled={!input.trim() || isLoading}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
        {/* Chat Resize Handle */}
        <div
          className="w-1 bg-[#533F31]/20 hover:bg-[#533F31]/40 cursor-col-resize flex-shrink-0 transition-colors"
          onMouseDown={(e) => handleDragStart('chat', e)}
        />

        {/* Design Board & Play Panel (Right) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Design Board */}
          <div 
            className="p-4 pt-12 border-b border-[#533F31]/20 bg-[#FBF7EF] overflow-y-auto min-h-0"
            style={{ height: `${designBoardHeight}%` }}
          >
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-[#2E2A25]">Design Board</h3>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,image/png"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="asset-upload-input"
                  />
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !gameId}
                    title="Upload up to 10 PNG files with transparent backgrounds"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Assets'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[#2E2A25]/60 text-right">
                PNG files only (up to 10). Transparent backgrounds recommended for best results.
              </p>
            </div>
            {(generatedAssets.length > 0 || existingAssets.length > 0) && !selectedFile ? (
              <div className="space-y-4">
                <div className="bg-[#F8F1E3] rounded-lg p-4 border border-[#533F31]/20">
                  <h4 className="font-medium text-[#2E2A25] mb-2">
                    Game Assets ({generatedAssets.length + existingAssets.length})
                  </h4>
                  <p className="text-sm text-[#2E2A25]/70 mb-4">
                    {generatedAssets.length > 0 ? 'Newly generated assets are shown below. ' : ''}
                    Toggle "Keep" to prevent assets from being replaced when generating new ones.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Show existing assets first */}
                    {existingAssets.map((asset, idx) => {
                      const isKept = keptAssets.has(asset.path)
                      return (
                        <div key={`existing-${idx}`} className={`bg-white rounded-lg p-3 border ${isKept ? 'border-[#E9C46A] border-2' : 'border-[#533F31]/20'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#533F31]">Asset</span>
                              <span className="text-xs text-[#2E2A25]/60">{asset.name}</span>
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isKept}
                                onChange={(e) => {
                                  const newKeptAssets = new Set(keptAssets)
                                  if (e.target.checked) {
                                    newKeptAssets.add(asset.path)
                                  } else {
                                    newKeptAssets.delete(asset.path)
                                  }
                                  setKeptAssets(newKeptAssets)
                                  // Persist to storage
                                  if (gameId) {
                                    const storageKey = `keptAssets_${gameId}`
                                    set(storageKey, Array.from(newKeptAssets)).catch(err => 
                                      console.error('Failed to save kept assets state:', err)
                                    )
                                  }
                                }}
                                className="w-4 h-4 text-[#E9C46A] rounded border-[#533F31]/30 focus:ring-[#E9C46A]"
                              />
                              <span className="text-xs text-[#2E2A25]/70">Keep</span>
                            </label>
                          </div>
                          {asset.url && (
                            <img 
                              src={asset.url} 
                              alt={asset.name}
                              className="w-full h-32 object-contain rounded border border-[#533F31]/10"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                          <p className="text-xs text-[#2E2A25]/60 mt-2 truncate">{asset.path}</p>
                        </div>
                      )
                    })}
                    {/* Show newly generated assets */}
                    {generatedAssets.map((asset, idx) => {
                      const isKept = keptAssets.has(asset.path)
                      return (
                        <div key={`generated-${idx}`} className={`bg-white rounded-lg p-3 border ${isKept ? 'border-[#E9C46A] border-2' : 'border-[#533F31]/20'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#533F31] capitalize">{asset.type}</span>
                              <span className="text-xs text-[#2E2A25]/60">{asset.name}</span>
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isKept}
                                onChange={(e) => {
                                  const newKeptAssets = new Set(keptAssets)
                                  if (e.target.checked) {
                                    newKeptAssets.add(asset.path)
                                  } else {
                                    newKeptAssets.delete(asset.path)
                                  }
                                  setKeptAssets(newKeptAssets)
                                  // Persist to storage
                                  if (gameId) {
                                    const storageKey = `keptAssets_${gameId}`
                                    set(storageKey, Array.from(newKeptAssets)).catch(err => 
                                      console.error('Failed to save kept assets state:', err)
                                    )
                                  }
                                }}
                                className="w-4 h-4 text-[#E9C46A] rounded border-[#533F31]/30 focus:ring-[#E9C46A]"
                              />
                              <span className="text-xs text-[#2E2A25]/70">Keep</span>
                            </label>
                          </div>
                          {asset.url && (
                            <img 
                              src={asset.url} 
                              alt={asset.name}
                              className="w-full h-32 object-contain rounded border border-[#533F31]/10"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                          <p className="text-xs text-[#2E2A25]/60 mt-2 truncate">{asset.path}</p>
                        </div>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      setGeneratedAssets([])
                      setExistingAssets([])
                    }}
                    className="mt-4"
                  >
                    Clear Assets View
                  </Button>
                </div>
              </div>
            ) : selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#533F31]">{selectedFile.path}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedFile(null)}
                  >
                    Close
                  </Button>
                </div>
                <div className="bg-[#F8F1E3] rounded-lg p-4 border border-[#533F31]/20">
                  {/* Check if it's an image file */}
                  {selectedFile.path.match(/\.(png|jpg|jpeg|gif|webp)$/i) && selectedFile.content.startsWith('blob:') ? (
                    <div className="flex flex-col items-center">
                      <img 
                        src={selectedFile.content} 
                        alt={selectedFile.path}
                        className="max-w-full max-h-96 object-contain rounded border border-[#533F31]/20"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          const errorDiv = document.createElement('div')
                          errorDiv.className = 'text-sm text-[#2E2A25]/60'
                          errorDiv.textContent = 'Failed to load image'
                          e.target.parentElement?.appendChild(errorDiv)
                        }}
                      />
                      <p className="text-xs text-[#2E2A25]/60 mt-2">{selectedFile.path}</p>
                    </div>
                  ) : (
                    <pre className="text-xs text-[#2E2A25] whitespace-pre-wrap font-mono overflow-x-auto">
                      {selectedFile.content}
                    </pre>
                  )}
                </div>
              </div>
            ) : gameStructure ? (
              <div className="space-y-4">
                <div className="bg-[#F8F1E3] rounded-lg p-4 border border-[#533F31]/20">
                  <h4 className="font-medium text-[#2E2A25] mb-2">Game: {gameStructure.type || 'Untitled'}</h4>
                  {gameStructure.description && (
                    <p className="text-sm text-[#2E2A25]/70 mb-3">{gameStructure.description}</p>
                  )}
                  {gameStructure.scenes && gameStructure.scenes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[#533F31] mb-2">Scenes:</p>
                      <div className="flex flex-wrap gap-2">
                        {gameStructure.scenes.map((scene, i) => (
                          <span key={i} className="px-2 py-1 bg-[#E9C46A]/30 rounded text-xs text-[#2E2A25]">
                            {scene}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#2E2A25]/60">Click a file in the file tree to view its contents.</p>
              </div>
            ) : (
              <div className="text-sm text-[#2E2A25]/70">
                Game structure, scenes, and dialogue will appear here as you build.
                <br />
                <span className="text-xs mt-2 block">Click a file in the file tree to view it.</span>
              </div>
            )}
          </div>
          {/* Design Board Resize Handle */}
          <div
            className="h-1 bg-[#533F31]/20 hover:bg-[#533F31]/40 cursor-row-resize flex-shrink-0 transition-colors"
            onMouseDown={(e) => handleDragStart('designBoard', e)}
          />

          {/* Play Panel */}
          <div 
            className="border-t border-[#533F31]/20 bg-[#2E2A25] flex flex-col min-h-0"
            style={{ height: `${100 - designBoardHeight}%` }}
          >
            <div className="p-4 pb-2 flex items-center justify-between">
              <h3 className="font-medium text-[#F8F1E3]">Play Preview</h3>
              <Button
                variant="outlined"
                size="sm"
                onClick={handleRefreshPreview}
                className="text-[#F8F1E3] border-[#F8F1E3]/40 hover:bg-[#F8F1E3]/10"
              >
                ↻ Refresh
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 pt-2">
              <div
                ref={setPhaserContainer}
                className="bg-[#1a1a1a] rounded mx-auto"
                style={{ 
                  width: '600px',
                  height: '600px',
                  minWidth: '600px',
                  minHeight: '600px'
                }}
              />
            </div>
            {dialogueRunner && (
              <div className="p-4 pt-0">
                <DialogueUI runner={dialogueRunner} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

