const zmq = require("zeromq")

export async function run() {
    const sock = new zmq.Reply

    await sock.bind("ipc:///tmp/zero.sock")

    for await (const [msg] of sock) {
        await sock.send(msg)
    }
}

run();