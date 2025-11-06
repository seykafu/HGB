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
