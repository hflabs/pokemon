(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _map = require('./map');

var _map2 = _interopRequireDefault(_map);

var _dadata = require('./dadata');

var _dadata2 = _interopRequireDefault(_dadata);

var _status = require('./status');

var _status2 = _interopRequireDefault(_status);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $ = window.jQuery;
var POKEMON_URL = '/api/data';
var DEFAULT_COORDS = [59.9658714501842, 30.49181878830477];
var REQUEST_TIMEOUT = 5000;
var REFRESH_TIMEOUT = 60000;

var status = new _status2.default(refresh);
var refreshTimer = null;

function formatTime(timeSec) {
  if (timeSec <= 30) {
    return '< 1';
  } else {
    return Math.ceil(timeSec / 60).toString();
  }
}

function loadPokemons(location) {
  console.log('Loading pokemons for location ' + location);
  var lat = location[0];
  var lon = location[1];
  var url = POKEMON_URL + '/' + lat + ',' + lon;
  return $.ajax({
    dataType: 'json',
    url: url,
    timeout: REQUEST_TIMEOUT
  });
}

function showPokemons(data) {
  status.updatePokemon(false);
  _map2.default.clear();
  for (var name in data.pokemons) {
    var pokemon = data.pokemons[name];
    _map2.default.addPokemon([pokemon.lat, pokemon.lng], pokemon.id, pokemon.name, formatTime(pokemon.expiresAfter));
  }
  for (var id in data.pokestops) {
    var pokestop = data.pokestops[id];
    _map2.default.addPokestop([pokestop.lat, pokestop.lon], formatTime(pokestop.expiresAfter));
  }
  _map2.default.addMe();
}

function countPokemons(data) {
  var pokemonCount = Object.keys(data.pokemons).length;
  var pokestopCount = Object.keys(data.pokestops).length;
  var gymCount = Object.keys(data.gyms).length;
  console.log('Found ' + pokemonCount + ' pokemons, ' + pokestopCount + ' pokestops, ' + gymCount + ' gyms');
  return {
    pokemon: pokemonCount,
    pokestop: pokestopCount,
    gym: gymCount
  };
}

function pokemonify(location) {
  _map2.default.lock(true);
  status.updatePokemon(true);
  loadPokemons(location).done(function (data) {
    var counts = countPokemons(data);
    if (counts.pokemon === 0 && counts.pokestop === 0) {
      _map2.default.addMe();
      status.showError('А здесь нет покемонов ツ');
    } else {
      showPokemons(data);
    }
    setRefreshTimer();
    _map2.default.lock(false);
  }).fail(function () {
    console.log('Failed to load pokemons');
    status.showError('Не получилось загрузить ಠ_ಠ');
    _map2.default.lock(false);
  });
}

function refresh() {
  pokemonify(_map2.default.getCenter());
}

function setRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(refresh, REFRESH_TIMEOUT);
}

function switchLocation(location) {
  _map2.default.setCenter(location);
}

function positionBySuggestion(suggestion) {
  var address = suggestion.data;
  var location = [address.geo_lat, address.geo_lon];
  if (address.qc_geo === '5') {
    console.log('Geolocation by IP unknown, using default coordinates');
    switchLocation(DEFAULT_COORDS);
  } else {
    console.log('Positioning by enforced coordinates');
    switchLocation(location);
  }
}

function initSuggestions() {
  var $addr = $('#address');
  $addr.suggestions({
    serviceUrl: _dadata2.default.API_URL,
    token: _dadata2.default.TOKEN,
    type: 'ADDRESS',
    count: 5,
    onSelect: positionBySuggestion
  });
}

function positionByIp() {
  var suggestions = $('#address').suggestions();
  _dadata2.default.getAddressSuggestion(suggestions).done(function (suggestion) {
    console.log('Will position by guessed coordinates');
    positionBySuggestion(suggestion);
  }).fail(function () {
    console.log('Will position by default coordinates');
    switchLocation(DEFAULT_COORDS);
  });
}

_map2.default.on('centered', function () {
  status.updateMap(false);
  pokemonify(_map2.default.getCenter());
});

