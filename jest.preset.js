const nxPreset = require('@nx/jest/preset').default;

module.exports = {
    ...nxPreset,
    testMatch: ['**/(*.)+(spec).[jt]s?(x)'],
};
