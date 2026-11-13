#!/bin/sh
set -eu

# Railway монтирует volume от root. Подготавливаем только /data и сразу
# сбрасываем привилегии; сам сервер никогда не должен работать от root.
if [ "$(id -u)" -eq 0 ]; then
    chown 10001:10001 /data
    exec gosu 10001:10001 "$@"
fi

exec "$@"
