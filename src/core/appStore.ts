import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type BackgroundTheme =
  | 'starfield' | 'aurora' | 'cyberpunk' | 'matrix' | 'ocean' | 'forest'
  | 'sunset' | 'neon-city' | 'vaporwave' | 'synthwave' | 'glitch' | 'circuit'
  | 'digital-rain' | 'quantum' | 'retro-terminal' | 'neon-grid' | 'plasma'
  | 'matrix-fast' | 'matrix-blue' | 'cyber-grid' | 'synthwave-neon' | 'circuit-board'
  | 'glitch-vhs' | 'scanlines' | 'radar-sweep' | 'packet-flow' | 'binary-rain'
  | 'cyberpunk-neon' | 'hud-overlay' | 'terminal-green' | 'digital-cascade'
  | 'neon-particles' | 'data-stream' | 'quantum-ripple' | 'cyber-hex' | 'retro-crt'
  | 'cyber-rain'

export type KeyboardLayout = 'default' | 'terminal' | 'coding' | 'special'

export interface WindowPosition {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export interface AppWindow {
  id: string
  title: string
  position: WindowPosition
  isMinimized: boolean
  isFocused: boolean
}

interface AppState {
  // Theme & UI
  currentTheme: BackgroundTheme
  keyboardLayout: KeyboardLayout
  keyboardOpen: boolean
  keyboardPosition: 'top-left' | 'top-right'

  // Window Management
  openApps: Map<string, AppWindow>
  focusedAppId: string | null

  // Keyboard State
  shiftActive: boolean
  controlActive: boolean

  // User Preferences
  fontSize: number
  fontFamily: string
  volume: number

  // Theme Actions
  setTheme: (theme: BackgroundTheme) => void
  setKeyboardLayout: (layout: KeyboardLayout) => void
  setKeyboardOpen: (open: boolean) => void
  setKeyboardPosition: (position: 'top-left' | 'top-right') => void

  // App Management
  openApp: (id: string, title: string) => void
  closeApp: (id: string) => void
  minimizeApp: (id: string) => void
  restoreApp: (id: string) => void
  focusApp: (id: string) => void
  updateWindowPosition: (id: string, position: Partial<WindowPosition>) => void
  getWindow: (id: string) => AppWindow | undefined
  getOpenApps: () => AppWindow[]

  // Keyboard State
  setShiftActive: (active: boolean) => void
  setControlActive: (active: boolean) => void

  // Preferences
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  setVolume: (vol: number) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        currentTheme: 'matrix-blue',
        keyboardLayout: 'default',
        keyboardOpen: false,
        keyboardPosition: 'top-left',
        openApps: new Map(),
        focusedAppId: null,
        shiftActive: false,
        controlActive: false,
        fontSize: 14,
        fontFamily: 'monospace',
        volume: 80,

        // Theme Actions
        setTheme: (theme) => set({ currentTheme: theme }),
        setKeyboardLayout: (layout) => set({ keyboardLayout: layout }),
        setKeyboardOpen: (open) => set({ keyboardOpen: open }),
        setKeyboardPosition: (position) => set({ keyboardPosition: position }),

        // App Management
        openApp: (id, title) => {
          const state = get()
          const newApp: AppWindow = {
            id,
            title,
            position: {
              x: Math.random() * 200,
              y: Math.random() * 200,
              width: 600,
              height: 400,
              zIndex: Math.max(...Array.from(state.openApps.values()).map(a => a.position.zIndex), 0) + 1,
            },
            isMinimized: false,
            isFocused: true,
          }
          const newApps = new Map(state.openApps)
          newApps.set(id, newApp)
          set({ openApps: newApps, focusedAppId: id })
        },

        closeApp: (id) => {
          const state = get()
          const newApps = new Map(state.openApps)
          newApps.delete(id)
          const remainingApps = Array.from(newApps.values())
          const nextFocus = remainingApps.length > 0 ? remainingApps[0].id : null
          set({
            openApps: newApps,
            focusedAppId: state.focusedAppId === id ? nextFocus : state.focusedAppId,
          })
        },

        minimizeApp: (id) => {
          const state = get()
          const app = state.openApps.get(id)
          if (app) {
            const newApps = new Map(state.openApps)
            newApps.set(id, { ...app, isMinimized: true })
            set({ openApps: newApps })
          }
        },

        restoreApp: (id) => {
          const state = get()
          const app = state.openApps.get(id)
          if (app) {
            const newApps = new Map(state.openApps)
            newApps.set(id, { ...app, isMinimized: false, isFocused: true })
            set({ openApps: newApps, focusedAppId: id })
          }
        },

        focusApp: (id) => {
          const state = get()
          const app = state.openApps.get(id)
          if (app) {
            const newApps = new Map(state.openApps)
            // Update zIndex for focused app
            const maxZ = Math.max(...Array.from(newApps.values()).map(a => a.position.zIndex))
            newApps.set(id, {
              ...app,
              isFocused: true,
              position: { ...app.position, zIndex: maxZ + 1 }
            })
            // Unfocus others
            newApps.forEach((val, key) => {
              if (key !== id) {
                newApps.set(key, { ...val, isFocused: false })
              }
            })
            set({ openApps: newApps, focusedAppId: id })
          }
        },

        updateWindowPosition: (id, positionUpdate) => {
          const state = get()
          const app = state.openApps.get(id)
          if (app) {
            const newApps = new Map(state.openApps)
            newApps.set(id, {
              ...app,
              position: { ...app.position, ...positionUpdate }
            })
            set({ openApps: newApps })
          }
        },

        getWindow: (id) => {
          return get().openApps.get(id)
        },

        getOpenApps: () => {
          return Array.from(get().openApps.values())
        },

        // Keyboard State
        setShiftActive: (active) => set({ shiftActive: active }),
        setControlActive: (active) => set({ controlActive: active }),

        // Preferences
        setFontSize: (size) => set({ fontSize: size }),
        setFontFamily: (family) => set({ fontFamily: family }),
        setVolume: (vol) => set({ volume: vol }),
      }),
      {
        name: 'pc-jackie-store',
        // Map serialization for openApps
        serialize: (state) => JSON.stringify({
          ...state,
          openApps: Array.from(state.openApps.entries()),
        }),
        deserialize: (str) => {
          const data = JSON.parse(str)
          return {
            ...data,
            openApps: new Map(data.openApps),
          }
        },
      }
    ),
    { name: 'PC Jackie Store' }
  )
)

export default useAppStore
