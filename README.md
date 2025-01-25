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

### Webhooks

> Работает не стабильно

Вы можете также включить режим Webhook, чтобы телеграм отправлял информацию о каком либо обновлении а не клиент бесконечно запрашивал информацию.

[Подробнее об этом написанно здесь](https://grammy.dev/guide/deployment-types#comparison)

> Важно убедитесь, что ваш web-сервер настроенн с подключённым SSL сертификатом.

Просто добавьте это в .env файл

```
IS_WEBHOOK="https://<url>/"
PORT_WEBHOOK="3002"
```

## Сборка проекта и запуск

```console
pnpm build
```

Собранный проект будет лежать в папке dist, его остаётся запустить

```console
pnpm start
```
