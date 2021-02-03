#!/bin/sh

patch --no-backup-if-mismatch -f -p0 < patches/panzoom-transform.patch || true
