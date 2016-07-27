import json
import random
import re
import requests
import sets
from gpsoauth import perform_master_login, perform_oauth

import settings
import log
logger = log.configure_logger(__name__)

TIMEOUT = 3.1

class AccessToken:
    def __init__(self, credentials, value):
        self.provider = credentials[0]
        self.username = credentials[1]
        self.password = credentials[2]
        self.value = value


class Google:
    ANDROID_ID = '9774d56d682e549c'
    APP = 'com.nianticlabs.pokemongo'
    CLIENT_SIG = '321187995bc7cdc2b5fc91b11a96e2baa8602c62'
    SERVICE = 'audience:server:client_id:848232511240-7so421jotr2609rmqakceuu1luuq0ptb.apps.googleusercontent.com'

    def __init__(self):
        pass

    def login(self, username, password):
        r1 = perform_master_login(username, password, Google.ANDROID_ID)
        r2 = perform_oauth(username,
                           r1.get('Token', ''),
                           Google.ANDROID_ID,
                           Google.SERVICE,
                           Google.APP,
                           Google.CLIENT_SIG, )
        token = r2.get('Auth')
        expire_time = r2.get('Expiry')
        return token


class Niantic:
    LOGIN_URL = 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize'
    LOGIN_OAUTH = 'https://sso.pokemon.com/sso/oauth2.0/accessToken'
    LOGIN_CLIENT_SECRET = 'w8ScCUXJQc6kXKw8FiOhd8Fixzht18Dq3PEVkUCP5ZPxtgyWsbTvWHFLm2wNY0JR'

    def __init__(self):
        pass

    def login(self, username, password):
        session = requests.session()
        session.verify = True
        head = {'User-Agent': 'niantic'}
        r = session.get(Niantic.LOGIN_URL, headers=head, timeout=TIMEOUT)
        jdata = json.loads(r.content)
        data = {
            'lt': jdata['lt'],
            'execution': jdata['execution'],
            '_eventId': 'submit',
            'username': username,
            'password': password[:15],
        }
        r1 = session.post(Niantic.LOGIN_URL, data=data, headers=head, timeout=TIMEOUT)
        ticket = re.sub('.*ticket=', '', r1.history[0].headers['Location'])
        data1 = {
            'client_id': 'mobile-app_pokemon-go',
            'redirect_uri': 'https://www.nianticlabs.com/pokemongo/error',
            'client_secret': Niantic.LOGIN_CLIENT_SECRET,
            'grant_type': 'refresh_token',
            'code': ticket,
        }
        r2 = session.post(Niantic.LOGIN_OAUTH, data=data1, timeout=TIMEOUT)
        access_token = re.sub('&expires.*', '', r2.content)
        access_token = re.sub('.*access_token=', '', access_token)

        if '-sso.pokemon.com' in access_token:
            return access_token
        else:
            raise Exception('Niantic login for %s failed' % username)

providers = {
    'google': Google(),
    'ptc': Niantic()
}

tokens = {}

def login(credentials):
    (provider, username, password) = credentials
    token_value = providers[provider].login(username, password)
    return AccessToken(credentials, token_value)


def login_all():
    logger.info('Logging in for all credentials')
    tokens.clear()
    for credentials in settings.CREDENTIALS.values():
        (provider, username, password) = credentials
        try:
            token = login(credentials)
            tokens[token.value] = token
            logger.info('Login successfull: (%s, %s, %s)' % (provider, username, password))
        except Exception as e:
            logger.error('Login failed: (%s, %s, %s): %s' % (provider, username, password, str(e)))


def get_token():
    return random.sample(tokens.values(), 1)[0]


def refresh_token(token):
    logger.info('Token needs refreshing: (%s, %s, %s)' % (token.provider, token.username, token.password))
    if token.value in tokens:
        del tokens[token.value]
        try:
            token.value = providers[token.provider].login(token.username, token.password)
            tokens[token.value] = token
            logger.info('Refreshed token: (%s, %s, %s)' % (token.provider, token.username, token.password))
            return token
        except Exception as e:
            logger.error('Failed to refresh token: (%s, %s, %s): %s' % (token.provider, token.username, token.password, str(e)))
            return get_token()
    else:
        return get_token()
