import { getSupabaseClient, getUser } from '../lib/supabase'

export interface Game {
  id: string
  user_id: string
  title: string
  slug: string
  created_at: string
  updated_at: string
}

export interface GameFile {
  id: string
  game_id: string
  path: string
  sha256: string | null
  size_bytes: number | null
  updated_at: string
}

export async function createGame(title: string, slug: string): Promise<Game> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('games')
    .insert({
      title,
      slug,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('createGame error:', error)
    if (error.code === '42P01') {
      throw new Error('Database table "games" does not exist. Please run the setup SQL in Supabase.')
    }
    throw new Error(`Failed to create game: ${error.message || error.code || 'Unknown database error'}`)
  }
  
  if (!data) {
    throw new Error('Game created but no data returned')
  }
  
  return data
}

export async function listGames(): Promise<Game[]> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getGame(gameId: string): Promise<Game> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .eq('user_id', user.id)
    .single()

  if (error) throw error
  return data
}

export async function updateGame(gameId: string, updates: Partial<Game>): Promise<Game> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('games')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteGame(gameId: string): Promise<void> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function saveFiles(
  gameId: string,
  files: Array<{ path: string; content: string | Blob }>
): Promise<void> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify game ownership
  await getGame(gameId)

  // Upload files to storage and update DB
  for (const file of files) {
    const storagePath = `${user.id}/${gameId}/${file.path}`
    const content = typeof file.content === 'string'
      ? new Blob([file.content], { type: 'application/json' })
      : file.content

    // Determine content type based on file extension
    let contentType: string | undefined = undefined
    if (file.path.endsWith('.json')) {
      contentType = 'application/json'
    } else if (file.path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      // For image files, determine MIME type from extension
      const ext = file.path.toLowerCase().split('.').pop()
      contentType = ext === 'png' ? 'image/png' :
                   ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                   ext === 'gif' ? 'image/gif' :
                   ext === 'webp' ? 'image/webp' : 'image/png'
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('gamefiles')
      .upload(storagePath, content, {
        upsert: true,
        contentType,
      })

    if (uploadError) {
      console.error(`Failed to upload ${file.path}:`, uploadError)
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist') || uploadError.message?.includes('not found')) {
        throw new Error(`Storage bucket "gamefiles" does not exist. Please run the setup SQL in Supabase to create it.`)
      }
      throw new Error(`Failed to upload ${file.path}: ${uploadError.message || uploadError}`)
    }

    // Calculate hash and size (simplified - in production, use crypto)
    const arrayBuffer = await content.arrayBuffer()
    const size = arrayBuffer.byteLength
    const hash = await calculateSHA256(arrayBuffer)

    // Upsert file record
    const { error: dbError } = await supabase
      .from('game_files')
      .upsert({
        game_id: gameId,
        path: file.path,
        sha256: hash,
        size_bytes: size,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'game_id,path',
      })

    if (dbError) {
      console.error(`Failed to save file record for ${file.path}:`, dbError)
      if (dbError.code === '42P01') {
        throw new Error('Database table "game_files" does not exist. Please run the setup SQL in Supabase.')
      }
      throw new Error(`Failed to save file record: ${dbError.message || dbError.code || 'Unknown error'}`)
    }
  }
}

export async function listFilePaths(gameId: string): Promise<string[]> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify game ownership
  await getGame(gameId)

  // Get file list from DB
  const { data: fileRecords, error: listError } = await supabase
    .from('game_files')
    .select('path, game_id, updated_at')
    .eq('game_id', gameId)
    .order('path')

  if (listError) {
    console.error('Failed to list file paths:', listError)
    console.error('List error details:', JSON.stringify(listError, null, 2))
    throw listError
  }

  const paths = (fileRecords || []).map(record => record.path)
  console.log(`GameBao: Found ${paths.length} files for game ${gameId}:`, paths)
  if (paths.length > 0) {
    console.log('GameBao: File paths breakdown:', {
      assets: paths.filter(p => p.startsWith('assets/')),
      scripts: paths.filter(p => p.startsWith('scripts/')),
      scenes: paths.filter(p => p.startsWith('scenes/')),
      other: paths.filter(p => !p.startsWith('assets/') && !p.startsWith('scripts/') && !p.startsWith('scenes/'))
    })
  }
  return paths
}

export async function deleteAssets(gameId: string): Promise<void> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify game ownership
  await getGame(gameId)

  // First, get the asset file paths before deleting
  const { data: fileRecords } = await supabase
    .from('game_files')
    .select('path')
    .eq('game_id', gameId)
    .like('path', 'assets/%')

  // Delete all asset files from database (files in assets/ directory)
  const { error: deleteError } = await supabase
    .from('game_files')
    .delete()
    .eq('game_id', gameId)
    .like('path', 'assets/%')

  if (deleteError) {
    console.error('Failed to delete assets:', deleteError)
    throw deleteError
  }

  // Also try to delete from storage if we have file records
  if (fileRecords && fileRecords.length > 0) {
    try {
      const storagePaths = fileRecords.map(record => `${user.id}/${gameId}/${record.path}`)
      const { error: storageError } = await supabase.storage
        .from('gamefiles')
        .remove(storagePaths)

      if (storageError) {
        console.warn('Failed to delete assets from storage (non-critical):', storageError)
      } else {
        console.log(`GameBao: Deleted ${storagePaths.length} asset(s) from storage`)
      }
    } catch (error) {
      console.warn('Error cleaning up storage (non-critical):', error)
    }
  }

  console.log(`GameBao: Deleted all assets for game ${gameId}`)
}

export async function loadFiles(gameId: string): Promise<Record<string, string>> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify game ownership
  await getGame(gameId)

  // Get file list from DB
  const { data: fileRecords, error: listError } = await supabase
    .from('game_files')
    .select('path')
    .eq('game_id', gameId)

  if (listError) throw listError

  // Load each file from storage
  const files: Record<string, string> = {}
  for (const record of fileRecords || []) {
    const storagePath = `${user.id}/${gameId}/${record.path}`
    const { data, error: downloadError } = await supabase.storage
      .from('gamefiles')
      .download(storagePath)

    if (downloadError) {
      console.error(`Failed to load ${record.path}:`, downloadError)
      continue
    }

    // For image files, convert to blob URL or data URL
    if (record.path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      const blob = data
      const blobUrl = URL.createObjectURL(blob)
      files[record.path] = blobUrl // Store blob URL for images
    } else {
      // For text files, read as text
      files[record.path] = await data.text()
    }
  }

  return files
}

export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

