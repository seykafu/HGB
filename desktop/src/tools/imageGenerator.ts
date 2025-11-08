import type { ToolResult } from './schema'
import { getSupabaseClient, getUser } from '../lib/supabase'
import { get } from '../lib/storage'

export interface GenerateAssetsInput {
  gameId: string
  gameType: string
  description: string
  assets: Array<{
    type: 'tile' | 'marker' | 'logo' | 'background' | 'sprite' | 'icon'
    name: string
    description: string
    size?: { width: number; height: number }
  }>
}

export interface GeneratedAsset {
  type: string
  name: string
  url: string
  path: string
  width?: number
  height?: number
}

export async function generateGameAssets(input: GenerateAssetsInput): Promise<ToolResult> {
  try {
    const user = await getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    const supabase = await getSupabaseClient()
    
    // Get OpenAI API key for image generation
    let apiKey = await get<string>('openaiKey', '')
    if (!apiKey && typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('OPENAI_API_KEY')
      if (envKey) {
        apiKey = envKey
      }
    }

    if (!apiKey) {
      throw new Error('OpenAI API key required for image generation. Please set it in Settings.')
    }

    const generatedAssets: GeneratedAsset[] = []

    // Generate each asset using DALL-E
    for (const assetSpec of input.assets) {
      const prompt = createImagePrompt(assetSpec, input.gameType, input.description)
      
      console.log(`GameBao: Generating ${assetSpec.type} asset "${assetSpec.name}" with prompt: ${prompt}`)
      
      // Call DALL-E API
      const imageUrl = await generateImageWithDALLE(apiKey, prompt, assetSpec.size)
      
      if (!imageUrl) {
        console.warn(`Failed to generate image for ${assetSpec.name}`)
        continue
      }

      // Download the image
      const imageBlob = await fetch(imageUrl).then(res => res.blob())
      
      // Determine file extension and path
      const extension = imageBlob.type.includes('png') ? 'png' : 'jpg'
      const assetPath = `assets/${assetSpec.name}.${extension}`
      const storagePath = `${user.id}/${input.gameId}/${assetPath}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('gamefiles')
        .upload(storagePath, imageBlob, {
          upsert: true,
          contentType: imageBlob.type,
        })

      if (uploadError) {
        console.error(`Failed to upload asset ${assetSpec.name}:`, uploadError)
        continue
      }

      // Get signed URL (works for both public and private buckets)
      // Signed URLs are valid for 1 hour
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('gamefiles')
        .createSignedUrl(storagePath, 3600) // 1 hour expiry
      
      let assetUrl = signedUrlData?.signedUrl || storagePath
      
      // Also try public URL as fallback
      if (urlError) {
        const { data: urlData } = supabase.storage
          .from('gamefiles')
          .getPublicUrl(storagePath)
        assetUrl = urlData?.publicUrl || storagePath
      }

      // Calculate hash and size for game_files table
      const arrayBuffer = await imageBlob.arrayBuffer()
      const size = arrayBuffer.byteLength
      const { calculateSHA256 } = await import('../services/projects')
      const hash = await calculateSHA256(arrayBuffer)

      // Save to game_files table so it shows up in file tree
      const { error: fileDbError, data: fileData } = await supabase
        .from('game_files')
        .upsert({
          game_id: input.gameId,
          path: assetPath,
          sha256: hash,
          size_bytes: size,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'game_id,path',
        })
        .select()

      if (fileDbError) {
        console.error(`Failed to save asset to game_files for ${assetSpec.name}:`, fileDbError)
        console.error('File DB error details:', JSON.stringify(fileDbError, null, 2))
      } else {
        console.log(`Successfully saved asset ${assetSpec.name} to game_files table:`, assetPath)
      }

      // Store asset metadata in Game_Assets table
      const { error: dbError } = await supabase
        .from('game_assets')
        .upsert({
          game_id: input.gameId,
          asset_type: assetSpec.type,
          asset_name: assetSpec.name,
          file_path: assetPath,
          storage_path: storagePath,
          url: assetUrl,
          width: assetSpec.size?.width,
          height: assetSpec.size?.height,
          mime_type: imageBlob.type,
          size_bytes: imageBlob.size,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'game_id,asset_name',
        })

      if (dbError) {
        console.error(`Failed to save asset metadata for ${assetSpec.name}:`, dbError)
      }

      generatedAssets.push({
        type: assetSpec.type,
        name: assetSpec.name,
        url: assetUrl,
        path: assetPath,
        width: assetSpec.size?.width,
        height: assetSpec.size?.height,
      })
      
      // Verify the file was saved by querying it back
      // Wait a bit for database to sync
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { data: verifyData, error: verifyError } = await supabase
        .from('game_files')
        .select('path, game_id')
        .eq('game_id', input.gameId)
        .eq('path', assetPath)
        .single()
      
      if (verifyError || !verifyData) {
        console.warn(`Warning: Asset ${assetPath} may not be visible in file tree. Verify error:`, verifyError)
        // Try to list all files for this game to debug
        const { data: allFiles } = await supabase
          .from('game_files')
          .select('path')
          .eq('game_id', input.gameId)
        console.log(`All files in game_files for game ${input.gameId}:`, allFiles?.map(f => f.path))
      } else {
        console.log(`✓ Verified: Asset ${assetPath} is in game_files table`)
      }
    }

    return {
      ok: true,
      data: {
        assets: generatedAssets,
        count: generatedAssets.length,
      },
      message: `Generated ${generatedAssets.length} game asset(s)`,
    }
  } catch (error) {
    console.error('GameBao: Image generation error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to generate assets',
    }
  }
}

function createImagePrompt(
  assetSpec: GenerateAssetsInput['assets'][0],
  gameType: string,
  gameDescription: string
): string {
  const baseStyle = 'simple, clean, game asset, pixel art style, transparent background, high quality'
  
  switch (assetSpec.type) {
    case 'tile':
      return `${assetSpec.description}. ${baseStyle}, square tile, suitable for ${gameType} game board`
    case 'marker':
      return `${assetSpec.description}. ${baseStyle}, game marker, suitable for ${gameType} game`
    case 'logo':
      return `${assetSpec.description}. ${baseStyle}, game logo, suitable for ${gameType} game`
    case 'background':
      return `${assetSpec.description}. ${baseStyle}, game background, suitable for ${gameType} game`
    case 'sprite':
      return `${assetSpec.description}. ${baseStyle}, game sprite, suitable for ${gameType} game`
    case 'icon':
      return `${assetSpec.description}. ${baseStyle}, game icon, suitable for ${gameType} game`
    default:
      return `${assetSpec.description}. ${baseStyle}, game asset for ${gameType}`
  }
}

async function generateImageWithDALLE(
  apiKey: string,
  prompt: string,
  size?: { width: number; height: number }
): Promise<string | null> {
  try {
    // DALL-E 3 supports 1024x1024, 1792x1024, or 1024x1792
    const dalleSize = size 
      ? `${size.width}x${size.height}` 
      : '1024x1024'

    // Map to DALL-E supported sizes
    let dalleSizeParam: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'
    if (dalleSize === '1792x1024' || dalleSize === '1024x1792') {
      dalleSizeParam = dalleSize as '1792x1024' | '1024x1792'
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: dalleSizeParam,
        quality: 'standard',
        response_format: 'url',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DALL-E API error:', response.status, errorText)
      throw new Error(`DALL-E API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.[0]?.url || null
  } catch (error) {
    console.error('DALL-E generation error:', error)
    return null
  }
}

export async function getGameAssets(gameId: string): Promise<GeneratedAsset[]> {
  const supabase = await getSupabaseClient()
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('game_assets')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load game assets:', error)
    return []
  }

  return (data || []).map(asset => ({
    type: asset.asset_type,
    name: asset.asset_name,
    url: asset.url,
    path: asset.file_path,
    width: asset.width,
    height: asset.height,
  }))
}

