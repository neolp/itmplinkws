const EventEmitter = require('events')
const cbor = require('cbor-sync')
const WebSocket = require('ws')

class ITMPWsLink extends EventEmitter {
  constructor(url, opts) {
    super()
    if (opts === undefined) opts = {}
    this.url = url
    this.name = url
    this.binary = opts.binary !== undefined ? opts.binary : true
    this.autoReconnect = opts.autoReconnect !== undefined ? opts.autoReconnect : true
    this.reconnectCount = 0
    this.reconnectMaxCount = opts.reconnectMaxCount !== undefined ? opts.reconnectMaxCount : NaN
    this.ws = null
    this.ready = false
  }

  connect() {
    var that = this
    that.ready = false
    if (this.ws) {
      this.ws.removeAllListeners('error')
      this.ws.removeAllListeners('open')
      this.ws.removeAllListeners('close')
      this.ws.removeAllListeners('message')
      this.ws.close()
    }
    try {
      this.reconnectCount++
      this.ws = new WebSocket(this.url) // 'ws://www.host.com/path'
    } catch (err) {
      this.ws = null
      console.log('ITMPWsLink socket create error')
      setTimeout(that.connect.bind(that), 3000)
      return
    }

    this.ws.on('error', (err) => {
      //console.log('ITMPWsLink Error: ', err)
      //that.emit('error', err)
    })

    this.ws.on('open', () => { // open logic
      that.ready = true // port opened flag
      this.reconnectCount = 0
      that.emit('connect')
    })

    this.ws.on('close', (code, reason) => {
      console.log('ITMPWsLink closed ', code, reason)
      that.ready = false
      that.emit('disconnect', code, reason)
      if (this.autoReconnect && !(this.reconnectCount > this.reconnectMaxCount)) {
        this.reconnectTimer = setTimeout(that.connect.bind(that), 3000) //that.settings.reconnectTimeout
      }
    })

    this.ws.on('message', (message) => {
      let msg
      if (typeof message === 'string') { msg = JSON.parse(message) } else { msg = cbor.decode(message) }
      that.emit('message', msg)
    })
  }
  send(binmsg) {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ready) {
        try {
          if (this.binary) {
            this.ws.send(cbor.encode(binmsg), () => {
              resolve()
            })
          } else {
            this.ws.send(JSON.stringify(binmsg), () => {
              resolve()
            })
          }
        } catch (err) {
          reject(new Error('500 send error'))
        }
      } else {
        reject(new Error('500 link is not ready!'))
      }
    })
  }

  stop() {
    this.autoReconnect = false
    this.close()
  }
  close() {
    this.ready = false
    if (this.ws) {
      this.ws.close()
      let ws = this.ws
      this.ws = null
      setTimeout(() => {
        ws.removeAllListeners('error')
        ws.removeAllListeners('open')
        ws.removeAllListeners('close')
        ws.removeAllListeners('message')
      }, 1000)
    }
  }
}

module.exports = ITMPWsLink
