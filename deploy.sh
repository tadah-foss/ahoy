#!/bin/bash

while getopts n:w:t: flag
do
  case "${flag}" in
    n) nginx_path=${OPTARG};;
    w) www_path=${OPTARG};;
    t) tadah_path=${OPTARG};;
  esac
done

log_start ()
{
  echo "$1_STARTED=$(date +%s)" 
}

log_end ()
{
  echo "$1_ENDED=$(date +%s)"
}

compose ()
{
  docker compose --ansi never --env-file $1/.env --file $1/production/docker-compose.yml --project-name tadah ${*:2}
}

cd $tadah_path

echo "Pulling latest code from repository..." && git pull

log_start MIX

echo "Updating NPM packages..." && sudo npm ci
echo "Running Laravel Mix..." && sudo npm run production

log_end MIX

log_start BUILD

echo "Building Tadah..." && compose $tadah_path build --progress plain app

log_end BUILD

log_start DOWNTIME

echo "Killing Tadah..." && compose $tadah_path stop app

echo "Adding maintenance page..."
sudo rm $nginx_path/sites-enabled/tadah.rocks $nginx_path/sites-available/tadah.rocks
sudo rm -rfv $www_path/maintenance/*
sudo cp -R $tadah_path/production/maintenance/public/. $www_path/maintenance
sudo sed -i "s/__STARTED__/$(date +%s)/" $www_path/maintenance/index.html
sudo cp $tadah_path/production/maintenance/nginx.conf $nginx_path/sites-available/tadah.rocks
sudo ln -s /etc/nginx/sites-available/tadah.rocks /etc/nginx/sites-enabled/tadah.rocks
sudo service nginx reload

echo "Adding newest NGINX snippets..." && sudo cp -R $tadah_path/production/snippets/. $nginx_path/snippets

echo "Fixing storage permissions..." && sudo chmod 777 -R storage
echo "Starting Tadah..." && compose $tadah_path up -d --no-color --no-deps app

echo "Removing maintenance page..."
sudo rm $nginx_path/sites-enabled/tadah.rocks $nginx_path/sites-available/tadah.rocks
sudo rm -rfv $www_path/maintenance/*

echo "Loading latest Tadah NGINX configuration..."
sudo cp $tadah_path/production/nginx.conf $nginx_path/sites-available/tadah.rocks
sudo ln -s /etc/nginx/sites-available/tadah.rocks /etc/nginx/sites-enabled/tadah.rocks
sudo service nginx reload

log_end DOWNTIME

echo "Tadah deploy completed!"