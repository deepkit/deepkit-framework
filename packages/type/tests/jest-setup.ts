// Fix Jest BigInt serialization issue
// Jest workers can't serialize BigInt when sending test results
if (typeof BigInt === 'function' && !BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}
