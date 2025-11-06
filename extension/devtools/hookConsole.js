// Console hook to capture logs from the inspected page
// This is injected into the page context

(function() {
  if (window.__GAMENPC_CONSOLE_HOOKED) return
  window.__GAMENPC_CONSOLE_HOOKED = true

  const send = (type, payload) => {
    try {
      // Send to content script via postMessage
      window.postMessage({ source: 'GAMENPC_DEVTOOLS', type, payload }, '*')
    } catch (e) {
      console.error('GameNPC: Failed to send devtools message', e)
    }
  }

  const orig = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  }

  // Hook console methods
  ;['log', 'warn', 'error', 'info'].forEach((k) => {
    console[k] = function(...args) {
      send(`DEVTOOLS_${k.toUpperCase()}`, {
        level: k,
        args: args.map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg)
            } catch {
              return String(arg)
            }
          }
          return String(arg)
        }),
      })
      orig[k].apply(console, args)
    }
  })

  // Hook window errors
  window.addEventListener('error', (e) => {
    send('DEVTOOLS_ERROR', {
      message: e.message,
      stack: e.error?.stack,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    })
  })

  // Hook unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    send('DEVTOOLS_REJECTION', {
      reason: String(e.reason),
      stack: e.reason?.stack,
    })
  })

  console.log('GameNPC: Console hook installed')
})()

