# Tiny Kingdom Chrome Extension

This extension sends the currently active tab to the Tiny Kingdom desktop app over:

- `http://127.0.0.1:38471/browser-event`

## Install

1. Open Chrome and go to `chrome://extensions`
2. Turn on `Developer mode`
3. Choose `Load unpacked`
4. Select this folder:

`extension/chrome`

## Current Behavior

- watches the active tab
- extracts the tab title and domain
- classifies the domain as `work`, `play`, or `unknown`
- posts that data to the local Electron app

## Notes

- the desktop app must be running for events to be received
- only browser metadata is sent
- the extension does not read page content or keystrokes
