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
  const [input, setInput] = useState(initialPrompt || '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [phaserContainer, setPhaserContainer] = useState<HTMLDivElement | null>(null)
  const [gameRuntime, setGameRuntime] = useState<PhaserGameRuntime | null>(null)
  const [dialogueRunner, setDialogueRunner] = useState<DialogueRunner | null>(null)
  const [projectName, setProjectName] = useState('Untitled Game')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)
  const [fileTreeRefresh, setFileTreeRefresh] = useState(0)
  const [gameStructure, setGameStructure] = useState<{ type?: string; description?: string; scenes?: string[] } | null>(null)
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ type: string; name: string; url: string; path: string }>>([])
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

  // Load game info
  useEffect(() => {
    if (gameId) {
      loadGameInfo()
    }
  }, [gameId])

  // Send initial prompt only once on mount
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current && messages.length === 0 && !isLoading && gameId) {
      initialPromptSentRef.current = true
      // Use a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        handleSend(initialPrompt)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [initialPrompt, messages.length, isLoading, gameId]) // Include dependencies but use ref to prevent multiple sends

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
      setProjectName(game.title)
    } catch (error) {
      console.error('Failed to load game info:', error)
    }
  }

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim()
    if (!messageToSend || isLoading || !gameId) return

    const userMessage: ChatMessage = { role: 'user', content: messageToSend }
    setInput('')
    setIsLoading(true)
    setStatusMessage(null)

    setMessages(prev => [...prev, userMessage])

    try {
      const result = await orchestrate(messageToSend, messages, (status) => {
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
        setGeneratedAssets(result.generatedAssets)
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
                await gameRuntime.loadGameScript(scriptFile, sceneName)
                
                // Get the scene class from the global scope (set by the script)
                const SceneClass = (window as any)[sceneName.charAt(0).toUpperCase() + sceneName.slice(1) + 'Scene'] || 
                                  (window as any)['TicTacToeScene'] || 
                                  (window as any)['GameScene']
                
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
            }
          } catch (error) {
            console.error('Failed to load game for preview:', error)
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setStatusMessage(null)
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
        
        // Clear any previously loaded scripts from window
        delete (window as any)[sceneName.charAt(0).toUpperCase() + sceneName.slice(1) + 'Scene']
        delete (window as any)['TicTacToeScene']
        delete (window as any)['GameScene']
        
        // Load the script code
        await gameRuntime.loadGameScript(scriptFile, sceneName)
        
        // Get the scene class from the global scope (set by the script)
        const SceneClass = (window as any)[sceneName.charAt(0).toUpperCase() + sceneName.slice(1) + 'Scene'] || 
                          (window as any)['TicTacToeScene'] || 
                          (window as any)['GameScene']
        
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
      
      // Refresh file tree to show updated files
      setFileTreeRefresh(prev => prev + 1)
    } catch (error) {
      console.error('Failed to refresh preview:', error)
      alert(`Failed to refresh preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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
          <h2 className="font-display text-lg text-[#2E2A25]">{projectName}</h2>
          {hasUnsavedChanges && (
            <span className="text-xs text-[#533F31]/60">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" onClick={handleSave} size="sm" disabled={!hasUnsavedChanges}>
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
                  <p>Describe your 2D narrative game (setting, main character, goals).</p>
                </Bubble>
                <div className="space-y-2">
                  <p className="text-xs text-[#2E2A25]/60 mb-2">Example prompts:</p>
                  <button
                    onClick={() => handleSend('How do I publish my game to multiple platforms?')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    How do I publish my game to multiple platforms?
                  </button>
                  <button
                    onClick={() => handleSend('How do I run an AI-based NPC agent in my game?')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    How do I run an AI-based NPC agent in my game?
                  </button>
                  <button
                    onClick={() => handleSend('How do I get started?')}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#E9C46A]/20 hover:bg-[#E9C46A]/30 border border-[#533F31]/20 text-sm text-[#2E2A25] transition-colors"
                  >
                    How do I get started?
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Add an NPC, create a scene, branch dialogue..."
                className="flex-1 min-h-[60px] max-h-[120px]"
                rows={2}
              />
              <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
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
            <h3 className="font-medium text-[#2E2A25] mb-4">Design Board</h3>
            {generatedAssets.length > 0 && !selectedFile ? (
              <div className="space-y-4">
                <div className="bg-[#F8F1E3] rounded-lg p-4 border border-[#533F31]/20">
                  <h4 className="font-medium text-[#2E2A25] mb-2">
                    Generated Game Assets ({generatedAssets.length})
                  </h4>
                  <p className="text-sm text-[#2E2A25]/70 mb-4">
                    These assets were generated for your game. They're also available in the file tree.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {generatedAssets.map((asset, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-[#533F31]/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-[#533F31] capitalize">{asset.type}</span>
                          <span className="text-xs text-[#2E2A25]/60">{asset.name}</span>
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
                    ))}
                  </div>
                  
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => setGeneratedAssets([])}
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

