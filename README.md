# @particular./sync-moltin-to-shipengine

[![npm version](https://img.shields.io/npm/v/@particular./sync-moltin-to-shipengine.svg)](https://www.npmjs.com/package/@particular./sync-moltin-to-shipengine) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier) [![CircleCI](https://img.shields.io/circleci/project/github/uniquelyparticular/sync-moltin-to-shipengine.svg?label=circleci)](https://circleci.com/gh/uniquelyparticular/sync-moltin-to-shipengine)

> Create ShipEngine shipment and send label when an order is paid/captured in Moltin

Asynchronous microservice that is triggered by [moltin](https://moltin.com) webhooks to create a [ShipEngine](https://www.shipengine.com) shipment.

Built with [Micro](https://github.com/zeit/micro)! 🤩

## 🛠 Setup

Both a [moltin](https://moltin.com) _and_ [ShipEngine](https://www.shipengine.com) account are needed for this to function.

Create a `.env` at the project root with the following credentials:

```dosini
MOLTIN_CLIENT_ID=
MOLTIN_CLIENT_SECRET=
MOLTIN_WEBHOOK_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
EMAIL_FROM=
SHIPENGINE_PRIVATE_KEY=

```

Find your `MOLTIN_CLIENT_ID` and `MOLTIN_CLIENT_SECRET` inside of your [moltin Dashboard](https://dashboard.moltin.com)'s API keys.

`MOLTIN_WEBHOOK_SECRET` can be anything you want.

Create a key to use for `SHIPENGINE_PRIVATE_KEY` inside of your [ShipEngine Portal](https://app.shipengine.com/#/portal/apimanagement) under `API Management` > `API Keys` > `Create New Key`.

## 📦 Package

Run the following command to build the app

```bash
yarn install
```

Start the development server

```bash
yarn dev
```

The server will typically start on PORT `3000`, if not, make a note for the next step.

Start ngrok (change ngrok port below from 3000 if yarn dev deployed locally on different port above)

```bash
ngrok http 3000
```

Make a note of the https `ngrok URL` provided.

## ⛽️ Usage

Next head over to the [moltin Webhook Settings](https://dashboard.moltin.com/app/settings/integrations) area, add a new integration (`Settings > Integrations` and click `Create`).

Enter any name and description for your Integration. Moltin recommends you prefix the name with `DEVELOPMENT:` for any testing.

Next, enter the `ngrok URL` from above and `MOLTIN_WEBHOOK_SECRET` that you saved inside `.env`.

![URL and Secret Key](https://user-images.githubusercontent.com/950181/52846929-ca957980-3102-11e9-9a20-23b8139767ee.png)

Now finally you'll want to configure what Moltin Observables will cause this webhook to be invoked. In this example we want to monitor the `Order` observable and select the `Paid/Captured` box.

![Observes selection](https://user-images.githubusercontent.com/950181/52851227-76dc5d80-310d-11e9-9dff-70b7daaf21e8.png)

Click Save to register your new Webhook with Moltin.

## 🚀 Deploy

You can easily deploy this function to [now](https://now.sh).

_Contact [Adam Grohs](https://www.linkedin.com/in/adamgrohs/) @ [Particular.](https://uniquelyparticular.com) for any questions._