_map2.default.on('failed', function () {
  positionByIp();
});

_map2.default.on('refreshNeeded', function () {
  status.showRefresh();
});

initSuggestions();

},{"./dadata":2,"./map":3,"./status":4}],2:[function(require,module,exports){
'use strict';

var $ = window.jQuery;

exports.API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';
exports.TOKEN = 'REPLACE_WITH_YOUR_OWN';

function join(arr) {
  var separator = arguments.length <= 1 || arguments[1] === undefined ? ', ' : arguments[1];

  return arr.filter(function (n) {
    return n;
  }).join(separator);
}

function geoToString(address) {
  return join([join([address.region_type, address.region], ' '), join([address.area_type, address.area], ' '), join([address.city_type, address.city], ' '), join([address.settlement_type, address.settlement], ' ')]);
}

function suggest(query) {
  var request = {
    'query': query,
    'count': 1
  };
  var params = {
    type: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Token ' + exports.TOKEN
    },
    data: JSON.stringify(request)
  };
  return $.ajax(exports.API_URL + '/suggest/address', params);
}

function suggestAddress(query) {
  var promise = $.Deferred();
  suggest(query).done(function (response) {
    promise.resolve(response.suggestions && response.suggestions[0] || null);
  }).fail(function (jqXHR, textStatus, errorThrown) {
    promise.reject(null);
  });
  return promise;
}

exports.getAddressSuggestion = function (suggestions) {
  var promise = $.Deferred();
  suggestions.getGeoLocation().done(function (address) {
    var query = geoToString(address);
    suggestAddress(query).done(function (suggestion) {
      promise.resolve(suggestion);
    }).fail(function () {
      promise.reject(null);
    });
  }).fail(function () {
    promise.reject(null);
  });
  return promise;
};

},{}],3:[function(require,module,exports){
'use strict';

var ymaps = window.ymaps;
var GEOLOCATE_TIMEOUT = 5000;

var map = null;
var center = null;
var locked = false;
var changeCenterTimer = null;

var events = {
  ready: function ready() {},
  centered: function centered() {},
  failed: function failed() {},
  refreshNeeded: function refreshNeeded() {}
};

exports.isReady = function () {
  return ymaps.Map !== undefined;
};

exports.isGeolocated = function () {
  return center !== null;
};

exports.getCenter = function () {
  return center;
};

exports.setCenter = function (coords) {
  center = coords;
  if (!map) {
    createMap(coords);
  }
  map.setCenter(coords);
  map.container.fitToViewport();
  events.centered();
};

exports.clear = function () {
  map.geoObjects.removeAll();
};

exports.lock = function (on) {
  if (on && changeCenterTimer) {
    clearTimeout(changeCenterTimer);
  }
  locked = on;
};

exports.addPokemon = function (coords, id, name, ttl) {
  if (isIOS()) {
    map.geoObjects.add(new ymaps.Placemark(coords, {
      iconCaption: name + ', ' + ttl + ' мин'
    }, {
      preset: 'islands#blueDotIconWithCaption'
    }));
  } else {
    map.geoObjects.add(new ymaps.Placemark(coords, {
      iconCaption: name + ' ' + ttl + ' мин',
      hintContent: name + ', осталось ' + ttl + ' мин'
    }, {
      // preset: 'islands#blueDotIconWithCaption'
      iconLayout: 'default#image',
      iconImageHref: 'icons/' + id + '.png',
      iconImageSize: [40, 30]
    }));
  }
};

exports.addPokestop = function (coords, ttl) {
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Приманка для покемонов'
  }, {
    preset: 'islands#blueHomeCircleIcon'
  }));
};

exports.addGym = function (coords) {
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Тренировочный зал'
  }, {
    preset: 'islands#blueSportCircleIcon'
  }));
};

exports.addMe = function (coords) {
  if (!coords) {
    coords = center;
  }
  map.geoObjects.add(new ymaps.Placemark(coords, {
    hintContent: 'Радар'
  }, {
    preset: 'islands#blueCircleDotIcon'
  }));
  map.geoObjects.add(new ymaps.Circle([coords, 300], {}, {
    fill: false
    // strokeColor: '#f43e3d'
  }));
};

