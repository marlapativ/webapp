#!/bin/bash

# Creates a user with nologin shell
# Usage: create-user.sh [username]
# If no arguments are provided, default username is used
#   Default username: csye6225

# Check if sudo is available
if ! sudo -v >/dev/null 2>&1; then
   echo "Installation requires sudo permissions" 
   exit 1
fi

# Get username from the first argument or use 'csye6225' as default
# Automatically creates a group with the same name as the username with nologin shell
username=${1:-csye6225}

echo "Creating user '$username'"

# Create user if it doesn't exist
if id "$username" &>/dev/null; then
    echo "User '$username' already exists."
else
    useradd -m -s /usr/sbin/nologin -U -d /home/"$username" "$username"
    echo "User '$username' created."
fi
