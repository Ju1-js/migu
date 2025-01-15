import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'
import { debounce } from '@/modules/util.js'

export default class Discord {
  defaultStatus = {
    activity: {
      timestamps: { start: Date.now() },
      details: 'Stream anime torrents, real-time.',
      state: 'Watching anime',
      assets: {
        small_image: 'logo',
        small_text: 'https://github.com/ThaUnknown/miru'
      },
      buttons: [
        {
          label: 'Download app',
          url: 'https://github.com/ThaUnknown/miru/releases/latest'
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

  /** @param {import('electron').BrowserWindow} window */
  constructor(window) {
    // Toggle Discord Rich Presence on/off
    ipcMain.on('show-discord-status', async (event, enableRPC) => {
      this.allowDiscordDetails = enableRPC
      if (this.allowDiscordDetails) {
        // Enable Rich Presence
        await this.setDiscordRPC(this.cachedPresence || this.defaultStatus)
      } else {
        // Disable Rich Presence
        await this.clearDiscordRPC()
      }
    })

    // Update presence details
    ipcMain.on('discord', async (event, data) => {
      this.cachedPresence = data
      if (this.allowDiscordDetails) {
        await this.setDiscordRPC(this.cachedPresence || this.defaultStatus)
      }
    })

    // Discord client ready event
    this.discord.on('ready', async () => {
      if (this.allowDiscordDetails) {
        await this.setDiscordRPC(this.cachedPresence || this.defaultStatus)
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

  /**
   * Logs in the Discord RPC client and retries on failure.
   */
  loginRPC() {
    this.discord.login({ clientId: '954855428355915797' }).catch(() => {
      setTimeout(() => this.loginRPC(), 5000).unref()
    })
  }

  /**
   * Sets the Discord Rich Presence.
   * @param {Discord['defaultStatus'] | undefined} data
   */
  async setDiscordRPC(data) {
    if (this.discord.user && data) {
      try {
        data.pid = process.pid
        await this.discord.request('SET_ACTIVITY', data)
      } catch (error) {
        console.error('Error setting Discord RPC:', error)
      }
    }
  }

  /**
   * Clears Discord Rich Presence completely.
   */
  async clearDiscordRPC() {
    if (this.discord.user) {
      try {
        await this.discord.request('SET_ACTIVITY', { pid: process.pid, activity: null })
      } catch (error) {
        console.error('Error clearing Discord RPC:', error)
      }
    }
  }
}
