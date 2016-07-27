const ymaps = window.ymaps
const GEOLOCATE_TIMEOUT = 5000

let map = null
let center = null
let locked = false
let changeCenterTimer = null

const events = {
  ready: () => {},
  centered: () => {},
  failed: () => {},
  refreshNeeded: () => {}
}

exports.isReady = function () {
  return ymaps.Map !== undefined
}

exports.isGeolocated = function () {
  return center !== null
}

exports.getCenter = function () {
  return center
}

exports.setCenter = function (coords) {
  center = coords
  if (!map) {
    createMap(coords)
  }
  map.setCenter(coords)
  map.container.fitToViewport()
  events.centered()
}

exports.clear = function () {
  map.geoObjects.removeAll()
}

exports.lock = function (on) {
  if (on && changeCenterTimer) {
    clearTimeout(changeCenterTimer)
  }
  locked = on
}

exports.addPokemon = function (coords, id, name, ttl) {
  if (isIOS()) {
    map.geoObjects.add(new ymaps.Placemark(coords, {
      iconCaption: `${name}, ${ttl} мин`
    }, {
      preset: 'islands#blueDotIconWithCaption'
    }))
  } else {
    map.geoObjects.add(new ymaps.Placemark(coords, {
      iconCaption: `${name} ${ttl} мин`,
      hintContent: `${name}, осталось ${ttl} мин`
    }, {
      // preset: 'islands#blueDotIconWithCaption'
      iconLayout: 'default#image',
      iconImageHref: `icons/${id}.png`,
      iconImageSize: [40, 30]
    }))
  }
}

exports.addPokestop = function (coords, ttl) {
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Приманка для покемонов'
  }, {
    preset: 'islands#blueHomeCircleIcon'
  }))
}

exports.addGym = function (coords) {
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Тренировочный зал'
  }, {
    preset: 'islands#blueSportCircleIcon'
  }))
}

exports.addMe = function (coords) {
  if (!coords) {
    coords = center
  }
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Радар'
  }, {
    preset: 'islands#blueCircleDotIcon'
  }))
  map.geoObjects.add(new ymaps.Circle([
    coords, 300
  ], {}, {
    fill: false
    // strokeColor: '#f43e3d'
  }))
}

exports.on = function (eventName, eventHandler) {
  if (eventName in events) {
    events[eventName] = eventHandler
  }
}

function isMobile () {
  return window.screen.width < 768
}

function isIOS () {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function createMap (center, zoom = 16) {
  map = new ymaps.Map('map', {
    center: center,
    zoom: zoom,
    controls: ['zoomControl']
  })
  // map.behaviors.disable('scrollZoom')
  // map.behaviors.disable('multiTouch')
  map.events.add('boundschange', onBoundsChange)
}

function geolocate () {
  let finished = false
  function success (position) {
    finished = true
    console.log('Positioning by browser coordinates')
    center = [position.coords.latitude, position.coords.longitude]
    exports.setCenter(center)
  }
  function error (e) {
    finished = true
    events.failed()
  }
  const options = {
    enableHighAccuracy: true,
    timeout: GEOLOCATE_TIMEOUT,
    maximumAge: 0
  }
  navigator.geolocation.getCurrentPosition(success, error, options)
  // hack for Firefox, which does not call error callback
  setTimeout(() => {
    if (!finished) {
      events.failed()
    }
  }, GEOLOCATE_TIMEOUT + 1000)
}

function onBoundsChange (e) {
  if (locked) {
    return
  }
  if (changeCenterTimer) {
    clearTimeout(changeCenterTimer)
  }
  const oldCenter = e.get('oldCenter')
  const newCenter = e.get('newCenter')
  if (oldCenter[0] === newCenter[0] && oldCenter[1] === newCenter[1]) {
    return
  }
  console.log('Map center changed')
  // do not auto-refresh on small screens
  if (isMobile()) {
    center = e.get('newCenter')
    events.refreshNeeded()
  } else {
    changeCenterTimer = setTimeout(() => {
      exports.setCenter(e.get('newCenter'))
    }, 2000)
  }
}

ymaps.ready(() => {
  events.ready()
  geolocate()
})
