# ORM Browser Errors

## DK-OB001: ORM browser GUI not installed

**Message:** node_modules/@deepkit/orm-browser-gui not installed in {directory}

**Causes:**
- The `@deepkit/orm-browser-gui` package is not installed as a dependency
- The package was installed but `node_modules` was cleared or corrupted
- Using a package manager that did not properly install peer dependencies
- Running the application from a directory where the GUI package cannot be resolved

**Solution:**
Install the ORM browser GUI package:

```bash
npm install @deepkit/orm-browser-gui
# or
yarn add @deepkit/orm-browser-gui
```

After installation, ensure the package exists in your `node_modules` directory. If using a monorepo or workspace setup, verify the package is hoisted correctly or available in the expected location.

---
