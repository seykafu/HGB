// RAG indexing for game engine documentation
// Stores embeddings in IndexedDB for semantic search

interface DocChunk {
  id: string
  text: string
  engine: string
  path: string
  heading?: string
  embedding?: number[]
}

const DB_NAME = 'gamenpc-docs'
const STORE_NAME = 'chunks'

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('engine', 'engine', { unique: false })
      }
    }
  })
}

export async function indexDocument(chunk: DocChunk): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(chunk)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function searchChunks(engine: string, query: string, limit: number = 5): Promise<DocChunk[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('engine')
    const request = index.getAll(engine)
    
    request.onsuccess = () => {
      const chunks = request.result as DocChunk[]
      // Simple text matching for now (can be enhanced with embeddings)
      const queryLower = query.toLowerCase()
      const filtered = chunks.filter((chunk) =>
        chunk.text.toLowerCase().includes(queryLower) ||
        chunk.heading?.toLowerCase().includes(queryLower) ||
        chunk.path.toLowerCase().includes(queryLower)
      )
      // Sort by relevance (more matches = higher)
      filtered.sort((a, b) => {
        const aScore = (a.text.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length
        const bScore = (b.text.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length
        return bScore - aScore
      })
      resolve(filtered.slice(0, limit))
    }
    request.onerror = () => reject(request.error)
  })
}

// Extract text from file names to create better chunks
function inferContentFromFileName(fileName: string): { engine: string; topic: string; chunks: DocChunk[] } {
  const name = fileName.toLowerCase()
  let engine = 'unity' // default
  let topic = 'game development'
  
  // Infer engine
  if (name.includes('unity')) engine = 'unity'
  else if (name.includes('unreal')) engine = 'unreal'
  else if (name.includes('frostbite')) engine = 'frostbite'
  else if (name.includes('python')) engine = 'web' // Python game dev might be web-based
  
  // Infer topic
  if (name.includes('npc') || name.includes('ai')) topic = 'NPCs and AI'
  else if (name.includes('2d')) topic = '2D Game Development'
  else if (name.includes('beginner')) topic = 'Getting Started'
  else if (name.includes('guide')) topic = 'Game Development Guide'
  
  // Create chunks based on file
  const chunks: DocChunk[] = []
  
  if (name.includes('unity-2d') || name.includes('unity 2d')) {
    chunks.push({
      id: `unity-2d-${fileName}`,
      text: `Unity 2D Game Development: Create 2D games using Unity's 2D tools. Use Sprite Renderer for 2D graphics, Rigidbody2D for physics, and Collider2D for collision detection. The 2D Toolkit provides Tilemap for level design.`,
      engine: 'unity',
      path: `Content/${fileName}`,
      heading: 'Unity 2D Development',
    })
    chunks.push({
      id: `unity-2d-sprites-${fileName}`,
      text: `Unity 2D Sprites: Import sprites by setting Texture Type to Sprite (2D and UI). Use Sprite Editor to slice sprite sheets. Set Pixels Per Unit for proper scaling. Use Sprite Renderer component to display sprites in the scene.`,
      engine: 'unity',
      path: `Content/${fileName}`,
      heading: '2D Sprites and Textures',
    })
    chunks.push({
      id: `unity-2d-physics-${fileName}`,
      text: `Unity 2D Physics: Use Rigidbody2D for physics simulation. Add Collider2D components (BoxCollider2D, CircleCollider2D) for collision detection. Use Physics2D.Linecast for raycasting in 2D. Set gravity scale to control fall speed.`,
      engine: 'unity',
      path: `Content/${fileName}`,
      heading: '2D Physics',
    })
  }
  
  if (name.includes('beginner') || name.includes('guide')) {
    chunks.push({
      id: `beginner-${fileName}`,
      text: `Game Development Beginner Guide: Start with a simple project like Pong or Breakout. Learn the basics of game loops, input handling, collision detection, and game state management. Practice with small projects before tackling larger games.`,
      engine: engine,
      path: `Content/${fileName}`,
      heading: 'Getting Started',
    })
  }
  
  if (name.includes('ultimate') || name.includes('guide')) {
    chunks.push({
      id: `guide-${fileName}`,
      text: `Game Development Guide: Comprehensive guide covering game design principles, programming fundamentals, art creation, sound design, and publishing. Learn about game engines, asset pipelines, optimization, and monetization strategies.`,
      engine: engine,
      path: `Content/${fileName}`,
      heading: 'Complete Game Development Guide',
    })
  }
  
  // Always add a general chunk
  chunks.push({
    id: `general-${fileName}`,
    text: `${topic} in ${engine}: This document covers ${topic} topics for ${engine} game development. Refer to the full document for detailed information, code examples, and best practices.`,
    engine: engine,
    path: `Content/${fileName}`,
    heading: topic,
  })
  
  return { engine, topic, chunks }
}

