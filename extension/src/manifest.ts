import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Paralogue NPC Copilot',
  version: '0.1.0',
  description: 'Cute overlay to design LLM NPC agents for localhost games.',
  action: { default_popup: 'src/ui/Popup.html' },
  options_page: 'src/ui/Options.html',
  devtools_page: 'devtools/devtools.html',
  background: { service_worker: 'src/background.ts', type: 'module' },
  content_scripts: [
    {
      matches: [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://localhost/*',
        'https://127.0.0.1/*',
      ],
      js: ['src/content.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'scripting', 'activeTab'],
  host_permissions: [
    'http://localhost/*',
    'http://127.0.0.1/*',
    'https://localhost/*',
    'https://127.0.0.1/*',
  ],
  web_accessible_resources: [
    {
      resources: ['inject/*', 'assets/*'],
      matches: [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://localhost/*',
        'https://127.0.0.1/*',
      ],
    },
  ],
})
