const { writeFileSync } = require('fs');
const pkgPath = './package.json';
const pkg = require(pkgPath);

pkg.type = process.argv[2];

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));