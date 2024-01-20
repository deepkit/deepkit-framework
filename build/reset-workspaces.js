// modify package.json and remove all workspaces.
// this is so that we install only root packages in the CI pipeline.
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

delete packageJson.workspaces;

// write package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
