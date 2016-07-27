const $ = window.jQuery

const MSG_MAP_AND_POKEMON = 'Загружаю карту и покемонов...'
const MSG_MAP = 'Загружаю карту...'
const MSG_POKEMON = 'Загружаю покемонов...'

const Status = class {
  constructor (onRefresh) {
    this.$status = $('#status')
    this.$message = this.$status.find('[data-message]')
    this.$refresh = this.$status.find('[data-refresh]')
    this.$refresh.on('click', (e) => {
      if (onRefresh) {
        onRefresh()
      }
      e.preventDefault()
    })
    this.map = true
    this.pokemon = true
  }

  showStatus () {
    let msg = MSG_MAP_AND_POKEMON
    if (this.map || this.pokemon) {
      if (!this.map) {
        msg = MSG_POKEMON
      }
      if (!this.pokemon) {
        msg = MSG_MAP
      }
      this.$message.text(msg)
      this.$status.show()
    } else {
      this.$status.addClass('status--small')
      this.$status.hide()
      this.$message.text('')
    }
    this.$refresh.hide()
  }

  updateMap (state) {
    this.map = state
    this.showStatus()
  }

  updatePokemon (state) {
    this.pokemon = state
    this.showStatus()
  }

  showError (msg) {
    this.$message.text(msg)
    this.$refresh.show()
    this.$status.show()
  }

  showRefresh (msg) {
    this.$message.text('')
    this.$refresh.show()
    this.$status.show()
  }
}

module.exports = Status
