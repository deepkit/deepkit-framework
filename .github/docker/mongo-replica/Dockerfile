# MongoDB with auto-initialized single-node replica set
# Used for CI tests that require transactions support
ARG MONGO_VERSION=5
FROM mongo:${MONGO_VERSION}

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