exports.on = function (eventName, eventHandler) {
  if (eventName in events) {
    events[eventName] = eventHandler;
  }
};

function isMobile() {
  return window.screen.width < 768;
}

function isIOS() {
  return (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  );
}

function createMap(center) {
  var zoom = arguments.length <= 1 || arguments[1] === undefined ? 16 : arguments[1];

  map = new ymaps.Map('map', {
    center: center,
    zoom: zoom,
    controls: ['zoomControl']
  });
  // map.behaviors.disable('scrollZoom')
  // map.behaviors.disable('multiTouch')
  map.events.add('boundschange', onBoundsChange);
}

function geolocate() {
  var finished = false;
  function success(position) {
    finished = true;
    console.log('Positioning by browser coordinates');
    center = [position.coords.latitude, position.coords.longitude];
    exports.setCenter(center);
  }
  function error(e) {
    finished = true;
    events.failed();
  }
  var options = {
    enableHighAccuracy: true,
    timeout: GEOLOCATE_TIMEOUT,
    maximumAge: 0
  };
  navigator.geolocation.getCurrentPosition(success, error, options);
  // hack for Firefox, which does not call error callback
  setTimeout(function () {
    if (!finished) {
      events.failed();
    }
  }, GEOLOCATE_TIMEOUT + 1000);
}

function onBoundsChange(e) {
  if (locked) {
    return;
  }
  if (changeCenterTimer) {
    clearTimeout(changeCenterTimer);
  }
  var oldCenter = e.get('oldCenter');
  var newCenter = e.get('newCenter');
  if (oldCenter[0] === newCenter[0] && oldCenter[1] === newCenter[1]) {
    return;
  }
  console.log('Map center changed');
  // do not auto-refresh on small screens
  if (isMobile()) {
    center = e.get('newCenter');
    events.refreshNeeded();
  } else {
    changeCenterTimer = setTimeout(function () {
      exports.setCenter(e.get('newCenter'));
    }, 2000);
  }
}

ymaps.ready(function () {
  events.ready();
  geolocate();
});

},{}],4:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var $ = window.jQuery;

var MSG_MAP_AND_POKEMON = 'Загружаю карту и покемонов...';
var MSG_MAP = 'Загружаю карту...';
var MSG_POKEMON = 'Загружаю покемонов...';

var Status = function () {
  function Status(onRefresh) {
    _classCallCheck(this, Status);

    this.$status = $('#status');
    this.$message = this.$status.find('[data-message]');
    this.$refresh = this.$status.find('[data-refresh]');
    this.$refresh.on('click', function (e) {
      if (onRefresh) {
        onRefresh();
      }
      e.preventDefault();
    });
    this.map = true;
    this.pokemon = true;
  }

  _createClass(Status, [{
    key: 'showStatus',
    value: function showStatus() {
      var msg = MSG_MAP_AND_POKEMON;
      if (this.map || this.pokemon) {
        if (!this.map) {
          msg = MSG_POKEMON;
        }
        if (!this.pokemon) {
          msg = MSG_MAP;
        }
        this.$message.text(msg);
        this.$status.show();
      } else {
        this.$status.addClass('status--small');
        this.$status.hide();
        this.$message.text('');
      }
      this.$refresh.hide();
    }
  }, {
    key: 'updateMap',
    value: function updateMap(state) {
      this.map = state;
      this.showStatus();
    }
  }, {
    key: 'updatePokemon',
    value: function updatePokemon(state) {
      this.pokemon = state;
      this.showStatus();
    }
  }, {
    key: 'showError',
    value: function showError(msg) {
      this.$message.text(msg);
      this.$refresh.show();
      this.$status.show();
    }
  }, {
    key: 'showRefresh',
    value: function showRefresh(msg) {
      this.$message.text('');
      this.$refresh.show();
      this.$status.show();
    }
  }]);

  return Status;
}();

module.exports = Status;

},{}]},{},[1]);
