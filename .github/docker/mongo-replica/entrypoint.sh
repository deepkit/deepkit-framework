#!/bin/bash
set -e

# Start MongoDB in background with replica set
mongod --replSet rs0 --bind_ip_all &
MONGOD_PID=$!

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to start..."
until mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
  sleep 1
done

# Initialize replica set
echo "Initializing replica set..."
mongosh --quiet --eval "
  try {
    rs.status();
    print('Replica set already initialized');
  } catch (e) {
    rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]});
    print('Replica set initialized');
  }
"

# Wait for replica set to be ready
echo "Waiting for replica set to be ready..."
until mongosh --quiet --eval "rs.status().ok" 2>/dev/null | grep -q 1; do
  sleep 1
done

echo "MongoDB replica set ready"

# Keep container running with mongod in foreground
wait $MONGOD_PID
