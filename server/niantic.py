import pokemon_pb2
import requests
import struct
import time

from requests.adapters import ConnectionError
from requests.models import InvalidURL
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from google.protobuf.internal import encoder
from google.protobuf.message import DecodeError
from s2sphere import CellId, LatLng

import auth
import log
logger = log.configure_logger(__name__)


API_URL = 'https://pgorelease.nianticlabs.com/plfe/rpc'
TIMEOUT = 3.1

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

def get_neighbors(lat, lon):
    origin = CellId.from_lat_lng(
        LatLng.from_degrees(lat, lon)).parent(15)
    walk = [origin.id()]

    next = origin.next()
    prev = origin.prev()
    for i in range(10):
        walk.append(prev.id())
        walk.append(next.id())
        next = next.next()
        prev = prev.prev()
    return walk


def f2i(float):
    return struct.unpack('<Q', struct.pack('<d', float))[0]


def encode(cellid):
    output = []
    encoder._VarintEncoder()(output.append, cellid)
    return ''.join(output)


class Session:

    def __init__(self):
        self.session = requests.session()
        self.session.headers.update({'User-Agent': 'Niantic App'})
        self.session.verify = False

    def post(self, url, data):
        return self.session.post(url, data, verify=False, timeout=TIMEOUT)


class Niantic:

    def __init__(self):
        self.access_token = auth.get_token()
        self.api_endpoint = None
        self.profile = None
        self.session = Session()

    def connect(self, tries=3):
        if tries == 0 and not self.profile:
            raise Exception('Niantic: failed to connect')
        self.profile = None
        profile = self.request_profile((0,0), None)
        if not profile.unknown2:
            self.access_token = auth.refresh_token(self.access_token)
            self.connect(tries - 1)
        else:
            self.profile = profile
            if profile.api_url:
                self.api_endpoint = 'https://%s/rpc' % profile.api_url

    def refresh_profile(self):
        self.profile = self.request_profile((0,0), None)
        return self.profile

    def heartbit(self, location):
        (lat, lon) = location
        logger.debug('---- heartbit {} {}'.format(lat, lon))
        m4 = pokemon_pb2.RequestEnvelop.Requests()
        m = pokemon_pb2.RequestEnvelop.MessageSingleInt()
        m.f1 = int(time.time() * 1000)
        m4.message = m.SerializeToString()
        m5 = pokemon_pb2.RequestEnvelop.Requests()
        m = pokemon_pb2.RequestEnvelop.MessageSingleString()
        m.bytes = '05daf51635c82611d1aac95c0b051d3ec088a930'
        m5.message = m.SerializeToString()
        walk = sorted(get_neighbors(lat, lon))
        m1 = pokemon_pb2.RequestEnvelop.Requests()
        m1.type = 106
        m = pokemon_pb2.RequestEnvelop.MessageQuad()
        m.f1 = ''.join(map(encode, walk))
        m.f2 = "\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000"
        m.lat = f2i(lat)
        m.long = f2i(lon)
        m1.message = m.SerializeToString()
        response = self.request_profile(
                               location,
                               self.profile.unknown7,
                               m1,
                               pokemon_pb2.RequestEnvelop.Requests(),
                               m4,
                               pokemon_pb2.RequestEnvelop.Requests(),
                               m5, )

        try:
            payload = response.payload[0]
        except (AttributeError, IndexError):
            return

        heartbeat = pokemon_pb2.ResponseEnvelop.HeartbeatPayload()
        heartbeat.ParseFromString(payload)
        return heartbeat

    def request_profile(self, location, useauth, *reqq):
        req = pokemon_pb2.RequestEnvelop()
        req1 = req.requests.add()
        req1.type = 2
        if len(reqq) >= 1:
            req1.MergeFrom(reqq[0])

        req2 = req.requests.add()
        req2.type = 126
        if len(reqq) >= 2:
            req2.MergeFrom(reqq[1])

        req3 = req.requests.add()
        req3.type = 4
        if len(reqq) >= 3:
            req3.MergeFrom(reqq[2])

        req4 = req.requests.add()
        req4.type = 129
        if len(reqq) >= 4:
            req4.MergeFrom(reqq[3])

        req5 = req.requests.add()
        req5.type = 5
        if len(reqq) >= 5:
            req5.MergeFrom(reqq[4])
        return self.do_request(location, req, useauth=useauth)

    def do_request(self, location, *args, **kwargs):
        (lat, lon) = location
        p_req = pokemon_pb2.RequestEnvelop()
        p_req.rpc_id = 1469378659230941192

        p_req.unknown1 = 2

        (p_req.latitude, p_req.longitude, p_req.altitude) = \
            (f2i(lat), f2i(lon), 0)

        p_req.unknown12 = 989

        if 'useauth' not in kwargs or not kwargs['useauth']:
            p_req.auth.provider = self.access_token.provider
            p_req.auth.token.contents = self.access_token.value
            p_req.auth.token.unknown13 = 14
        else:
            p_req.unknown11.unknown71 = kwargs['useauth'].unknown71
            p_req.unknown11.unknown72 = kwargs['useauth'].unknown72
            p_req.unknown11.unknown73 = kwargs['useauth'].unknown73

        for arg in args:
            p_req.MergeFrom(arg)

        protobuf = p_req.SerializeToString()

        url = self.api_endpoint or API_URL
        r = self.session.post(url, protobuf)

        p_ret = pokemon_pb2.ResponseEnvelop()
        p_ret.ParseFromString(r.content)
        return p_ret
