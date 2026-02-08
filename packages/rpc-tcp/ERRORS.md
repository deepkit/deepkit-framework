# RPC TCP Errors

## DK-RT001: Could not start broker server

**Message:** Could not start broker server: {error details}

**Causes:**
- The TCP port is already in use by another process
- Insufficient permissions to bind to the specified port (ports below 1024 require elevated privileges)
- The host address is not available or invalid
- Network interface issues preventing socket creation

**Solution:**
1. Check if another process is using the port: `lsof -i :{port}` or `netstat -an | grep {port}`
2. Try a different port number in your configuration
3. If using a port below 1024, run with elevated privileges or use a higher port
4. Ensure the host address exists and is bindable on your system
5. Check firewall rules that might block the port

---
