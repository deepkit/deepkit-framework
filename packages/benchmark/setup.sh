./node_modules/.bin/prisma generate --schema src/orm/end-to-end/sqlite/model.prisma
./node_modules/.bin/prisma migrate dev --schema=src/orm/end-to-end/sqlite/model.prisma --name=nope

../../node_modules/.bin/ts-node src/broker/broker-start-tcp-server.ts &
