import map from './map'
import dadata from './dadata'
import Status from './status'

const $ = window.jQuery
const POKEMON_URL = '/api/data'
const DEFAULT_COORDS = [59.9658714501842, 30.49181878830477]
const REQUEST_TIMEOUT = 5000
const REFRESH_TIMEOUT = 60000

const status = new Status(refresh)
let refreshTimer = null

function formatTime (timeSec) {
  if (timeSec <= 30) {
    return '< 1'
  } else {
    return Math.ceil(timeSec / 60).toString()
  }
}

function loadPokemons (location) {
  console.log(`Loading pokemons for location ${location}`)
  const lat = location[0]
  const lon = location[1]
  const url = `${POKEMON_URL}/${lat},${lon}`
  return $.ajax({
    dataType: 'json',
    url: url,
    timeout: REQUEST_TIMEOUT
  })
}

function showPokemons (data) {
  status.updatePokemon(false)
  map.clear()
  for (let name in data.pokemons) {
    let pokemon = data.pokemons[name]
    map.addPokemon([pokemon.lat, pokemon.lng],
      pokemon.id, pokemon.name, formatTime(pokemon.expiresAfter))
  }
  for (let id in data.pokestops) {
    let pokestop = data.pokestops[id]
    map.addPokestop([pokestop.lat, pokestop.lon],
      formatTime(pokestop.expiresAfter))
  }
  map.addMe()
}

function countPokemons (data) {
  const pokemonCount = Object.keys(data.pokemons).length
  const pokestopCount = Object.keys(data.pokestops).length
  const gymCount = Object.keys(data.gyms).length
  console.log(`Found ${pokemonCount} pokemons, ${pokestopCount} pokestops, ${gymCount} gyms`)
  return {
    pokemon: pokemonCount,
    pokestop: pokestopCount,
    gym: gymCount
  }
}

function pokemonify (location) {
  map.lock(true)
  status.updatePokemon(true)
  loadPokemons(location)
  .done((data) => {
    const counts = countPokemons(data)
    if (counts.pokemon === 0 && counts.pokestop === 0) {
      map.addMe()
      status.showError('А здесь нет покемонов ツ')
    } else {
      showPokemons(data)
    }
    setRefreshTimer()
    map.lock(false)
  })
  .fail(() => {
    console.log('Failed to load pokemons')
    status.showError('Не получилось загрузить ಠ_ಠ')
    map.lock(false)
  })
}

function refresh () {
  pokemonify(map.getCenter())
}

function setRefreshTimer () {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  refreshTimer = setTimeout(refresh, REFRESH_TIMEOUT)
}

function switchLocation (location) {
  map.setCenter(location)
}

function positionBySuggestion (suggestion) {
  const address = suggestion.data
  const location = [address.geo_lat, address.geo_lon]
  if (address.qc_geo === '5') {
    console.log('Geolocation by IP unknown, using default coordinates')
    switchLocation(DEFAULT_COORDS)
  } else {
    console.log('Positioning by enforced coordinates')
    switchLocation(location)
  }
}

function initSuggestions () {
  const $addr = $('#address')
  $addr.suggestions({
    serviceUrl: dadata.API_URL,
    token: dadata.TOKEN,
    type: 'ADDRESS',
    count: 5,
    onSelect: positionBySuggestion
  })
}

function positionByIp () {
  const suggestions = $('#address').suggestions()
  dadata.getAddressSuggestion(suggestions)
  .done((suggestion) => {
    console.log('Will position by guessed coordinates')
    positionBySuggestion(suggestion)
  })
  .fail(() => {
    console.log('Will position by default coordinates')
    switchLocation(DEFAULT_COORDS)
  })
}

map.on('centered', () => {
  status.updateMap(false)
  pokemonify(map.getCenter())
})

map.on('failed', () => {
  positionByIp()
})

map.on('refreshNeeded', () => {
  status.showRefresh()
})

initSuggestions()
