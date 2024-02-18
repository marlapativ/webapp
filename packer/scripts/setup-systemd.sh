#!/bin/bash

# Copy the systemd to appropriate location
# Usage: setup-systemd.sh [systemd_service_name] [systemd_service_file_path]
#   systemd_service_name: Name of the systemd service file
#   systemd_service_directory: Directory where the systemd service file is located
# If no arguments are provided, default values are used
#   Default systemd_service_name: csye6225-webapp.service
#   Default systemd_service_file_path: /tmp/setup/

# Check if sudo is available
if ! sudo -v >/dev/null 2>&1; then
   echo "Installation requires sudo permissions" 
   exit 1
fi

default_system_dir="/etc/systemd/system/"
systemd_service_name=${1:-csye6225-webapp.service}
systemd_service_file_path=${2:-/tmp/setup/}
systemd_service_file="$systemd_service_file_path$systemd_service_name"

echo "Copying systemd service file to $default_system_dir from $systemd_service_file"

sudo cp "$systemd_service_file" "$default_system_dir"
sudo systemctl daemon-reload
sudo systemctl enable "$systemd_service_name"
