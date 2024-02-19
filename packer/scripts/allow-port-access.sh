#!/bin/bash

# Allows Node.js to bind to ports lower than 1024
# Usage: allow-port-access.sh [username]
# If no arguments are provided, default username is used
#   Default username: csye6225

# Check if sudo is available
if ! sudo -v >/dev/null 2>&1; then
   echo "Installation requires sudo permissions" 
   exit 1
fi

echo "Allowing Node.js to bind to ports lower than 1024"

# Get username from the first argument or use 'csye6225' as default
username=${1:-csye6225}

# Get Path to Node.js for the user
node_path=$(sudo -u "$username" bash -c '. ~/.bashrc; which node')

# Allows node to bind to ports lower than 1024
if [ -z "$node_path" ]; then
    echo "User is not defined or Node.js is not installed for the user"
    exit 1
else
    sudo setcap cap_net_bind_service=+eip "$node_path"
fi

echo "Node.js is now allowed to bind to ports lower than 1024 for the user $username"
