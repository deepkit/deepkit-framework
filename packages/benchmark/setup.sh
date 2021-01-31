./node_modules/.bin/prisma generate --schema src/orm/end-to-end/sqlite/model.prisma
./node_modules/.bin/prisma migrate up --schema src/orm/end-to-end/sqlite/model.prisma --experimental -c

../../node_modules/.bin/ts-node src/broker/broker-start-tcp-server.ts &
