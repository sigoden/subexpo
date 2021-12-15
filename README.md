# subexpo

Block explorer for Substrate based chain 

## Development

### Setup .env
setup .env follows .env.example
```
DATABASE_URL="mysql://root:pass@localhost:3306/subexpo"
ENDPOINT="ws://localhost:9944"
```

```
cp .env scanner/
cp .env ui/
```
### Start mysql

```sh
docker-compose up -d
cd scanner
yarn
yarn sql
```

### Start scanner
```
cd scanner
yarn
yarn gen
yarn dev
```

### Start ui
```
cd ui
yarn
yarn gen
yarn dev
```