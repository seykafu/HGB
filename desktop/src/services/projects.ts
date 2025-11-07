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

  if (error) throw error
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

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('gamefiles')
      .upload(storagePath, content, {
        upsert: true,
        contentType: file.path.endsWith('.json') ? 'application/json' : undefined,
      })

    if (uploadError) {
      console.error(`Failed to upload ${file.path}:`, uploadError)
      throw uploadError
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
      throw dbError
    }
  }
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

    files[record.path] = await data.text()
  }

  return files
}

async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

