# DripHosting Bot

В качестве пакетного менеджера используется [pnpm](https://pnpm.io/installation).

## Установка

Обязательные зависимости: sqlite3, node@23^

```console
pnpm install
```

После установки создайте .env файл в корне проекта

```env
BOT_TOKEN="<token>"
WEBSITE_URL="https://driphosting.com/"
SUPPORT_USERNAME_TG="drip_sup"
BOT_USERNAME="dridevdrivbot"
```

## Сборка проекта и запуск

```console
pnpm build
```

Собранный проект будет лежать в папке dist, его остаётся запустить

```console
pnpm start
```
