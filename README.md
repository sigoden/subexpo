# subexpo

Block explorer for Substrate based chain 

## Development

- Prepare type.js
```
const { typesBundleForPolkadot  } = require("<your type defintions package>");
module.exports = { typesBundle: typesBundleForPolkadot };
```

- Start Harvester
```
yarn
docker-compose up -d
yarn prisma db push
yarn dev
```

- Start Ui
```
cd ui
yarn build
yarn start
```