# API Console Module Errors

## DK-ACM001: API console GUI not installed

**Message:** node_modules/@deepkit/api-console-gui not installed in {directory}

**Causes:**
- The `@deepkit/api-console-gui` package is not installed as a dependency
- The package was installed but `node_modules` was cleared or corrupted
- Using a package manager that did not properly install peer dependencies
- Running the application from a directory where the GUI package cannot be resolved

**Solution:**
Install the API console GUI package:

```bash
npm install @deepkit/api-console-gui
# or
yarn add @deepkit/api-console-gui
```

After installation, ensure the package exists in your `node_modules` directory. If using a monorepo or workspace setup, verify the package is hoisted correctly or available in the expected location.

---
