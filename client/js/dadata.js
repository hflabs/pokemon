const $ = window.jQuery

exports.API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs'
exports.TOKEN = 'REPLACE_WITH_YOUR_OWN'

function join(arr, separator = ', ') {
  return arr.filter(function (n) { return n }).join(separator)
}

function geoToString (address) {
  return join([
    join([address.region_type, address.region], ' '),
    join([address.area_type, address.area], ' '),
    join([address.city_type, address.city], ' '),
    join([address.settlement_type, address.settlement], ' ')
  ])
}

function suggest (query) {
  const request = {
    'query': query,
    'count': 1
  }
  const params = {
    type: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Token ' + exports.TOKEN
    },
    data: JSON.stringify(request)
  }
  return $.ajax(exports.API_URL + '/suggest/address', params)
}

function suggestAddress (query) {
  const promise = $.Deferred()
  suggest(query).done((response) => {
    promise.resolve(response.suggestions && response.suggestions[0] || null)
  })
  .fail((jqXHR, textStatus, errorThrown) => {
    promise.reject(null)
  })
  return promise
}

exports.getAddressSuggestion = function (suggestions) {
  const promise = $.Deferred()
  suggestions.getGeoLocation()
    .done((address) => {
      const query = geoToString(address)
      suggestAddress(query).done((suggestion) => {
        promise.resolve(suggestion)
      })
      .fail(() => {
        promise.reject(null)
      })
    })
    .fail(() => {
      promise.reject(null)
    })
  return promise
}
