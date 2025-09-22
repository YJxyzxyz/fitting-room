from __future__ import annotations

import logging
from logging import Logger


def get_logger(name: str) -> Logger:
    logger = logging.getLogger(name)
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
    return logger
