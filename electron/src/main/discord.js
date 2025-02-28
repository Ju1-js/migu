import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'
import { debounce } from '@/modules/util.js'

export default class Discord {
  defaultStatus = {
    activity: {
      timestamps: { start: Date.now() },
      details: 'Stream anime torrents',
      state: 'Watching anime',
      assets: {
        small_image: 'logo',
        small_text: 'https://github.com/Ju1-js/migu'
      },
      buttons: [
        {
          label: 'Download app',
          url: 'https://github.com/Ju1-js/migu/releases/latest'
        }
      ],
      instance: true,
      type: 3
    }
  }

  discord = new Client({ transport: 'ipc' })

  /** @type {boolean} */
  allowDiscordDetails = false

  /** @type {Discord['defaultStatus'] | undefined} */
  cachedPresence

  rpcEnabled = false  // Property to track RPC state

  /** @param {import('electron').BrowserWindow} window */
  constructor (window) {
    ipcMain.on('show-discord-status', (event, data) => {
      this.allowDiscordDetails = data
      this.debouncedDiscordRPC(this.allowDiscordDetails && this.rpcEnabled ? this.cachedPresence : undefined)
    })

    // Update presence details
    ipcMain.on('discord', async (event, data) => {
      this.cachedPresence = data
      this.debouncedDiscordRPC(this.allowDiscordDetails && this.rpcEnabled ? this.cachedPresence : undefined)
    })

    ipcMain.on('toggle-rpc', (event, data) => {
      this.toggleRPC(data)
    })

    ipcMain.on('discord-hidden', () => {
      this.debouncedDiscordRPC(undefined, true)
    })

    this.discord.on('ready', async () => {
      if (this.rpcEnabled) {
        this.setDiscordRPC(this.cachedPresence || this.defaultStatus)
        this.discord.subscribe('ACTIVITY_JOIN_REQUEST')
        this.discord.subscribe('ACTIVITY_JOIN')
        this.discord.subscribe('ACTIVITY_SPECTATE')
      }
    })

    // Handle incoming activity join requests
    this.discord.on('ACTIVITY_JOIN', ({ secret }) => {
      window.webContents.send('w2glink', secret)
    })

    // Attempt to log in
    this.loginRPC()

    // Debounce RPC updates to avoid spamming Discord
    this.debouncedDiscordRPC = debounce((status) => this.setDiscordRPC(status), 4500)
  }

  loginRPC () {
    if (this.rpcEnabled) {
      this.discord.login({ clientId: '954855428355915797' }).catch(() => {
        setTimeout(() => this.loginRPC(), 5000).unref()
      })
    }
  }

  setDiscordRPC (data = this.defaultStatus) {
    if (this.discord.user && data && this.rpcEnabled) {
      data.pid = process.pid
      this.discord.request('SET_ACTIVITY', data)
    }
  }

  clearDiscordRPC () {
    if (this.discord.user) {
      this.discord.request('SET_ACTIVITY', { pid: process.pid })
    }
  }

  toggleRPC (enabled) {
    this.rpcEnabled = enabled
    if (this.rpcEnabled) {
      this.loginRPC()
      this.setDiscordRPC(this.cachedPresence || this.defaultStatus)
    } else {
      this.clearDiscordRPC()
    }
  }
}