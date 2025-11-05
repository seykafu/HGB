import { initializeDocsIndex } from './tools/docsIndex'

// Initialize docs index on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Paralogue: Initializing...')
  await initializeDocsIndex()
  console.log('Paralogue: Docs index initialized')
})

// Listen for devtools messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type?.startsWith('DEVTOOLS')) {
    // Forward to devtools bridge (it will handle buffering)
    // The bridge listens in its own module
    return true
  }
  
  // Context menu for quick toggle
  if (msg?.type === 'PARALOGUE_TOGGLE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PARALOGUE_TOGGLE' })
      }
    })
  }
  return true
})

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'paralogue-toggle',
    title: 'Toggle Paralogue Panel',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'paralogue-toggle' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'PARALOGUE_TOGGLE' })
  }
})
