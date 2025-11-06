// DevTools panel for GameNPC NPC Copilot
// This runs in the DevTools context

chrome.devtools.panels.create(
  'NPC Copilot',
  '/assets/mascot.png',
  'devtools/panel.html',
  (panel) => {
    console.log('GameNPC DevTools panel created')
  }
)

