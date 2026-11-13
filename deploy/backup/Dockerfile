# The daily off-machine copy of the book (TODO-02). Small on purpose: SQLite's own backup, rclone to send
# it (R2 speaks the S3 protocol), and busybox cron to keep the hour.
FROM alpine:3.20

RUN apk add --no-cache sqlite rclone tzdata ca-certificates && touch /etc/rclone.conf

# The remote is configured from the environment only (RCLONE_CONFIG_<NAME>_*); no credential in a file.
ENV RCLONE_CONFIG=/etc/rclone.conf

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Unhealthy when the last good copy is older than 26 hours (a day plus margin), or there is none.
HEALTHCHECK --interval=10m --timeout=10s --start-period=5m --retries=1 \
  CMD find /state/last-success -mmin -1560 | grep -q . || exit 1

ENTRYPOINT ["/usr/local/bin/backup.sh"]
CMD ["schedule"]
