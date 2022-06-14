# OCW-Redeem-API

# Table of Contents

- Authors
- About
- How it keeps API secrets & Issuer Seeds safe
- Configuration

## Authors

- OnChainWhales
- OnChain Marketplace
- Cosmos Sales & Marketing

## About

This NodeJS application is used as a middleman between the OnChain Marketplace and XRPL/XUMM.

It's prime existence is to enable other NFT issuers ability to redeem their NFTS on the OnChainMarketplace while keeping their sensitive data safe.

This application listens to requests from OnChainWhales only, and communicates with the XRPL and XUMM to generate a payload with the redeemed NFT to be signed on XUMM. This payload is then forwarded to the OnChain Marketplace.

## How it keeps API secrets & Issuer Seeds safe

All of the sensitive information which you will specify in the .env file (explained in configuration section) is stored locally in your instance. OnChain Marketplace does not have access to the Issuer Seed, or any of your API tokens/secrets.

## Configuration

You will need to host your NodeJS somewhere. A cheap Virtual Server will do.

Also, you will need to edit the .env file and include your XUMM token/secret and your Issuer seed.

It is highly recommended to use a instance in Linux. A systemd service is recommended to ensure your application is running all the time.

Setting up the Systemd service requires you to enter the following command:

`touch /lib/systemd/system/ocw-redeem.service`
which will create the file that the service will be stored in, inside the file, paste the following inside it:

[Unit]

Description= OCW Redeem App

After=network.target

[Service]

EnvironmentFile=`path to your .env file`

Type=simple

User=`your linux user`

ExecStart=/usr/bin/node `path to your app.js`

Restart=on-failure

[Install]

WantedBy=multi-user.target