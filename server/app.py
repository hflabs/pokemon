import traceback
from flask import Flask, jsonify
# from flask_cors import CORS

import settings
import auth
from niantic import Niantic
from radar import Radar

import log
logger = log.configure_logger(__name__)


app = Flask(__name__)
# CORS(app)
auth.login_all()


@app.route("/")
def index():
    return "OK"


@app.route("/api/login-all")
def login_all():
    auth.login_all()
    return "OK"


@app.route("/api/data/<coords>")
def data(coords):
    niantic = Niantic()
    try:
        niantic.connect()
    except Exception as e:
        logger.error('%s: failed to connect: %s' % (coords, e))
        return ('Failed to connect', 500)
    radar = Radar(niantic)
    location = __parse_location(coords)
    if not location:
        return ('Invalid coordinates: %s' % coords, 400)
    try:
        data = radar.locate(location)
    except Exception as e:
        logger.error('%s: failed to locate: %s' % (coords, e))
        return ('Failed to locate', 500)
    return jsonify(pokemons=data.pokemons, gyms=data.gyms, pokestops=data.pokestops)


def __parse_location(coords):
    location = None
    try:
        (lat, lon) = coords.split(',')
        location = (float(lat), float(lon))
    except ValueError:
        pass
    return location


if __name__ == "__main__":
    app.run()
