#!/usr/bin/env bash

#           .:.
#    :::  .:::::.    Droppy
#  ..:::..  :::      Made with love <3
#   ':::'   :::
#     '
# Droppy install.sh file
# This file is an ongoing WIP to add support for as many systems as possible.
# Please feel free to contribute to it as you need.


droppy_download () {
    DOWNLOAD_URL=$1
    TARGET_PATH=$2

    echo "Downloading: $DOWNLOAD_URL";
    echo " to: $DOWNLOAD_URL";

    if [ -x "$(command -v curl)" ]; then
        curl -o "$TARGET_PATH" "$DOWNLOAD_URL"
    elif [ -x "$(command -v wget)" ]; then
        wget -O "$TARGET_PATH" "$DOWNLOAD_URL"
    else
        echo "no download util found, please install curl or wget.";
        exit 1;
    fi
}

CONFIG_DIRECTORY_DEFAULT="/srv/droppy/config";
FILES_DIRECTORY_DEFAULT="/srv/droppy/files";

SYSTEMD_SERVICE="https://raw.githubusercontent.com/droppyjs/droppy/canary/examples/droppy.service"
INITD_SERVICE="https://raw.githubusercontent.com/droppyjs/droppy/canary/examples/droppy.init.d"
#LAUNCHCTL_SERVICE="https://raw.githubusercontent.com/droppyjs/droppy/canary/examples/com.droppyjs.plist"

VALID_PACKAGE_MANAGERS=( "yarn" "npm" "pnpm" )
VALID_SERVICE_MANAGERS=( "systemd" "initd" "none" )

echo ""
echo "           .:."
echo "    :::  .:::::.    Droppy Installer"
echo "  ..:::..  :::      Welcome to the droppy installer"
echo "   ':::'   :::      "
echo "     '"
echo ""

if ! [ -x "$(command -v node)" ]; then
    echo "Node not found!";
    read -p "Setup volta? (yes or no) [yes]: " install_volta
    install_volta=${install_volta:-"yes"}

    if [ $install_volta = "yes" ]; then
        droppy_download "https://get.volta.sh" "/tmp/volta"
        bash /tmp/volta
        . ~/.bashrc
        volta install node@14
        volta install yarn
        echo "";
        echo "All done! Moving on...";
        echo "";
    else
        echo "Please install node and try again.";
        exit 1;
    fi
fi

# Determine default package manger
if [ -x "$(command -v yarn)" ]; then
    PACKAGE_MANAGER_DEFAULT="yarn"
elif [ -x "$(command -v npm)" ]; then
    PACKAGE_MANAGER_DEFAULT="npm"
elif [ -x "$(command -v pnpm)" ]; then
    PACKAGE_MANAGER_DEFAULT="pnpm"
else
    echo "yarn, npm, and pnpm are not in your path.";
    exit 1;
fi

# Determine service manager
if [ -x "$(command -v systemd --version)" ]; then
    SERVICE_MANAGE_DEFAULT="systemd"
elif [ -x "$(command -v service)" ]; then
    SERVICE_MANAGE_DEFAULT="initd"
#elif [ -x "$(command -v launchctl)" ]; then
#    SERVICE_MANAGE_DEFAULT="launchctl"
#    # Mac has slightly different default paths
#    CONFIG_DIRECTORY_DEFAULT="/Library/Application Support/droppy/config"
#    FILES_DIRECTORY_DEFAULT="/Library/Application Support/droppy/files"
else
    SERVICE_MANAGE_DEFAULT="none"

fi


read -p "Config directory [$CONFIG_DIRECTORY_DEFAULT]: " config_directory
config_directory=${config_directory:-"$CONFIG_DIRECTORY_DEFAULT"}

read -p "Files directory [$FILES_DIRECTORY_DEFAULT]: " files_directory
files_directory=${files_directory:-"$FILES_DIRECTORY_DEFAULT"}

# Select a valid package manager
selected_package_manager=""
until [ "$selected_package_manager" != "" ]
do
    read -p "Package manager (yarn, npm, or pnpm) [$PACKAGE_MANAGER_DEFAULT]: " selected_package_manager
    selected_package_manager=${selected_package_manager:-"$PACKAGE_MANAGER_DEFAULT"}
    if [[ ! " ${VALID_PACKAGE_MANAGERS[@]} " =~ " ${selected_package_manager} " ]]; then
        echo "err: $selected_package_manager is not a valid option."
        selected_package_manager=""
    else
        package_manager="$selected_package_manager"
    fi
done


# Select a valid service manager
selected_service_manager=""
until [ "$selected_service_manager" != "" ]
do
    read -p "Service manager (none, systemd, or initd) [$SERVICE_MANAGE_DEFAULT]: " selected_service_manager
    selected_service_manager=${selected_service_manager:-"$SERVICE_MANAGE_DEFAULT"}
    if [[ ! " ${VALID_SERVICE_MANAGERS[@]} " =~ " ${selected_service_manager} " ]]; then
        echo "err: $selected_service_manager is not a valid option."
        selected_service_manager=""
    else
        service_manager="$selected_service_manager"
    fi
done


