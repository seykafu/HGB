import { useState, useEffect } from 'react'
import { listFilePaths, loadFiles } from '../services/projects'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  expanded?: boolean
}

interface FileTreeProps {
  gameId: string | null
  onFileSelect?: (path: string, content: string) => void
  refreshTrigger?: number // Increment this to refresh the tree
}

export const FileTree = ({ gameId, onFileSelect, refreshTrigger }: FileTreeProps) => {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (gameId) {
      loadFileTree()
    } else {
      setTree([])
    }
  }, [gameId, refreshTrigger])

  const loadFileTree = async () => {
    if (!gameId) return
    setLoading(true)
    try {
      const paths = await listFilePaths(gameId)
      console.log(`FileTree: Loaded ${paths.length} file paths:`, paths)
      const treeStructure = buildTree(paths)
      console.log('FileTree: Built tree structure:', treeStructure)
      setTree(treeStructure)
      // Auto-expand root folders and assets folder
      const rootFolders = treeStructure.filter(n => n.type === 'folder')
      const expandedSet = new Set(rootFolders.map(n => n.path))
      // Also expand assets folder if it exists (could be nested)
      const findAssetsFolder = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.name === 'assets' && node.type === 'folder') {
            return node
          }
          if (node.children) {
            const found = findAssetsFolder(node.children)
            if (found) return found
          }
        }
        return null
      }
      const assetsFolder = findAssetsFolder(treeStructure)
      if (assetsFolder) {
        expandedSet.add(assetsFolder.path)
      }
      setExpandedPaths(expandedSet)
    } catch (error) {
      console.error('Failed to load file tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildTree = (paths: string[]): FileNode[] => {
    const root: FileNode[] = []
    const nodeMap = new Map<string, FileNode>()

    // Sort paths to ensure consistent ordering
    const sortedPaths = [...paths].sort()

    for (const path of sortedPaths) {
      const parts = path.split('/')
      let currentPath = ''
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part

        if (!nodeMap.has(currentPath)) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'folder',
            children: isLast ? undefined : [],
            expanded: expandedPaths.has(currentPath),
          }

          nodeMap.set(currentPath, node)

          if (parentPath) {
            const parent = nodeMap.get(parentPath)
            if (parent && parent.children) {
              parent.children.push(node)
            }
          } else {
            root.push(node)
          }
        }
      }
    }

    return root
  }

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleFileClick = async (path: string) => {
    if (!gameId) return
    setSelectedPath(path)
    
    if (onFileSelect) {
      try {
        const files = await loadFiles(gameId)
        const content = files[path] || ''
        onFileSelect(path, content)
      } catch (error) {
        console.error('Failed to load file:', error)
      }
    }
  }

  const renderNode = (node: FileNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedPath === node.path
    const isFolder = node.type === 'folder'
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-[#E9C46A]/20 transition-colors ${
            isSelected ? 'bg-[#E9C46A]/30 ring-1 ring-[#533F31]/40' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleExpand(node.path)
            } else {
              handleFileClick(node.path)
            }
          }}
        >
          {isFolder ? (
            <span className="text-[#533F31] text-xs w-4">
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span className="text-[#533F31] text-xs w-4">•</span>
          )}
          <span className="text-[#2E2A25] flex-1 truncate">
            {getFileIcon(node.name)} {node.name}
          </span>
        </div>
        {isFolder && isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'json':
        return '📄'
      case 'yarn':
      case 'yarn.json':
        return '💬'
      case 'js':
      case 'ts':
        return '⚙️'
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return '🖼️'
      default:
        return '📝'
    }
  }

  if (!gameId) {
    return (
      <div className="p-4 text-sm text-[#2E2A25]/60">
        No game selected
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-sm text-[#2E2A25]/60">
        Loading files...
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="p-4 text-sm text-[#2E2A25]/60">
        No files yet. Start building your game!
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  )
}