export async function initializeDocsIndex(): Promise<void> {
  // Check if already indexed
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const countRequest = store.count()
  
  return new Promise((resolve) => {
    countRequest.onsuccess = () => {
      if (countRequest.result > 0) {
        // Already indexed - but check if we should re-index
        console.log(`GameNPC: Docs already indexed (${countRequest.result} chunks)`)
        resolve()
        return
      }
      
      // Create chunks from Content folder file names
      // Note: In a full implementation, we'd parse PDFs/EPUBs, but for now we infer from filenames
      const contentFiles = [
        'unity-2d-game-development-beginners-guide-to-2d-game-development-with-unity.pdf',
        'dokumen.pub_unity-2d-game-development-beginners-guide-to-2d-game-development-with-unity.epub',
        'game dev in unity 2d 2015.pdf',
        'DVNC_UltimateGuideToGettingStartedGameDevelopment-1.pdf',
        'python game development for 2d.pdf',
        'gcc4.pdf',
        'Windev_Game_Dev_Guide_Oct_2017.pdf',
      ]
      
      const allChunks: DocChunk[] = []
      
      // Add placeholder chunks for Unity
      allChunks.push({
        id: 'unity-npc-basics',
        text: 'Unity NPC Basics: Create a GameObject, add a NavMeshAgent component for pathfinding. Use OnTriggerEnter for interactions. For dialogue, use UI Text or TextMeshPro. NPCs can follow waypoints using NavMesh.SetDestination().',
        engine: 'unity',
        path: 'Content/unity-npc-guide.md',
        heading: 'NPC Basics',
      })
      
      allChunks.push({
        id: 'unity-navigation',
        text: 'Unity Navigation: Bake NavMesh in your scene (Window > AI > Navigation). Use NavMeshAgent component on NPCs for pathfinding. Set destination with agent.SetDestination(). Use NavMeshObstacle for dynamic obstacles.',
        engine: 'unity',
        path: 'Content/unity-navigation.md',
        heading: 'NavMesh and Pathfinding',
      })
      
      allChunks.push({
        id: 'unity-dialogue',
        text: 'Unity Dialogue System: Create UI Canvas for dialogue. Use Text or TextMeshPro components. Show/hide dialogue with SetActive() or enable/disable. Use Coroutines for typewriter effects. Store dialogue in ScriptableObjects or JSON.',
        engine: 'unity',
        path: 'Content/unity-dialogue.md',
        heading: 'Dialogue Systems',
      })
      
      // Add placeholder chunks for Unreal
      allChunks.push({
        id: 'unreal-ai-controller',
        text: 'Unreal AI Controller: Create an AIController class, use Behavior Trees and Blackboards. NavMesh bounds volume for pathfinding. Use UWidget for dialogue UI. AI Perception Component for sight/hearing detection.',
        engine: 'unreal',
        path: 'Content/unreal-ai-controller.md',
        heading: 'AI Controller',
      })
      
      // Process content files
      contentFiles.forEach((fileName) => {
        const inferred = inferContentFromFileName(fileName)
        allChunks.push(...inferred.chunks)
      })
      
      // Write all chunks
      const writeTx = db.transaction(STORE_NAME, 'readwrite')
      const writeStore = writeTx.objectStore(STORE_NAME)
      let completed = 0
      
      allChunks.forEach((chunk) => {
        const request = writeStore.put(chunk)
        request.onsuccess = () => {
          completed++
          if (completed === allChunks.length) {
            console.log(`GameNPC: Indexed ${allChunks.length} document chunks`)
            resolve()
          }
        }
        request.onerror = () => {
          completed++
          if (completed === allChunks.length) {
            resolve()
          }
        }
      })
    }
  })
}
