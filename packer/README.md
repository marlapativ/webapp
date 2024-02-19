# CSYE6225 Webapp server - Custom Machine Image generation using Packer

This repository directory contains configurations and scripts to build a custom machine image (GCP) using Packer.

## Installing Packer

To install Packer, follow these steps:

1. Go to the [Packer website](https://www.packer.io/downloads).
2. Download the appropriate version for your operating system.
3. Extract the downloaded archive to a directory included in your system's PATH.
4. Verify the installation by running `packer --version` in your terminal.

## Initializing Packer

Before building the image, you need to initialize Packer. This step ensures that Packer can detect and use the required plugins.

To initialize Packer, run the following command in your terminal:

        packer init ./packer/image.pkr.hcl

## Building the Image

Once Packer is initialized, you can build the custom image using the provided `.hcl` file.

To build the image, run the following command in your terminal:

        packer build -color=false -var 'project_id=YOUR_PROJECT_ID' ./packer/image.pkr.hcl

Replace `YOUR_PROJECT_ID` with your actual GCP project ID.

## Understanding the .hcl File

The `image.pkr.hcl` file contains the configuration for building the custom GCP image. Here's a brief overview of what it does:

- **packer block**: Specifies required plugins, in this case, `googlecompute`.
- **Variables**: Define various variables used in the configuration, such as project ID, zone, disk size, etc.
- **source "googlecompute" block**: Defines the source image and parameters for the Google Compute Engine instance.
- **build block**: Specifies the sequence of steps to provision the instance and prepare it for creating an image. It includes shell and file provisioners to execute scripts and transfer files.
  
  - **file provisioners**: Transfer files to the instance.
  - **shell provisioners**: Execute shell commands on the instance.

  The shell provisioners in this configuration does the following

  1. `install-dependencies.sh`
        - Install the dependencies required to run the web server.
  2. `create-user.sh`
        - Creates user to host the web application with
  3. `allow-port-access.sh`
        - Allow Node.js(non-root) user to bind to ports lower than 1024
  4. `setup-webapp.sh`
        - Copy the web application & config to proper hosting locations as well as update permissions
  5. `setup-systemd.sh`
        - Copies the webapp systemd service to proper location and reloads the systemctl daemon
  6. `db/install-db.sh` (Optional)
        - Installs Postgresql 16 server on to the machine
  7. `db/setup-db.sh` (Optional)
        - Sets up a non-default database for the newly created user
