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
      
      console.log(`Himalayan Game Builder: Generating ${assetSpec.type} asset "${assetSpec.name}" with prompt: ${prompt}`)
      
      // Try DALL-E first, with fallback to Stability AI if content policy violation
      let imageUrl = await generateImageWithDALLE(apiKey, prompt, assetSpec.size)
      
      // If DALL-E fails with content policy violation, try Stability AI as fallback
      if (!imageUrl) {
        console.log(`DALL-E failed for ${assetSpec.name}, trying Stability AI fallback...`)
        imageUrl = await generateImageWithStabilityAI(prompt, assetSpec.size)
      }
      
      if (!imageUrl) {
        console.warn(`Failed to generate image for ${assetSpec.name} with both DALL-E and Stability AI`)
        continue
      }

      // Handle image download - Stability AI returns data URLs, DALL-E returns regular URLs
      let imageBlob: Blob
      if (imageUrl.startsWith('data:')) {
        // Stability AI returned a data URL - convert to blob
        const response = await fetch(imageUrl)
        imageBlob = await response.blob()
      } else {
        // DALL-E returned a regular URL - download it
        if (typeof window !== 'undefined' && window.electronAPI?.download) {
          try {
            // Use Electron main process to download (bypasses CORS)
            const arrayBuffer = await window.electronAPI.download.downloadImage(imageUrl)
            // Determine MIME type from URL or default to PNG
            const mimeType = imageUrl.includes('.png') || imageUrl.includes('image/png') ? 'image/png' : 'image/jpeg'
            imageBlob = new Blob([arrayBuffer], { type: mimeType })
          } catch (error) {
            console.warn('Failed to download via Electron, trying direct fetch:', error)
            // Fallback to direct fetch (may fail due to CORS)
            imageBlob = await fetch(imageUrl).then(res => res.blob())
          }
        } else {
          // Fallback for non-Electron environments
          imageBlob = await fetch(imageUrl).then(res => res.blob())
        }
      }
      
      // Ensure PNG format - convert to PNG if needed
      let finalBlob = imageBlob
      if (!imageBlob.type.includes('png')) {
        console.log(`Converting ${assetSpec.name} to PNG format...`)
        // Convert to PNG using canvas
        finalBlob = await convertToPNG(imageBlob)
      }
      
      // Always use PNG extension
      const assetPath = `assets/${assetSpec.name}.png`
      const storagePath = `${user.id}/${input.gameId}/${assetPath}`

      // Upload to Supabase storage with PNG content type
      const { error: uploadError } = await supabase.storage
        .from('gamefiles')
        .upload(storagePath, finalBlob, {
          upsert: true,
          contentType: 'image/png', // Always PNG
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

      // Note: game_assets table is optional metadata
      // Assets are already saved to game_files which is the primary storage
      // We skip saving to game_assets since the table doesn't exist and it's not required

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
    console.error('Himalayan Game Builder: Image generation error:', error)
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
  // Sanitize prompts to reduce content policy violations
  const sanitizedGameType = sanitizePrompt(gameType)
  const sanitizedDescription = sanitizePrompt(gameDescription)
  const sanitizedAssetDesc = sanitizePrompt(assetSpec.description)
  
  // Base style with emphasis on PNG format, transparent background, and individual assets
  const baseStyle = 'simple, clean, individual game asset, single object, pixel art style, PNG format, transparent background, no background, alpha channel, high quality, family-friendly, cartoon style, isolated on transparent background'
  
  switch (assetSpec.type) {
    case 'tile':
      return `${sanitizedAssetDesc}. ${baseStyle}, square tile, suitable for ${sanitizedGameType} game board. MUST be a single individual PNG asset with transparent background, no other objects in the image.`
    case 'marker':
      return `${sanitizedAssetDesc}. ${baseStyle}, game marker, suitable for ${sanitizedGameType} game. MUST be a single individual PNG asset with transparent background, isolated object only.`
    case 'logo':
      return `${sanitizedAssetDesc}. ${baseStyle}, game logo, suitable for ${sanitizedGameType} game. MUST be a single individual PNG asset with transparent background, isolated logo only.`
    case 'background':
      // Backgrounds can have solid backgrounds, but still PNG format and individual
      return `${sanitizedAssetDesc}. simple, clean, individual game background, pixel art style, PNG format, high quality, family-friendly, cartoon style, suitable for ${sanitizedGameType} game. MUST be a single individual PNG asset.`
    case 'sprite':
      return `${sanitizedAssetDesc}. ${baseStyle}, game sprite, suitable for ${sanitizedGameType} game. MUST be a single individual PNG asset with transparent background, no background color, alpha channel enabled, isolated character/object only, no other elements in the image.`
    case 'icon':
      return `${sanitizedAssetDesc}. ${baseStyle}, game icon, suitable for ${sanitizedGameType} game. MUST be a single individual PNG asset with transparent background, isolated icon only.`
    default:
      return `${sanitizedAssetDesc}. ${baseStyle}, individual game asset for ${sanitizedGameType}. MUST be a single individual PNG asset with transparent background, isolated object only.`
  }
}

/**
 * Converts an image blob to PNG format with transparency support
 */
async function convertToPNG(imageBlob: Blob): Promise<Blob> {
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
    img.src = URL.createObjectURL(imageBlob)
  })
}

