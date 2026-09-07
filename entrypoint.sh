#!/bin/sh
set -e

# Chromium precisa de um display virtual para rodar em modo "headed",
# pois o TSPD/Akamai da SEFAZ detecta e bloqueia navegadores headless.
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp &

export DISPLAY=:99
export SCRAPER_HEADED=true

exec npm start