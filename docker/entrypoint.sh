#!/bin/sh
# Prepares Spotweb from environment variables, then runs the given command.
#
#   DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD  database connection
#   PHP_TIMEZONE                                  PHP time zone (default Europe/Amsterdam)
#   SPOTWEB_RUN_UPGRADE=1                         create/upgrade the database schema at start
#   SPOTWEB_COOKIE_HOST                           optional cookie domain (leave empty for localhost)
set -eu
cd /var/www/html

: "${DB_HOST:=db}" "${DB_PORT:=3306}" "${DB_NAME:=spotweb}" "${DB_USER:=spotweb}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${PHP_TIMEZONE:=Europe/Amsterdam}"
export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD PHP_TIMEZONE

echo "date.timezone=${PHP_TIMEZONE}" > /usr/local/etc/php/conf.d/timezone.ini

# dbsettings.inc.php is generated on every start so the environment stays the source of truth.
php -r '
$s = [
    "engine" => "pdo_mysql",
    "host"   => getenv("DB_HOST"),
    "port"   => getenv("DB_PORT"),
    "dbname" => getenv("DB_NAME"),
    "user"   => getenv("DB_USER"),
    "pass"   => getenv("DB_PASSWORD"),
];
$out = "<?php\n";
foreach ($s as $k => $v) {
    $out .= "\$dbsettings[" . var_export($k, true) . "] = " . var_export($v, true) . ";\n";
}
file_put_contents("dbsettings.inc.php", $out);
'
chown root:www-data dbsettings.inc.php
chmod 640 dbsettings.inc.php

# Optional own settings; only written when the file does not exist (a mounted ownsettings.php wins).
if [ ! -e ownsettings.php ] && [ -n "${SPOTWEB_COOKIE_HOST:-}" ]; then
    php -r 'file_put_contents("ownsettings.php", "<?php\n\$settings[\"cookie_host\"] = " . var_export(getenv("SPOTWEB_COOKIE_HOST"), true) . ";\n");'
fi

# Wait for the database.
tries=0
until php -r '
try {
    new PDO("mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT").";dbname=".getenv("DB_NAME"), getenv("DB_USER"), getenv("DB_PASSWORD"));
} catch (Exception $e) {
    exit(1);
}'; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
        echo "Database ${DB_HOST}:${DB_PORT} is not reachable, giving up" >&2
        exit 1
    fi
    echo "Waiting for the database (${tries}/60)..."
    sleep 2
done

if [ "${SPOTWEB_RUN_UPGRADE:-0}" = "1" ]; then
    echo "Creating/upgrading the Spotweb database schema..."
    php bin/upgrade-db.php
fi
touch /tmp/spotweb-ready

exec "$@"
