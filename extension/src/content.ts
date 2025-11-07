let root: ShadowRoot | null = null
let panelVisible = true

// Inject console hook into page context
function injectConsoleHook() {
  const script = document.createElement('script')
  script.textContent = `
    (function() {
      if (window.__GAMENPC_CONSOLE_HOOKED) return
      window.__GAMENPC_CONSOLE_HOOKED = true
      const send = (type, payload) => {
        window.postMessage({ source: 'GAMENPC_DEVTOOLS', type, payload }, '*')
      }
      const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
      ['log', 'warn', 'error', 'info'].forEach(k => {
        console[k] = function(...args) {
          send('DEVTOOLS_' + k.toUpperCase(), { level: k, args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) })
          orig[k].apply(console, args)
        }
      })
      window.addEventListener('error', e => send('DEVTOOLS_ERROR', { message: e.message, stack: e.error?.stack }))
      window.addEventListener('unhandledrejection', e => send('DEVTOOLS_REJECTION', { reason: String(e.reason) }))
    })()
  `
  ;(document.head || document.documentElement).appendChild(script)
  script.remove()
}

// Listen for devtools messages from page
window.addEventListener('message', (ev) => {
  if (ev.data?.source === 'GAMENPC_DEVTOOLS') {
    // Forward to background/service worker
    chrome.runtime.sendMessage({
      type: ev.data.type,
      payload: ev.data.payload,
    }).catch(() => {
      // Ignore errors if background isn't ready
    })
  }
})

// Page manipulation handler
function handlePageManipulation(msg: any): any {
  try {
    const { action, selector, text, value, html, css, x, y } = msg

    switch (action) {
      case 'click': {
        if (!selector) return { ok: false, message: 'Selector required for click' }
        const element = document.querySelector(selector)
        if (!element) return { ok: false, message: `Element not found: ${selector}` }
        ;(element as HTMLElement).click()
        return { ok: true, message: `Clicked element: ${selector}` }
      }

      case 'type': {
        if (!selector || !text) return { ok: false, message: 'Selector and text required for type' }
        const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement
        if (!element) return { ok: false, message: `Element not found: ${selector}` }
        element.focus()
        element.value = text
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: true, message: `Typed into: ${selector}` }
      }

      case 'select': {
        if (!selector || !value) return { ok: false, message: 'Selector and value required for select' }
        const element = document.querySelector(selector) as HTMLSelectElement
        if (!element) return { ok: false, message: `Element not found: ${selector}` }
        element.value = value
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: true, message: `Selected value in: ${selector}` }
      }

      case 'scroll': {
        if (x !== undefined && y !== undefined) {
          window.scrollTo(x, y)
          return { ok: true, message: `Scrolled to (${x}, ${y})` }
        } else if (selector) {
          const element = document.querySelector(selector)
          if (!element) return { ok: false, message: `Element not found: ${selector}` }
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return { ok: true, message: `Scrolled to: ${selector}` }
        }
        return { ok: false, message: 'Coordinates or selector required for scroll' }
      }

      case 'highlight': {
        if (!selector) return { ok: false, message: 'Selector required for highlight' }
        const element = document.querySelector(selector)
        if (!element) return { ok: false, message: `Element not found: ${selector}` }
        
        // Add highlight style
        const originalOutline = (element as HTMLElement).style.outline
        ;(element as HTMLElement).style.outline = '3px solid #E9C46A'
        ;(element as HTMLElement).style.outlineOffset = '2px'
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          ;(element as HTMLElement).style.outline = originalOutline
        }, 3000)
        
        return { ok: true, message: `Highlighted: ${selector}` }
      }

      case 'inject': {
        if (!html) return { ok: false, message: 'HTML required for inject' }
        const div = document.createElement('div')
        div.innerHTML = html
        div.style.position = 'fixed'
        div.style.zIndex = '999998'
        div.style.pointerEvents = 'none'
        document.body.appendChild(div)
        
        // Remove after 5 seconds
        setTimeout(() => div.remove(), 5000)
        
        return { ok: true, message: 'Injected HTML element' }
      }

      case 'modify': {
        if (!selector || (!html && !css && !text)) {
          return { ok: false, message: 'Selector and html/css/text required for modify' }
        }
        const element = document.querySelector(selector)
        if (!element) return { ok: false, message: `Element not found: ${selector}` }
        
        if (html) {
          ;(element as HTMLElement).innerHTML = html
        } else if (text) {
          ;(element as HTMLElement).textContent = text
        } else if (css) {
          const style = document.createElement('style')
          style.textContent = css
          document.head.appendChild(style)
        }
        
        return { ok: true, message: `Modified: ${selector}` }
      }

      default:
        return { ok: false, message: `Unknown action: ${action}` }
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function ensurePanel() {
  if (root) return

  const container = document.createElement('div')
  container.id = 'gamenpc-root'
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '999999'
  container.setAttribute('data-gamenpc', 'true')

  const shadow = container.attachShadow({ mode: 'open' })
  document.documentElement.appendChild(container)

  const mount = document.createElement('div')
  mount.id = 'gamenpc-mount'
  mount.style.width = '100%'
  mount.style.height = '100%'
  shadow.appendChild(mount)

  // Inject CSS - load from inject folder
  const styleLink = document.createElement('link')
  styleLink.rel = 'stylesheet'
  styleLink.href = chrome.runtime.getURL('inject/index.css')
  styleLink.onerror = () => {
    console.error('GameNPC: Failed to load CSS from inject/index.css')
  }
  styleLink.onload = () => {
    console.log('GameNPC: CSS loaded successfully')
  }
  shadow.appendChild(styleLink)

  // Inject React app script
  const script = document.createElement('script')
  script.type = 'module'
  script.src = chrome.runtime.getURL('inject/index.js')
  script.onerror = () => {
    console.error('GameNPC: Failed to load script')
  }
  script.onload = () => {
    console.log('GameNPC: Script loaded successfully')
  }
  shadow.appendChild(script)

  root = shadow
  console.log('GameNPC: Panel mounted')
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GAMENPC_TOGGLE') {
    if (!root) ensurePanel()
    panelVisible = !panelVisible
    const container = document.getElementById('gamenpc-root')
    if (container) {
      container.style.display = panelVisible ? 'block' : 'none'
    }
    sendResponse({ visible: panelVisible })
  } else if (msg?.type === 'GAMENPC_STATUS') {
    sendResponse({ visible: panelVisible })
  } else if (msg?.type === 'GAMENPC_QUICK_ASK') {
    // Forward quick ask to injected app
    if (root) {
      root.dispatchEvent(
        new CustomEvent('gamenpc-quick-ask', { detail: { message: msg.message } })
      )
    }
  } else if (msg?.type === 'GAMENPC_PAGE_MANIPULATE') {
    // Handle page manipulation requests
    const result = handlePageManipulation(msg)
    sendResponse(result)
    return true // Keep channel open for async response
  }
  return true
})

// Auto-mount on localhost
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  // Inject console hook
  injectConsoleHook()
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensurePanel()
    })
  } else {
    ensurePanel()
  }
}

// Relay actions to page via postMessage
window.addEventListener('message', (ev) => {
  if (ev.data?.source === 'GAMENPC') {
    // Dispatch to page context
    window.dispatchEvent(
      new CustomEvent('gamenpc:npc', {
        detail: ev.data,
      })
    )
  }
})