/**
 * Sanitizes prompts to reduce content policy violations
 * Only replaces truly problematic words, keeping game-specific terms like "ghost"
 */
function sanitizePrompt(text: string): string {
  if (!text) return text
  
  // Only replace truly problematic terms, not game-specific terms
  // (e.g., "ghost" is fine for Pacman, but "kill" might trigger filters)
  const replacements: Record<string, string> = {
    'kill': 'defeat',
    'death': 'game over',
    'blood': 'red color',
    'weapon': 'tool',
    'gun': 'tool',
    'shoot': 'aim',
  }
  
  let sanitized = text
  
  // Apply replacements (case-insensitive)
  for (const [problematic, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${problematic}\\b`, 'gi')
    sanitized = sanitized.replace(regex, replacement)
  }
  
  return sanitized
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
        prompt: prompt + ' PNG format with transparent background. Single individual asset only, isolated object on transparent background, no other elements.',
        n: 1,
        size: dalleSizeParam,
        quality: 'standard',
        response_format: 'url',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {}
      
      console.error('DALL-E API error:', response.status, errorText)
      
      // Check if it's a content policy violation - return null to trigger fallback
      if (errorData.error?.code === 'content_policy_violation' || 
          errorData.error?.type === 'image_generation_user_error') {
        console.warn('DALL-E content policy violation, will try fallback')
        return null
      }
      
      throw new Error(`DALL-E API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.[0]?.url || null
  } catch (error) {
    console.error('DALL-E generation error:', error)
    return null
  }
}

/**
 * Fallback image generator using Stability AI (Stable Diffusion)
 * This is used when DALL-E rejects a prompt due to content policy
 */
async function generateImageWithStabilityAI(
  prompt: string,
  size?: { width: number; height: number }
): Promise<string | null> {
  try {
    // Get Stability AI API key from environment or storage
    let stabilityKey = ''
    if (typeof window !== 'undefined' && window.electronAPI?.env) {
      const envKey = await window.electronAPI.env.get('STABILITY_API_KEY')
      if (envKey) {
        stabilityKey = envKey
      }
    }
    
    // Also check storage
    if (!stabilityKey) {
      stabilityKey = await get<string>('stabilityKey', '')
    }

    if (!stabilityKey) {
      console.warn('Stability AI API key not found, skipping fallback')
      return null
    }

    // Stability AI supports various sizes, default to 1024x1024
    const width = size?.width || 1024
    const height = size?.height || 1024

    // Stability AI API endpoint (using v1 for better compatibility)
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt + ' PNG format with transparent background, alpha channel, single individual asset only, isolated object on transparent background, no other elements' }],
        cfg_scale: 7,
        height,
        width,
        steps: 30,
        samples: 1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stability AI API error:', response.status, errorText)
      return null
    }

    // Stability AI returns JSON with base64 image
    const data = await response.json()
    const base64Image = data.artifacts?.[0]?.base64
    
    if (!base64Image) {
      console.error('Stability AI: No image in response')
      return null
    }
    
    // Convert base64 to data URL
    return `data:image/png;base64,${base64Image}`
  } catch (error) {
    console.error('Stability AI generation error:', error)
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

