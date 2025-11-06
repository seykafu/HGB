# Privacy Policy for Paralogue NPC Copilot

**Last Updated:** [Insert Date]

## Introduction

Paralogue NPC Copilot ("we," "our," or "the extension") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use our Chrome extension.

## Data Collection

**Paralogue NPC Copilot does not collect, store, or transmit any personal data to external servers.**

## Local Storage

The extension uses Chrome's built-in storage APIs to save data locally on your device:

- **Extension Settings**: API keys (if you choose Direct OpenAI mode), backend preferences, model selection
- **Chat History**: Conversation messages stored locally
- **NPC Profiles**: NPC configurations and system prompts
- **Documentation Index**: Local IndexedDB for RAG search functionality

All data is stored exclusively on your device and never transmitted to external servers except as described below.

## API Usage

### OpenAI API (Direct Mode)

If you choose to use "Direct OpenAI" mode:
- Your OpenAI API key is stored locally in Chrome's secure storage
- API calls are made directly from your browser to OpenAI's servers
- We do not intercept, store, or have access to your API key or API requests
- Your conversations are subject to OpenAI's privacy policy: https://openai.com/policies/privacy-policy

### Proxy Mode

If you use "Proxy Mode":
- API calls are made to your configured proxy URL (typically `http://localhost:3000/api/chat`)
- These calls go to your own Next.js server, not to our servers
- We do not have access to or store any data from proxy mode

## Third-Party Services

### OpenAI

When using Direct OpenAI mode, your interactions are subject to OpenAI's privacy policy. We do not have access to:
- Your API key
- Your conversation content
- Any data sent to or received from OpenAI

## WebSocket Connections

The extension can connect to WebSocket servers (typically `ws://localhost:*`) that you configure. These connections are:
- Made directly from your browser to your configured server
- Not routed through our servers
- Subject to your own server's privacy practices

## Permissions Used

- **storage**: To save extension settings and chat history locally
- **scripting**: To inject the sidebar panel on localhost pages
- **activeTab**: To communicate with game pages via postMessage
- **host_permissions** (`http://localhost/*`, `http://127.0.0.1/*`): To access your local development servers

## Data Sharing

We do not share, sell, or rent your data to any third parties.

## Children's Privacy

Our extension is not intended for children under 13. We do not knowingly collect information from children.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by:
- Updating the "Last Updated" date
- Posting the new Privacy Policy in the extension's repository

## Contact Us

If you have questions about this Privacy Policy, please contact us at:
- Email: [Your Email]
- GitHub: [Your GitHub Repository URL]

## Your Rights

You have the right to:
- Access your locally stored data (via Chrome's storage inspection tools)
- Delete your data (uninstall the extension or clear Chrome storage)
- Not use features that require API keys

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles

---

*This privacy policy applies to Paralogue NPC Copilot Chrome extension version 0.1.0 and above.*

