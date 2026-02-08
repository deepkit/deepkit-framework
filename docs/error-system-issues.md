# Error Code System - Known Issues & Improvements

This document tracks known issues and planned improvements for the Deepkit error code system.

## Quick Reference

- **Verification:** Run `./scripts/verify-error-docs.sh` to check all error codes are documented
- **Documentation:** Each package has an `ERRORS.md` file documenting its error codes
- **Instructions:** See `CLAUDE.md` section "Error Code System" for how to add new errors

## Completed

- ✅ Created DeepkitError base class with code and docsUrl
- ✅ Migrated all packages to use error codes (25 packages)
- ✅ Created ERRORS.md documentation for all packages
- ✅ Created verification script `scripts/verify-error-docs.sh`
- ✅ Fixed constructor inheritance to pass code through chain (mongo, orm, injector, filesystem)
- ✅ Made `docsUrl` a computed getter (Critical #1) - fixes HttpError subclass URL issue
- ✅ Added null/undefined validation to `getPackageFromCode()` (Critical #2)
- ✅ Migrated ValidationError & SerializationError to extend DeepkitError (Major #3)
- ✅ Added `cause` support to BrokerLockError, BrokerCacheError, ConfigOptionNotFound, ConfigurationInvalidError, ItemNotFound, SessionClosedException, CircularDependencyException, ElementNotFoundException, FilesystemError and subclasses (Major #5)
- ✅ Verified all ERRORS.md files have proper descriptions (Audit)
- ✅ Confirmed all thrown error codes are documented; only DK-O300 (SessionClosedException) is defined but not yet thrown
- ✅ Added `SqlError` base class to @deepkit/sql (Minor #8) - enables catching all SQL errors semantically
- ✅ Added error code assertions to key tests (Minor #7) - covered DK-O001, DK-O010, DK-O020, DK-O100, DK-I010, DK-I030, DK-T200, DK-T300
- ✅ Standardized ERRORS.md format across all packages; improved template package error troubleshooting
- ✅ Added `toJSON()` method to DeepkitError for structured logging (Suggestion #10)
- ✅ Simplified HTTP error codes - removed redundant DK-H4xx/DK-H5xx codes; HTTP status codes speak for themselves
- ✅ Standardized constructor parameter order (Minor #4) - all base classes now use `(code, message, options?)`, leaf classes use `(message, options?)`
- ✅ Converted key `throw new Error()` to DeepkitError (Minor #6) - added 20+ new error codes for type, orm, and injector packages
- ✅ Fixed error code reuse - split DK-A007 into DK-A007 (Module Not Loaded) and DK-A008 (Module Already Imported)
