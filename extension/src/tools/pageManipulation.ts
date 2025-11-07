import type { ToolResult } from './schema'

export interface PageManipulationInput {
  action: 'click' | 'type' | 'select' | 'scroll' | 'highlight' | 'inject' | 'modify'
  selector?: string
  text?: string
  value?: string
  html?: string
  css?: string
  x?: number
  y?: number
}

export async function manipulatePage(input: PageManipulationInput): Promise<ToolResult> {
  try {
    // Execute in page context via content script
    const result = await new Promise<any>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          resolve({ ok: false, message: 'No active tab found' })
          return
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            type: 'GAMENPC_PAGE_MANIPULATE',
            action: input.action,
            selector: input.selector,
            text: input.text,
            value: input.value,
            html: input.html,
            css: input.css,
            x: input.x,
            y: input.y,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, message: chrome.runtime.lastError.message })
            } else {
              resolve(response || { ok: false, message: 'No response' })
            }
          }
        )
      })
    })

    return {
      ok: result.ok !== false,
      data: result,
      message: result.message || `Successfully executed ${input.action}`,
    }
  } catch (error) {
    return {
      ok: false,
      message: `Failed to manipulate page: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Helper to execute code in page context
export function executeInPageContext(code: string): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        reject(new Error('No active tab'))
        return
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: new Function('return ' + code) as () => any,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(results?.[0]?.result)
          }
        }
      )
    })
  })
}

