#!/bin/sh
# Usage: ./set-domain.sh https://www.example.com   (replaces the placeholder in every file)
[ -z "$1" ] && { echo "usage: $0 https://your-domain"; exit 1; }
sed -i "s#https://YOUR-DOMAIN.com#${1%/}#g" index.html robots.txt sitemap.xml vercel.json
