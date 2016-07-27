import datetime
import json
import os
import time
from s2sphere import Cell, CellId, LatLng

import log
import settings

logger = log.configure_logger(__name__)

full_path = os.path.realpath(__file__)
(path, filename) = os.path.split(full_path)
POKEMON_NAMES = json.load(open(path + '/pokemon.json'))


class RadarData:
    def __init__(self):
        self.pokemons = {}
        self.gyms = {}
        self.pokestops = {}

class Radar:
    def __init__(self, niantic):
        self.niantic = niantic
        self.data = None

    def locate(self, location):
        self.data = RadarData()
        (origin_lat, origin_lon) = location
        (lat, lon) = location
        logger.debug('{} {}: searching for pokemons...'.format(lat, lon))
        pos = 1
        (x, y) = (0, 0)
        (dx, dy) = (0, -1)
        steplimit = settings.STEP_LIMIT
        for step in range(steplimit):
            if -steplimit / 2 < x <= steplimit / 2 and -steplimit / 2 < y <= steplimit / 2:
                lat = x * 0.0025 + origin_lat
                lon = y * 0.0025 + origin_lon
            if x == y or (x < 0 and x == -y) or (x > 0 and x == 1 - y):
                (dx, dy) = (-dy, dx)
            (x, y) = (x + dx, y + dy)

            self.locate_step((lat, lon))

        logger.info('{} {}: found {} pokemons, {} pokestops, {} gyms'.format(
            lat, lon,
            len(self.data.pokemons), len(self.data.pokestops), len(self.data.gyms)))

        return self.data

    def locate_step(self, location):
        (lat, lon) = location
        origin = LatLng.from_degrees(lat, lon)
        parent = CellId.from_lat_lng(origin).parent(15)
        h = self.niantic.heartbit(location)
        hs = [h]

        for child in parent.children():
            latlng = LatLng.from_point(Cell(child).get_center())
            child_location = (latlng.lat().degrees, latlng.lng().degrees)
            hs.append(self.niantic.heartbit(child_location))

        visible = self.__parse_pokemons(hs)

        current_time_ms = int(round(time.time() * 1000))
        for poke in visible.values():
            pokeid = str(poke.pokemon.PokemonId)
            pokename = POKEMON_NAMES[pokeid]
            expires = poke.LastModifiedMs + poke.TimeTillHiddenMs

            self.data.pokemons[poke.SpawnPointId] = {
                "lat": poke.Latitude,
                "lng": poke.Longitude,
                "expires": expires,
                'expiresAfter': (expires - current_time_ms) / 1000,
                "id": poke.pokemon.PokemonId,
                "name": pokename
            }
        logger.debug('-- step {} {}: found {} pokemons, {} pokestops, {} gyms'.format(
            lat, lon,
            len(self.data.pokemons), len(self.data.pokestops), len(self.data.gyms)))

    def __parse_pokemons(self, hs):
        visible = {}
        seen = {}
        current_time_ms = int(round(time.time() * 1000))
        for hh in hs:
            try:
                for cell in hh.cells:
                    for wild in cell.WildPokemon:
                        pokemon_id = wild.SpawnPointId
                        expires = wild.LastModifiedMs + wild.TimeTillHiddenMs
                        if pokemon_id not in seen.keys() or (seen[pokemon_id] <= expires):
                            visible[pokemon_id] = wild
                        seen[pokemon_id] = expires
                    if cell.Fort:
                        for Fort in cell.Fort:
                            if Fort.Enabled == True:
                                if Fort.GymPoints:
                                    self.data.gyms[Fort.FortId] = {
                                        'team': Fort.Team,
                                        'lat': Fort.Latitude,
                                        'lon': Fort.Longitude,
                                        'points': Fort.GymPoints
                                    }
                                elif Fort.FortType:
                                    expires = 0
                                    if Fort.LureInfo.LureExpiresTimestampMs:
                                        expires = Fort.LureInfo.LureExpiresTimestampMs
                                    if expires != 0:
                                        self.data.pokestops[Fort.FortId] = {
                                            'lat': Fort.Latitude,
                                            'lon': Fort.Longitude,
                                            'expires': expires,
                                            'expiresAfter': (expires - current_time_ms) / 1000
                                        }
            except AttributeError:
                break
        return visible
