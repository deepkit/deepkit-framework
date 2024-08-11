## Setup development environment in Ubuntu

### Step 1: Install `libpq5` and `libpq-dev`

1. **Update your package lists**:

   Open a terminal and run:
   ```bash
   sudo apt update
   ```

2. **Install the packages**:

   Run the following command to install `libpq5` and `libpq-dev`:
   ```bash
   sudo apt install libpq5 libpq-dev
   ```

### Step 2: Set Python to refer to Python 2

Since Python 2 is deprecated and might not be installed by default on newer systems, you'll need to ensure it is installed and set up correctly.

1. **Install Python 2**:

   If Python 2 is not installed, you can install it using:
   ```bash
   sudo apt install python2
   ```

2. **Check if Python 2 is installed**:

   Verify the installation by running:
   ```bash
   python2 --version
   ```

   You should see something like:
   ```
   Python 2.7.x
   ```

3. **Update the `python` command to refer to Python 2**:

   You might need to update the alternatives system to make `python` point to `python2`. Here’s how you can do that:

- **Check current alternatives**:
  ```bash
  ls -l /usr/bin/python
  ```

- **Set `python` to point to `python2`**:

  If `/usr/bin/python` points to Python 3, you can update it using the alternatives system:

  ```bash
  sudo update-alternatives --install /usr/bin/python python /usr/bin/python2 1
  ```

- **Verify**:

  Check again to ensure that `python` now refers to Python 2:
  ```bash
  python --version
  ```

  It should display:
  ```
  Python 2.7.x
  ```

### Step 3: Install Node

Refer to [node.js download](https://nodejs.org/en/download) for options on how to install node.
