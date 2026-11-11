# Spotweb (this fork) on PHP + Apache.
FROM php:8.4-apache

# PHP extensions Spotweb needs: curl, dom, gettext, mbstring, xml, zip, zlib, gd, openssl
# (curl, dom, mbstring, xml, openssl and zlib are already part of the base image).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libfreetype-dev libjpeg62-turbo-dev libpng-dev libzip-dev libicu-dev libgmp-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" gd zip intl gmp pdo_mysql mysqli gettext opcache; \
    a2enmod rewrite headers; \
    apt-get clean

# Spotweb needs a lot of memory while retrieving; the time zone is set by the entrypoint.
# Errors are logged (docker logs), not printed into the page: some bundled libraries
# (for example mobiledetectlib) trigger PHP 8.4 deprecation notices, and printed output
# would break the headers/cookies of every request.
RUN { \
        echo 'memory_limit=512M'; \
        echo 'expose_php=Off'; \
        echo 'display_errors=Off'; \
        echo 'log_errors=On'; \
        echo 'error_reporting=E_ALL & ~E_DEPRECATED & ~E_STRICT'; \
        echo 'opcache.enable_cli=0'; \
    } > /usr/local/etc/php/conf.d/spotweb.ini; \
    sed -ri 's!(<Directory /var/www/>)!\1\n\tAllowOverride All!' /etc/apache2/apache2.conf

WORKDIR /var/www/html
COPY --chown=www-data:www-data . /var/www/html

COPY docker/entrypoint.sh /usr/local/bin/spotweb-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/spotweb-entrypoint && chmod +x /usr/local/bin/spotweb-entrypoint

ENTRYPOINT ["spotweb-entrypoint"]
CMD ["apache2-foreground"]
