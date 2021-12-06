# subexpo

Block explorer for Substrate based chain 

## Development

- Create .env
```
DATABASE_URL="mysql://root:pass@localhost:3306/subexpo"
ENDPOINT="ws://localhost:9944"
```

copy .env to ui/.env

- Create type.js
```
const { typesBundleForPolkadot  } = require("<your type defintions package>");
module.exports = { typesBundle: typesBundleForPolkadot };
```
> Don't forget to install your package `npm i <your type defintions package>`

- Start Scanner
```
yarn
docker-compose up -d
yarn prisma db push
yarn dev
```

- Start UI
```
cd ui
yarn
yarn build
yarn start
```