echo "";
echo "Will install droppy with:";
echo "- Config directory: $config_directory"
echo "- Files directory: $files_directory"
echo "- Package manager: $package_manager"
echo "- Service manager: $service_manager"
echo "";
echo "Starting installation in 3 seconds ...";
echo "";
sleep 3

if [ $package_manager = "yarn" ]; then
    echo "Installing with yarn ..."
    yarn global add @droppyjs/cli
elif [  $package_manager = "npm" ]; then
    echo "Installing with npm ..."
    npm install -g @droppyjs/cli
elif [  $package_manager = "pnpm" ]; then
    echo "Installing with pnpm ..."
    pnpm add -g @droppyjs/cli
else
    echo "unknown package manager $PACKAGE_MANAGER_DEFAULT";
    exit 1;
fi

if ! [ -x "$(command -v droppy)" ]; then
    echo "warning: droppy not found in your path?";
fi


if [ $service_manager = "systemd" ]; then
    droppy_download "$SYSTEMD_SERVICE" "/tmp/droppy.service.template"

    sed -i.bak -e  "s|$CONFIG_DIRECTORY_DEFAULT|$config_directory|g" /tmp/droppy.service.template
    sed -i.bak -e  "s|$FILES_DIRECTORY_DEFAULT|$files_directory|g" /tmp/droppy.service.template

    rm -f /tmp/droppy.service.template.bak

    echo "Moving /tmp/droppy.service.template to /lib/systemd/system/droppy.service"
    mv /tmp/droppy.service.template /lib/systemd/system/droppy.service

    systemctl enable droppy

    echo ""
    echo "Done!"
    read -p "Start droppy now? (yes/no) [yes]: " start_now
    start_now=${start_now:-"yes"}

    if [ $start_now = "yes" ]; then

        systemctl start droppy
    fi

elif [ $service_manager = "initd" ]; then

    droppy_download "$INITD_SERVICE" "/tmp/droppy.init.d.template"

    sed -i.bak -e  "s|$CONFIG_DIRECTORY_DEFAULT|$config_directory|g" /tmp/droppy.init.d.template
    sed -i.bak -e  "s|$FILES_DIRECTORY_DEFAULT|$files_directory|g" /tmp/droppy.init.d.template

    rm -f /tmp/droppy.init.d.template.bak

    echo "Moving /tmp/droppy.init.d.template to /etc/init.d/droppy"
    mv /tmp/droppy.init.d.template /etc/init.d/droppy

    chmod 755 /etc/init.d/droppy
    update-rc.d droppy defaults

    echo ""
    echo "Done!"
    read -p "Start droppy now? (yes/no) [yes]: " start_now
    start_now=${start_now:-"yes"}

    if [ $start_now = "yes" ]; then

        service droppy start

    fi

elif [ $service_manager = "launchctl-do-not-use" ]; then
    # WIP, do not use.

    sudo mkdir -p "$config_directory"
    sudo mkdir -p "$files_directory"

    sudo mkdir -p "/Library/Logs/droppy/"

    sudo sysadminctl -addUser droppy -home "$config_directory"
    sudo dscl . -append /Groups/droppy GroupMembership droppy
    sudo dscl . create /Groups/droppy RealName "Service and Support"
    sudo dscl . create /Groups/droppy passwd "*"
    sudo dscl . create /Groups/droppy gid 799

    sudo chown -R droppy:droppy "$files_directory"
    sudo chown -R droppy:droppy "$config_directory"
    sudo chown -R droppy:droppy "/Library/Logs/droppy/"

    touch /volta_mac;
    sudo chown -R droppy:droppy "/volta_mac"

    droppy_download "https://get.volta.sh" "/tmp/volta_mac"

    sudo chown -R droppy:droppy "/tmp/volta_mac"
    sudo -u droppy bash /tmp/volta_mac
    droppy=`sudo -u droppy which node`


    droppy_download "$LAUNCHCTL_SERVICE" "/tmp/com.droppy.plist.template"
    cp /Users/markhughes/Projects/droppy/examples/com.droppy.plist /tmp/com.droppy.plist.template

    sed -i.bak -e  "s|$CONFIG_DIRECTORY_DEFAULT|$config_directory|g" /tmp/com.droppy.plist.template
    sed -i.bak -e  "s|$FILES_DIRECTORY_DEFAULT|$files_directory|g" /tmp/com.droppy.plist.template
    sed -i.bak -e  "s|<string>droppy start|<string>$droppy start|g" /tmp/com.droppy.plist.template

#
    rm -f /tmp/com.droppy.plist.template.bak

    echo "Moving /tmp/com.droppy.plist.template to /Library/LaunchDaemons/com.droppy.plist"
    sudo mv /tmp/com.droppy.plist.template /Library/LaunchDaemons/com.droppy.plist

    sudo chown root /Library/LaunchDaemons/com.droppy.plist
    sudo chgrp wheel /Library/LaunchDaemons/com.droppy.plist

    sudo dscl localhost create /Local/Default/Groups/droppy
    sudo chmod o-w /Library/LaunchDaemons/com.droppy.plist



    sudo launchctl load -w /Library/LaunchDaemons/com.droppy.plist

else
    echo "no service found or used";
fi

droppy
