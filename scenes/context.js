const debug = require('debug')('telegraf:scenes:context')
const Composer = require('../composer.js')
const { safePassThru } = Composer

const noop = () => Promise.resolve()
const now = () => Math.floor(new Date().getTime() / 1000)

class SceneContext {
  constructor (ctx, scenes, options) {
    this.ctx = ctx
    this.scenes = scenes
    this.options = options
  }

  get session () {
    const sessionName = this.options.sessionName
    let session = this.ctx[sessionName].__scenes || {}
    if (session.expires < now()) {
      session = {}
    }
    this.ctx[sessionName].__scenes = session
    return session
  }

  get state () {
    this.session.state = this.session.state || {}
    return this.session.state
  }

  set state (value) {
    this.session.state = Object.assign({}, value)
  }

  get current () {
    const sceneId = this.session.current || this.options.defaultScene
    return (sceneId && this.scenes.has(sceneId)) ? this.scenes.get(sceneId) : null
  }

  reset () {
    const sessionName = this.options.sessionName
    delete this.ctx[sessionName].__scenes
  }

  enter (sceneId, initialState, silent) {
    if (!sceneId || !this.scenes.has(sceneId)) {
      throw new Error(`Can't find scene: ${sceneId}`)
    }
    const leave = silent ? noop() : this.leave()
    leave.then(() => {
      debug('enter', sceneId, initialState, silent)
      this.session.current = sceneId
      this.state = initialState
      const ttl = this.current.ttl || this.options.ttl
      if (ttl) {
        this.session.expires = now() + ttl
      }
      if (silent) {
        return
      }
      const handler = this.current.enterMiddleware
        ? this.current.enterMiddleware()
        : this.current.middleware()
      return handler(this.ctx, noop)
    })
  }

  reenter () {
    return this.enter(this.session.current, this.state)
  }

  leave () {
    debug('leave')
    const handler = this.current && this.current.leaveMiddleware
      ? this.current.leaveMiddleware()
      : safePassThru()
    return handler(this.ctx, noop).then(() => this.reset())
  }
}

module.exports = SceneContext
