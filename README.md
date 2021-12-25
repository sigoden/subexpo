# subexpo

Block explorer for Substrate based chain 

## Development

### Run Scanner

1. Put your chain's types.json to `scanner` folder
2. Refer to `.env-example` to write `scanner/.env`
3. Run `yarn` to install dependencies 
4. Run `yarn sql` to setup prisma
4. Run `yarn dev` to start scanner

### Run UI

1. Copy `scanner/.env` to `ui/.env`
2. Run `yarn` to install dependencies 
3. Run `yarn gen` to setup prisma
4. Run `yarn dev` to start ui


## Deployment

```yaml
  scanner:
    image: sigoden/subexpo-scanner:dev
    container_name: scanner
    restart: always
    volumes: 
      - ./types.json:/app/types.json
    environment: 
    - DATABASE_SYNC=true
    - DATABASE_URL=mysql://root:pass@mysql:3306/subexpo
    - ENDPOINT=ws://chain:9944
    - ENDPOINT_RPC=http://chain:9933

  ui:
    image: sigoden/subexpo-ui:dev
    container_name: ui
    ports:
      - 4000:4000
    restart: always
    environment: 
    - DATABASE_URL=mysql://root:pass@mysql:3306/subexpo
    - ENDPOINT=ws://chain:9944
```

## License

[MIT](./LICENSE)