import { initializeDocsIndex } from './tools/docsIndex'

// Initialize docs index on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('GameNPC: Initializing...')
  await initializeDocsIndex()
  console.log('GameNPC: Docs index initialized')
})

// Listen for devtools messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type?.startsWith('DEVTOOLS')) {
    // Forward to devtools bridge (it will handle buffering)
    // The bridge listens in its own module
    return true
  }
  
  // Context menu for quick toggle
  if (msg?.type === 'GAMENPC_TOGGLE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GAMENPC_TOGGLE' })
      }
    })
  }
  return true
})

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gamenpc-toggle',
    title: 'Toggle GameNPC Panel',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'gamenpc-toggle' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'GAMENPC_TOGGLE' })
  }
})
