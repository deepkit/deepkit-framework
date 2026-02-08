# Mongo Package Errors

## DK-MG001: Mongo Error

**Message:** (varies based on context)

**Causes:**
- A general MongoDB operation failed
- An unexpected error occurred during database communication
- The MongoDB driver encountered an internal error

**Solution:**
Check the error message for specific details. This is the base error class for all MongoDB-related errors. Look at the `mongoCode` property for the MongoDB-specific error code if available.

---

## DK-MG010: Mongo Connection Error

**Message:** (varies based on connection issue)

**Causes:**
- MongoDB server is not running or unreachable
- Network connectivity issues between application and MongoDB
- Invalid connection string or host/port configuration
- Firewall blocking the connection
- Authentication failed before connection could be established
- TLS/SSL certificate issues

**Solution:**
1. Verify MongoDB server is running: `mongosh` or `mongo` shell should connect
2. Check the connection string format: `mongodb://host:port/database`
3. Ensure network connectivity to the MongoDB host
4. Verify firewall rules allow connections on the MongoDB port (default: 27017)
5. Check MongoDB logs for connection rejection reasons
6. If using authentication, verify credentials are correct

---

## DK-MG020: Mongo Database Error

**Message:** (MongoDB server error message)

**Causes:**
- Invalid query syntax or operators
- Document validation failure
- Duplicate key violation on unique index
- Write concern error
- Authorization failure for the operation
- Collection or database does not exist
- Invalid BSON document structure

**Solution:**
1. Check the `mongoCode` property for the specific MongoDB error code
2. Review the error message for details about what failed
3. Common MongoDB error codes:
   - `11000`: Duplicate key error - check unique indexes
   - `13`: Unauthorized - verify user permissions
   - `26`: NamespaceNotFound - collection may not exist
4. Validate your query operators and document structure
5. Ensure the user has appropriate roles for the operation

---
