import logging
import logging.handlers

log_formatter = logging.Formatter('%(asctime)s %(levelname)s %(module)s %(message)s')

log_file_handler = logging.handlers.RotatingFileHandler('pokemon.log', maxBytes=1024*1024, backupCount=10)
log_file_handler.setLevel(logging.INFO)
log_file_handler.setFormatter(log_formatter)

log_console_handler = logging.StreamHandler()
log_console_handler.setLevel(logging.INFO)
log_console_handler.setFormatter(log_formatter)


def configure_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.addHandler(log_file_handler)
    logger.addHandler(log_console_handler)
    return logger
