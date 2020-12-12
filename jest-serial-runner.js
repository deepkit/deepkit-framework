const TestRunner = require('jest-runner');

class SerialRunner extends TestRunner.default {
    constructor(...attr) {
        super(...attr)
        this.isSerial = true
    }
}

module.exports = SerialRunner
