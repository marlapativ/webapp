#!/bin/bash

# Installs PostgreSQL if not installed
# Usage: install-db.sh


# Check if sudo is available
if ! sudo -v >/dev/null 2>&1; then
   echo "Installation requires sudo permissions" 
   exit 1
fi

echo "Installing PostgreSQL"

# Install PostgreSQL if not installed
if ! command -v psql &> /dev/null; then
    yum install -y postgresql-server
    export PGSETUP_INITDB_OPTIONS="--auth-host=trust";
    postgresql-setup initdb
    systemctl start postgresql
    systemctl enable postgresql
    echo "Installed PostgreSQL. Version:"
    postgres --version
else
    echo "PostgreSQL is already installed. Version:"
    postgres --version
fi
