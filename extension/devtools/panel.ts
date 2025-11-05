// DevTools panel for Paralogue NPC Copilot
// This runs in the DevTools context

chrome.devtools.panels.create(
  'NPC Copilot',
  '/assets/mascot.png',
  'devtools/panel.html',
  (panel) => {
    console.log('Paralogue DevTools panel created')
  }
)

