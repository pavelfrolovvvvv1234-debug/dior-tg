-language-icon = 🇷🇺
-language-name = Русский

quoted-balance = <blockquote>Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
strong-balance = <strong>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</strong>

welcome = DiorHost • Абузоустойчивая Инфраструктура
 
 Покупка и управление услугами хостинга прямо в тг боте
 24/7 uptime • Абузостоустойчивость • Офшорность
 @diorhost
 
 {quoted-balance}


about-us = Мы предоставляем надежные и высокопроизводительные услуги, VDS выделенных серверов.

 Наша инфраструктура обеспечивает анонимность, безопасность данных и стабильную работу со скоростью до <strong>1 GBit/s</strong>.
 
 С нами вы получаете полный контроль над услугами, гибкие тарифы и круглосуточную поддержку профессионалов.

support = Мы всегда здесь, чтобы помочь! 🤝

 У вас есть вопросы? Идеи по улучшению нашего сервиса? Или предложения по сотрудничеству? Мы с радостью выслушаем вас!

 Напишите нашему саппорту прямо сейчас!

 <a href="https://dior.host/">Web Site</a> | <a href="tg://resolve?domain=diorhost">Support</a> | <a href="https://t.me/+C27tBPXXpj40ZGE6">Dior News</a>

support-message-template = Здравствуйте!
 У меня есть вопрос.

profile = ┠💻 1REG PROFILE
┃
┗✅ STATS:
    ┠ ID: {$userId}
    ┠ Status: {$userStatus}
    ┗ Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
    ┠ 
    ┠👤 Contacts:
    ┠ WHOIS data: {$whoisStatus}
    ┗ Почта: {$emailStatus}

Terms of service (https://telegra.ph/Pravila-i-Usloviya-ispolzovaniya-servisa-1REG-05-26) | Support (https://t.me/one_reg_talk) | 1REG News (https://t.me/+kOkatN8cTig1ZGRk)

button-purchase = 💳 Приобрести услугу
button-manage-services = 🛠 Управление услугами
button-personal-profile = 👤 Профиль
button-support = 🤝 Поддержка
button-about-us = 📖 О нас
button-change-locale = 🇷🇺 Сменить язык
button-ask-question = Задать вопрос
button-tp = Поддержка
button-deposit = 💸 Пополнить баланс
button-promocode = 🎁 Промокод
button-subscription = 🔐 Подписка
button-website = Web Site
button-support-profile = 🔔 Поддержка
button-dior-news = Dior News
button-contact-with-client = Связаться с клиентом
button-domains = 🌐 Bulletproof Domains
button-vds = 🖥 VPS/VDS
button-bundle-manage = 🚀 Infrastructure Bundle
bundle-manage-header = <strong>🚀 Infrastructure Bundle</strong>

    Услуги, купленные пакетом (домен + VPS):
bundle-manage-empty = У вас пока нет услуг по пакетам
button-dedicated-server = 🖥 Dedicated Server
button-balance = 💸 Баланс
button-standard = 🛡 Standard
button-bulletproof = ⚜️ Bulletproof
button-agree = ✅ Согласен
update-button = 🔄 Обновить

button-back = 🔙 Назад
button-change-percent = 📊 Изменить процент
button-close = ❌ Закрыть
button-open = ✅ Открыть
button-pay = ✅ Оплатить
button-pay-service = 💳 Оплатить
button-copy-ip = 📋 IP
button-copy-login = 📋 Логин
button-copy-password = 📋 Пароль
button-show-password = 👁 Показать пароль
button-hide-password = 🙈 Скрыть пароль

button-change-locale-en = 🇺🇸 English
button-change-locale-ru = 🇷🇺 Русский

select-language = Select interface language

button-go-to-site = Перейти на сайт
button-user-agreement = Пользовательское соглашение

button-send-promote-link = 📤 Отправить ссылку

button-any-sum = Любая сумма

promote-link = Ссылка была создана. Она будет активна в течение 6 часов.

admin-help = Доступные команды для Администратора:
 1. /promote_link - Создать ссылку для поднятия прав пользователя
 <blockquote>Эта ссылка позволит получить права модератора, после её создания она будет активна 6 часов.</blockquote>
 2. /users - Получить список пользователей и управление ими
 3. /domainrequests - Получить список запросов на регистрацию доменов
 4. /create_promo (название) (сумма) (кол-во использований) - Создание промокода
 5. /remove_promo (id) - Удаление промокода
 6. /showvds (userId) - Список VDS пользователя
 7. /removevds (vdsId) - Полное удаление VDS

link-expired = Срок действия ссылки истек
link-used = Ссылка уже была использована

promoted-to-moderator = Вы были повышенны до модератора
promoted-to-admin = Вы были повышенны до администратора
promoted-to-user = Вы были понижены до пользователя

admin-notification-about-promotion = Пользователь <a href="tg://user?id={$telegramId}">({$name})</a> - {$id} повышен до роли {$role}
admin-notification-topup = 💳 <strong>Пополнение баланса</strong>\nПокупатель: {$username}\nСумма: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $

-users-list = Список пользователей
-users-list-empty = Список пользователей пуст
-user-info = <strong>Панель управления пользователем</strong>

control-panel-users = {-users-list}

control-panel-about-user = {-user-info}

 ID: {$id}
 Username: {$usernameDisplay}
 Баланс: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Статус: {$statusLabel}
 Прайм подписка: {$primeStatusLabel}
 Уровень: {$userLevelLabel}

 💰 Финансы
 Баланс: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Общий депозит: {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Пополнений: {$topupsCount}
 Последний депозит: {$lastDepositStr}

 📊 Активность
 Активных услуг: {$activeServicesCount}
 Услуг всего: {$totalServicesCount}
 Тикетов: {$ticketsCount}
 Заказов: {$ordersCount}
 Дата регистрации: {DATETIME($createdAt, dateStyle: "long", timeStyle: "short")}
 Последняя активность: {$lastActivityStr}
 
-balance = Баланс
-id = ID
admin-user-status-active = Активен
admin-user-status-banned = Заблокирован
admin-prime-status-yes = Есть
admin-prime-status-no = Нет
admin-user-level-newbie = Новичок
admin-user-level-user = Пользователь
admin-user-level-admin = Админ
admin-date-format = {DATETIME($date, dateStyle: "medium", timeStyle: "short")}

sorting-by-balance = Сортировать по: {-balance}
sorting-by-id = Сортировать по: {-id}

sort-asc = 🔽
sort-desc = 🔼

# Admin Panel
button-admin-panel = ⚙️ Админ-панель
button-control-users = 👥 Управление пользователями
button-tickets = 🎫 Тикеты
button-promocodes = 🎟 Промокоды
button-automations = 📬 Сценарии и уведомления
button-statistics = 📊 Статистика
admin-automations-header = <strong>📬 Сценарии и уведомления</strong>
admin-automations-description = Включите/выключите сценарии. Полная настройка — в веб-панели.
admin-automations-empty = Нет сценариев. Добавьте их через API или веб-панель.
admin-automations-web-hint = 🔗 Полная настройка триггеров, шаблонов и офферов — по кнопке ниже.
admin-automations-open-web = 🌐 Открыть веб-панель
button-promos-create = ➕ Создать промокод
admin-statistics-header = 📊 Статистика по покупкам
admin-statistics-topups = Пополнений
admin-statistics-purchases = Покупок
admin-statistics-sum = Прибыль
admin-statistics-24h = За сутки
admin-statistics-7d = За 7 дней
admin-statistics-30d = За 30 дней
admin-statistics-all = За всё время
button-delete = 🗑 Удалить
admin-panel-header = <strong>⚙️ Админ-панель</strong>
admin-promoted-notification = Вам выдан статус администратора. Нажмите кнопку ниже или используйте команду /admin. В Профиле также появится кнопка «Админ-панель».
button-open-admin-panel = ⚙️ Открыть админ-панель

Выберите действие:
moderator-menu-header = <strong>Панель модератора</strong>

# Referrals
button-referrals = 💲 Рефералы
button-share-link = 📤 Поделиться ссылкой
referrals-screen = 🚀 Партнёрская программа DiorHost\n\nМонетизируйте свой трафик на VPS, дедиках и абузоустойчивых доменах.\n\n💰 Условия:\n\n• До 30% от каждого пополнения привлечённого клиента\n• Lifetime — процент со всех будущих оплат\n• Начисление при первом пополнении от $10+\n• Без ограничений по количеству рефералов\n• Автоматический учёт в системе\n\n🔗 Ваша реферальная ссылка:\n{$link}\n\nРефералов: {$count}\nЗаработано: {$profit} $\n\nПривлекайте трафик — получайте пассивный доход на инфраструктуре.
referrals-share-text = Присоединяйся ко мне на Dior Host! Используй мою реферальную ссылку, чтобы начать.

Выберите действие:

pagination-left = ⬅️
pagination-right = ➡️

block-user = 🚫 Заблокировать
unblock-user = ✅ Разблокировать

message-about-block = К сожалению вы заблокированы. Обратитесь в поддержку для уточнения причин блокировки.

button-buy = 💸 Приобрести 

domain-question = Введите домен (с зоной или без): example или example.com
domain-invalid = Введенный домен некорректен <i>{$domain}</i> попробуйте ещё раз
domain-not-available = 🚫 Домен <i>{$domain}</i>, уже занят. Попробуйте подобрать другой.
domain-available = ✅ Домен <i>{$domain}</i>, доступен для регистрации. Вы хотите его приобрести?
domain-registration-in-progress = 🔄 Регистрация домена <i>{$domain}</i> в процессе. (С вашего баланса списанны средства) За статусом можете следить в меню управления услугами

domains-manage = <strong>Управление доменами</strong>

empty = Пусто
list-empty = Список пуст

service-maintenance = Сейчас на техобслуживании. Попробуйте позже.

service-pay-message = <strong>Оплата услуги</strong>

Нажмите кнопку ниже для оплаты.

service-info-header = Информация об услуге
service-label-ip = IP-адрес
service-label-login = Логин
service-label-password = Пароль
service-label-os = ОС
service-label-status = Статус
service-label-created-at = Дата создания
service-label-paid-until = Оплачено до
service-date = {DATETIME($date, dateStyle: "medium", timeStyle: "short")}
status-active = Активен
status-suspended = Приостановлен
status-pending = Ожидает

domain-request-approved = Вы одобрили домен
domain-request-reject = Домен отклонён

domain-request-not-found = Запрос на создание не найден

domain-was-not-found = Домен не найден

domain-information = Домен <i>{$domain}</i>

 <strong>Дата истечения</strong>: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
 <strong>Продление домена</strong>: {DATETIME($paydayAt, dateStyle: "long", timeStyle: "short")}
 <strong>Стоимость продления</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 
 <i>📌 Продление осуществляется в автоматическом режиме, пожалуйста пополняйте баланс заранее</i>

 Для изменения NS или IP привязки обратитесь в тех-поддержку.

# Domain Registration Requests
domain-request = {$id}. <code>{$domain}</code> от пользователя ({$targetId}).
 <strong>Информация от пользователя:</strong>
 <blockquote>{$info}</blockquote>


domain-request-list-info = (/approve_domain &lt;id&gt; &lt;expire_at: 1год или 1г&gt; - одобрить, /reject_domain &lt;id&gt; - отклонить)
domain-request-list-header = <strong>Список запросов на регистрацию доменов:</strong>

domain-already-pending-registration = Домен уже приобретён дождитесь обработки заявки
domain-request-notification = Новый запрос на регистрацию доменов /domainrequests (Всего не обработаных заявок: {$count})
domain-cannot-manage-while-in-progress = Домен находится в ожидании регистрации дождитесь когда он станет доступен.
domain-registration-complete = ❗️ Для завершения покупки домена, пожалуйста, отправьте информацию о IP-адресе, к которому его нужно привязать, или укажите два NS-сервера через пробел ❗️
domain-registration-complete-fail-message-length = Информация слишком длинная попробуйте сделать текст меньше

deposit-money-enter-sum = Введите сумму пополнения
deposit-money-incorrect-sum = Введенная сумма некорректна

topup-select-method = Выберите способ оплаты
topup-select-amount = Выберите сумму пополнения
topup-method-manual = Ручное пополнение
topup-manual-support = Для ручного пополнения обратитесь в поддержку.
topup-manual-support-message = Хочу пополнить баланс на {$amount} $. Подскажите реквизиты, пожалуйста.
topup-manual-support-message-no-amount = Хочу пополнить баланс. Подскажите реквизиты, пожалуйста.
topup-manual-created = ✅ Создан запрос на ручное пополнение.
topup-cryptobot-not-configured = Crypto Pay (CryptoBot) не настроен. Добавьте PAYMENT_CRYPTOBOT_TOKEN в .env или выберите другой способ пополнения.
 
<blockquote>Сумма: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
Тикет: #{$ticketId}
deposit-money-is-so-low = Минимальная сумма пополнения 10$
deposit-success-sum = ✅ Отлично, теперь осталось только <u>оплатить</u> и мы начислим средства на ваш баланс.
 
 <blockquote>Сумма пополнения: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
 
 <strong>Выберите способ оплаты</strong>

payment-information = После оплаты подождите немного, система автоматически подтвердит оплату и средства автоматически поступят на ваш счёт, если же этого не произошло просим обратится в поддержку.
payment-next-url-label = Перейти к оплате
payment-await = Пожалуйста, подождите...
deposit-by-sum = Ваш счёт пополнен на {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
money-not-enough = Недостаточно средств на балансе, пополните его. (Не хватает: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $)
money-not-enough-go-topup = Не хватает {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $. Выберите способ пополнения:

invalid-arguments = Аргументы не корректны

promocode-already-exist = Промокод с этим названием уже существует
new-promo-created = Новый промокод добавлен /promo_codes - чтобы посмотреть
promocode = {$id} <strong>{$name}</strong> (Использований: {$use}/{$maxUses}) : {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
promocode-deleted = Промокод <strong>{$name}</strong> успешно удалён
promocode-not-found = Промокод не найден
promocode-not-exist = Такого промокода не существует
promocode-input-question = Введите промокод
promocode-used = Промокод успешно использован вам на баланс начисленно {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

menu-service-for-buy-choose = 📃 <strong>Выберите категорию услуг для приобретения</strong>

manage-services-header = 🛠 Управление услугами

vds-menu-select = Выберете интересующий вас тариф

vds-bulletproof-mode-button-on = Абузоустойчивые: ВКЛ
vds-bulletproof-mode-button-off = Абузоустойчивые: ВЫКЛ

vds-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $, {$cpu} ядер, {$ram} gb озу, {$disk} gb диск
dedicated-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $/мес, {$cpu} ядер / {$cpuThreads} потоков, {$ram} GB RAM, {$storage} GB

dedicated-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU (Cores/Threads): </strong> {$cpu} cores / {$cpuThreads} threads
 <strong>💾 RAM: </strong> {$ram} GB
 <strong>💽 Storage: </strong> {$storage} GB
 <strong>🚀 Network: </strong> {$network} Gbps
 <strong>🛜 Bandwidth: </strong> {$bandwidth}

 <strong>OS: </strong> {$os}

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ / month

bulletproof-on = ✅ Абузоустойчивый тариф
bulletproof-off = ⚠️ Это не абузоустойчивый тариф
unlimited = Безлимитный


vds-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 Процессор (Ядра): </strong> {$cpu}
 <strong>💾 Оперативная память: </strong> {$ram} Гб
 <strong>💽 Диск (SSD/NVME): </strong> {$disk} Гб
 <strong>🚀 Скорость интернета: </strong> {$network} Мегабит/с
 <strong>🛜 Пропускная способность: </strong> Безлимитный

 <strong>ОС: </strong> Windows/Linux

 <strong>💰 Цена: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ / месяц

vds-os-select = <strong>Выберете ОС которая будет установлена</strong>


bad-error = Извините, это была ошибка с нашей стороны, сейчас мы ее исправляем.

vds-created = Машина создана за статусом можете следить в главном меню. > Управление услугами

vds-manage-title = Управление VDS
vds-manage-list-item = «{$rateName}» - {$ip} 🖥

vds-stopped = Машина выключена ⛔️
vds-work = Машина работает ✳️
vds-creating = Машина создаётся ⚠️

vds-current-info = <strong>Управление VDS</strong>

 <strong>Дата истечения</strong>: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
 <strong>Стоимость продления</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 
 {$abuse}
 
 <strong>«{$rateName}»</strong>
 <strong>🖥 Процессор (Ядра): </strong> {$cpu}
 <strong>💾 Оперативная память: </strong> {$ram} Гб
 <strong>💽 Диск (SSD/NVME): </strong> {$disk} Гб

 <strong>IP: </strong> {$ip}
 <strong>OS: </strong> {$osName}

 {$status}

 <i>📌 Продление осуществляется в автоматическом режиме, пожалуйста пополняйте баланс заранее</i>

 ❗️ Рекомендуем сменить пароль на самой машине и сохранить его в надёжном месте

vds-button-reinstall-os = 💿 Переустановить OS
vds-button-stop-machine = ⛔️ Выключить
vds-button-start-machine = ✳️ Включить
vds-button-regenerate-password = 🔁 Сменить пароль
vds-button-copy-password = ⤵️ Скопировать пароль

vds-new-password = Новый пароль: <tg-spoiler>{$password}</tg-spoiler>

vds-reinstall-started = Переустановка запущена, пожалуйста подождите. За статусом можете следить в > Управление услугами

dedicated-servers = Этот раздел скоро будет доступен, а пока вы можете ознакомится с выделенными машинами через ЛС в ТП.

vds-expiration = Ваша VDS Истекает. Пополните баланс на {$amount} $

no-vds-found = У пользовтеля нет купленных VDS

vds-info-admin = {$id}. {$ip} {$expireAt} - Цена продления {NUMBER($renewalPrice, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

vds-select-os-confirm = Вы выбрали {$osName}. Вы хотите продолжить?
vds-select-os-next = Продолжить

vds-removed = VDS удалена

vds-remove-failed = Удаление VDS с ID {$vdsId} не удалось

failed-to-retrieve-info = Ошибка получения информации о машине

await-please = Пожалуйста ожидайте...
demo-operation-not-available = Демо-услуга: операция недоступна

# Broadcast
button-broadcast = 📢 Рассылка
broadcast-enter-text = Введите текст сообщения для отправки всем пользователям:
broadcast-instructions = <strong>Рассылка</strong>
    Как запустить:
    1) Отправьте текст рассылки обычным сообщением в этот чат.
    2) Появится предпросмотр — нажмите «Отправить» или «Отмена».
    Альтернатива: /send ваш_текст
broadcast-preview = <strong>Предпросмотр:</strong>

{$text}

Отправить это сообщение всем пользователям?
button-send = ✅ Отправить
button-cancel = ❌ Отмена
button-confirm = ✅ Подтвердить
broadcast-cancelled = Рассылка отменена
broadcast-starting = Запуск рассылки {$id}...
broadcast-completed = <strong>Рассылка завершена</strong>
broadcast-stats = Всего: {$total} | Доставлено: {$sent} | Ошибки: {$failed} | Заблокировали: {$blocked}
# Промокоды (админ)
admin-promos-header = Промокоды
admin-promos-footer = Страница {$page} из {$total}
admin-promos-empty = Промокодов пока нет
admin-promos-delete-confirm = Удалить промокод <strong>{$code}</strong>?
admin-promos-enter-code = Введите название промокода (латиница, цифры, "-" или "_"):
admin-promos-invalid-code = Неверный формат промокода
admin-promos-enter-amount = Введите сумму скидки (число):
admin-promos-invalid-amount = Неверная сумма
admin-promos-enter-max-uses = Введите лимит активаций (число):
admin-promos-invalid-max-uses = Неверный лимит активаций
admin-promos-created = Промокод <strong>{$code}</strong> создан
admin-promos-updated = Промокод <strong>{$code}</strong> обновлён
admin-promos-not-found = Промокод не найден
admin-promos-edit-missing = Не выбран промокод для редактирования
admin-promos-edit-code = Введите новый код или /skip (текущий: {$code}):
admin-promos-edit-amount = Введите новую сумму или /skip (текущая: {$amount}):
admin-promos-edit-max-uses = Введите новый лимит или /skip (текущий: {$maxUses}):

Всего: {$total}
Отправлено: {$sent}
Ошибок: {$failed}
Заблокировано: {$blocked}
{$errors}

# Tickets
button-tickets-new = 🎫 Тикеты (НОВЫЕ)
button-tickets-in-progress = 🎫 Тикеты (В РАБОТЕ)
tickets-none-new = Нет новых тикетов
tickets-none-in-progress = Нет тикетов в работе
tickets-list-new = <strong>Новые Тикеты ({$count})</strong>
tickets-list-in-progress = <strong>Тикеты в Работе ({$count})</strong>
button-ticket-take = ✅ Взять
button-ticket-assign-self = 🟢 Назначить на себя
button-ticket-unassign = 🔄 Снять назначение
button-ticket-ask-user = ❓ Спросить пользователя
button-ticket-ask-clarification = 💬 Запросить уточнение
button-ticket-provide-result = ✅ Выдать результат
button-ticket-complete = ✅ Завершить
button-ticket-reject = ❌ Отклонить
ticket-taken = Тикет назначен на вас
ticket-unassigned = Назначение снято
ticket-status-new = 🟡 Новый
ticket-status-in_progress = 🔵 В работе
ticket-status-wait_user = 🟣 Ожидает клиента
ticket-status-done = 🟢 Завершён
ticket-status-rejected = 🔴 Отклонён
ticket-card-client = Клиент
ticket-card-created = Создан
ticket-card-responsible = Ответственный
ticket-card-responsible-none = —
ticket-card-title = Тикет #{$id}
ticket-card-status = Статус
ticket-card-description = Описание
ticket-card-balance = Баланс клиента
ticket-card-amount = Сумма запроса
ticket-description-empty = Описание не указано
ticket-description-requested = Пользователь запросил {$operation}.
error-ticket-not-found = Тикет не найден
error-ticket-already-taken = Тикет уже взят
ticket-ask-user-enter-question = Введите вопрос для пользователя:
ticket-question-from-moderator = <strong>Вопрос от модератора</strong>

Тикет #{ticketId}

{$question}
ticket-question-sent = Вопрос отправлен пользователю
ticket-provide-ip = Введите IP адрес:
ticket-provide-login = Введите логин:
ticket-provide-password = Введите пароль:
ticket-provide-panel-optional = Введите URL панели (опционально, нажмите /skip чтобы пропустить):
ticket-provide-notes-optional = Введите заметки (опционально, нажмите /skip чтобы пропустить):
ticket-provide-result-text = Введите текст результата:
ticket-result-provided = Результат предоставлен
ticket-result-received = <strong>Тикет #{ticketId} решён</strong>

{$result}
ticket-reject-enter-reason-optional = Введите причину отклонения (опционально):
ticket-rejected = <strong>Тикет #{ticketId} отклонён</strong>

Причина: {$reason}
ticket-rejected-by-moderator = Тикет отклонён
ticket-new-notification = <strong>Новый Тикет #{ticketId}</strong>

Пользователь: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Тип: {$type}
ticket-moderator-notification = <strong>Вам поступил тикет</strong>

Тикет #{ticketId}
Тип: {$type}
Пользователь: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
{$amountLine}
withdraw-notification-amount = Сумма: {$amount} $
ticket-type-dedicated_order = Заказ Dedicated
ticket-type-dedicated_reinstall = Переустановка ОС
ticket-type-dedicated_reboot = Перезагрузка
ticket-type-dedicated_reset = Сброс пароля
ticket-type-dedicated_power_on = Включение
ticket-type-dedicated_power_off = Выключение
ticket-type-dedicated_other = Другой запрос
ticket-type-manual_topup = Ручное пополнение
ticket-request-what = Что нужно сделать
ticket-request-server = Сервер

# Dedicated Servers
button-order-dedicated = 💳 Make Order
button-my-dedicated = 🖥 Dedicated
button-my-tickets = 🎫 Мои Запросы
dedicated-none = У вас нет выделенных серверов
dedicated-status-requested = <strong>Запрос Dedicated Сервера</strong>

Тикет #{ticketId}
Статус: {$status}

Пожалуйста, подождите пока модератор обработает ваш запрос.
dedicated-status-requested-no-ticket = <strong>Запрос Dedicated Сервера</strong>

Статус: REQUESTED

Пожалуйста, подождите пока модератор обработает ваш запрос.
dedicated-no-credentials = Данные для доступа к dedicated серверу ещё не доступны
dedicated-info = <strong>Мой Dedicated Сервер</strong>

<strong>IP:</strong> {$ip}
<strong>Логин:</strong> {$login}
<strong>Пароль:</strong> {$password}
<strong>Панель:</strong> {$panel}
<strong>Заметки:</strong> {$notes}
button-reinstall-os = 💿 Переустановить ОС
button-reboot = 🔄 Перезагрузить
button-reset-password = 🔑 Сбросить пароль
button-other-request = 📝 Другой запрос
button-dedicated-start = ✳️ Включить
button-dedicated-stop = ⛔️ Выключить
dedicated-order-enter-requirements = Введите ваши требования (CPU/RAM/SSD/Локация):
dedicated-order-enter-comment-optional = Введите дополнительный комментарий (опционально, нажмите /skip чтобы пропустить):
dedicated-order-created = <strong>Запрос отправлен модератору</strong>

Тикет #{ticketId}
Статус: {$status}
dedicated-order-success = <strong>Все успешно куплено</strong>

Тикет #{ticketId}

Если нужна помощь — напишите в поддержку.
dedicated-purchase-success = <strong>Ваш товар успешно приобретен</strong>

Пожалуйста свяжитесь с саппортом.
dedicated-operation-requested = <strong>Запрос отправлен в поддержку</strong>

 Операция: {$operation}
 Тикет #{$ticketId}. Ожидайте ответа модератора.
tickets-none-user = У вас нет тикетов
tickets-list-user = <strong>Мои Тикеты ({$count})</strong>
ticket-dedicated-ready = <strong>Ваш Dedicated Сервер Готов!</strong>

Тикет #{ticketId}

<strong>IP:</strong> {$ip}
<strong>Логин:</strong> {$login}
<strong>Пароль:</strong> {$password}
<strong>Панель:</strong> {$panel}
<strong>Заметки:</strong> {$notes}
button-view-ticket = Посмотреть Тикет

# Common
not-specified = Не указано
none = Нет
no-reason-provided = Причина не указана
error-access-denied = Доступ запрещён
error-invalid-context = Неверный контекст
error-unknown = Ошибка: {$error}
not-assigned = Не назначен
ticket-view = Просмотр тикета (placeholder - using inline)
ticket-user-view = Просмотр тикета пользователем (placeholder - using inline)
dedicated-operation-confirm = Подтверждение операции (placeholder - using inline)
dedicated-menu-header = <strong>Выделенные Серверы</strong>

Выберите опцию:
dedicated-location-select-title = Начните с выбора локации.
dedicated-os-select-title = После выбора операционной системы арендуется сервер.
dedicated-purchase-success-deducted = <strong>Покупка успешна.</strong> С вашего баланса списано {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $.
dedicated-contact-support-message = Для выдачи dedicated свяжитесь с нашей поддержкой.
button-go-to-support = Перейти в поддержку
support-message-dedicated-paid = Здравствуйте! Я оплатил услугу «{$serviceName}», локация: {$location}, ОС: {$os}. Можете выдать?
# Dedicated locations (таблица: Germany, NL/USA/Turkey)
dedicated-location-de-germany = 🇩🇪 Германия
dedicated-location-nl-amsterdam = 🇳🇱 Нидерланды
dedicated-location-usa = 🇺🇸 США
dedicated-location-tr-istanbul = 🇹🇷 Турция
# Dedicated OS (таблица: Win Server 2019/2025, Win11, Alma 8/9, CentOS 9, Debian 11/12/13, Ubuntu 22/24; или Любая на выбор)
dedicated-os-winserver2019 = Windows Server 2019
dedicated-os-winserver2025 = Windows Server 2025
dedicated-os-windows11 = Windows 11
dedicated-os-alma8 = AlmaLinux 8
dedicated-os-alma9 = AlmaLinux 9
dedicated-os-centos9 = CentOS 9
dedicated-os-debian11 = Debian 11
dedicated-os-debian12 = Debian 12
dedicated-os-debian13 = Debian 13
dedicated-os-ubuntu2204 = Ubuntu 22.04
dedicated-os-ubuntu2404 = Ubuntu 24.04
dedicated-os-os-any = Любая на выбор
button-return-to-main = Вернуться на главную
dedicated-not-active = Dedicated сервер не активен
dedicated-not-suspended = Dedicated сервер не выключен
dedicated-price-not-set = Цена для Dedicated не указана. Обратитесь в поддержку.
ticket-credentials-invalid = Неверные данные. Пожалуйста, укажите IP, логин и пароль.

# Withdraw Request
button-withdraw = 💸 Вывод средств
button-referral-stats = 📊 Статистика
referral-statistics-header = 📊 Статистика по рефералам
referral-stat-count = Количество рефералов: { $count }
referral-stat-reg2dep = Конверсия рефералов (REG2DEP): { $percent }%
referral-stat-avg-deposit = Средний депозит реферала: { $amount } $
referral-stat-percent = Реферальный процент: { $percent }%
referral-stat-active-30d = Активных рефералов за 30 дней: { $count }
referral-stat-earned = Заработано
withdraw-enter-amount = <strong>Вывод баланса</strong>

Ваш баланс: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
Максимальная сумма: {NUMBER($maxAmount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $

Введите сумму для вывода:
withdraw-enter-amount-short = Введите сумму вывода (от 15$ до {NUMBER($maxAmount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $):
withdraw-insufficient-balance = У вас недостаточно средств на балансе.
withdraw-minimum-not-met = Вывод средств возможен от 15$. Ваш баланс: {$balance}$. Пополните баланс и попробуйте снова.
withdraw-minimum-alert = Вывод от 15$. Ваш баланс: {$balance}$

Текущий баланс: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
withdraw-invalid-amount = Неверная сумма. Пожалуйста, введите положительное число.
withdraw-amount-exceeds-balance = Сумма превышает ваш баланс.

Запрошено: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
Доступно: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
withdraw-enter-details = Введите реквизиты для вывода (номер карты, кошелек и т.д.):
withdraw-details-too-short = Реквизиты слишком короткие. Пожалуйста, укажите полные реквизиты.
withdraw-enter-comment-optional = Введите комментарий (опционально, нажмите /skip чтобы пропустить):
withdraw-confirm = <strong>Подтверждение вывода</strong>

Сумма: {$amount} $
Реквизиты: {$details}
Комментарий: {$comment}

Подтвердите вывод:
withdraw-cancelled = Вывод отменён
withdraw-request-created = <strong>Запрос на вывод создан</strong>

Тикет #{ticketId}

Модератор обработает ваш запрос в ближайшее время.
withdraw-new-notification = <strong>Новый Запрос на Вывод #{ticketId}</strong>

Пользователь: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Сумма: {$amount} $
withdraw-approved = <strong>Запрос на вывод одобрен</strong>

Тикет #{ticketId}
Сумма: {$amount} $

Средства были списаны с вашего баланса.
withdraw-approved-by-moderator = Вывод одобрен
ticket-type-withdraw_request = Запрос на вывод
button-ticket-approve-withdraw = ✅ Одобрить вывод
error-invalid-ticket-type = Неверный тип тикета
error-user-not-found = Пользователь не найден

# VDS Rename
vds-button-rename = ✏️ Переименовать
vds-rename-enter-name = <strong>Переименование VDS</strong>

Текущее имя: {$currentName}

Введите новое имя (от {$minLength} до {$maxLength} символов):
vds-rename-invalid-length = Неверная длина имени. Имя должно быть от {$minLength} до {$maxLength} символов.
vds-rename-no-linebreaks = Имя не может содержать переносы строк.
vds-rename-success = <strong>VDS переименован</strong>

Новое имя: {$newName}
vds-current-info = <strong>{$displayName}</strong>

Статус: {$status}
IP: {$ip}
CPU: {$cpu}
RAM: {$ram} GB
Диск: {$disk} GB
Сеть: {$network} Mbit/s
ОС: {$osName}
Абузоустойчивость: {$abuse}
Тариф: {$rateName}
Цена продления: {$price} $
Истекает: {$expireAt}
vds-manage-list-item = {$displayName} ({$rateName}) - {$ip}

# Amper Domains
button-register-domain = 🌐 Зарегистрировать домен
button-register-domain-amper = 🌐 Зарегистрировать домен (Amper)
button-my-domains = 📋 Мои домены
button-my-domains-amper = 📋 Мои домены (Amper)
domains-none = У вас нет зарегистрированных доменов
domains-list = <strong>Мои домены ({$count})</strong>
domain-register-enter-name = <strong>Регистрация домена</strong>

Введите домен (с зоной или без): example или example.com
domain-register-enter-tld = Введите зону домена (например: com, org, net):
domain-api-not-configured = Ошибка: API доменов не настроен. Проверьте AMPER_API_BASE_URL и AMPER_API_TOKEN.
domain-invalid-format = Неверный формат домена: {$domain}

Домен должен быть в формате example.com
domain-invalid-format-registrar = Регистратор отклонил формат домена: {$domain}
    Если ввод верный (например name.com), попробуйте другой домен или уточните у поддержки.

Возможные причины: недопустимые символы, зона не поддерживается регистратором или ограничения зоны. Используйте только латинские буквы, цифры и дефис.
domain-label-too-long = Имя домена (часть до точки) не должно быть длиннее {$max} символов. Сейчас: {$length}.
domain-checking-availability = Проверка доступности домена {$domain}...
domain-check-error = ⚠️ Ошибка при проверке домена {$domain}
domain-check-format-warning = ⚠️ Проверка доступности через API недоступна для домена <b>{$domain}</b>.
    Продолжаем регистрацию — доступность будет проверена автоматически при регистрации.
    Если домен занят, средства с вашего баланса не будут списаны (возврат выполнен).

Ошибка API: {$error}

Попробуйте позже или обратитесь в поддержку.
domain-not-available = Домен {$domain} недоступен для регистрации
domain-not-available-with-reason = Домен {$domain} недоступен для регистрации.
    Причина: {$reason}
domain-check-unrelated-to-balance = ℹ️ Проверка доступности не связана с балансом. Баланс Amper списывается только при фактической регистрации домена.

Причина от регистратора: {$reason}
domain-register-enter-period = Введите период регистрации в годах (1-10):
domain-invalid-period = Неверный период. Введите число от 1 до 10.
domain-register-enter-ns-optional = Введите nameservers (опционально, нажмите /skip для пропуска):

Формат: ns1.example.com ns2.example.com
По умолчанию: {$defaultNs1} и {$defaultNs2}
domain-invalid-ns-format = Неверный формат nameservers. Введите два nameserver через пробел или запятую.
domain-register-confirm = <strong>Подтверждение регистрации</strong>

Домен: {$domain}
Период: {$period} {NUMBER($period, style: "ordinal") -> 
  [one] год
  [few] года
 *[other] лет
}
Цена: {$price} $
NS1: {$ns1}
NS2: {$ns2}

Подтвердите регистрацию:
domain-register-cancelled = Регистрация домена отменена
domain-registering = Регистрация домена {$domain}...
domain-registered = <strong>Домен зарегистрирован</strong>

Домен: {$domain}
ID: {$domainId}
Статус: {$status}
domain-register-failed = <strong>Ошибка регистрации домена</strong>
domain-register-failed-registrar-balance = На счёте регистратора (Amper) недостаточно средств. Пополните баланс в кабинете Amper — после этого регистрация доменов в боте будет проходить. Средства с вашего баланса в боте не списаны (возврат выполнен).
domain-register-failed-domain-taken = Домен <b>{$domain}</b> уже занят и недоступен для регистрации. Средства с вашего баланса не списаны (возврат выполнен).
domain-service-temporarily-unavailable = ⚠️ Сервис регистрации доменов временно недоступен (ошибка { $statusCode }). Пожалуйста, попробуйте позже.
domain-check-service-unavailable = ⚠️ Проверка доступности домена временно недоступна (ошибка { $statusCode }). Сервис Amper перегружен или недоступен. Попробуйте позже.

Домен: {$domain}
Ошибка: {$error}
domain-information-amper = <strong>Информация о домене</strong>

Домен: {$domain}
Статус: {$status}
TLD: {$tld}
Период: {$period} {NUMBER($period, style: "ordinal") -> 
  [one] год
  [few] года
 *[other] лет
}
Цена: {$price} $
NS1: {$ns1}
NS2: {$ns2}
button-domain-renew = 🔄 Продлить
button-domain-update-ns = 🔧 Изменить NS
domain-renew-confirm = <strong>Продление домена</strong>

Домен: {$domain}
Период: {$period} {NUMBER($period, style: "ordinal") -> 
  [one] год
  [few] года
 *[other] лет
}
Цена: {$price} $

Подтвердите продление:
domain-cannot-renew = Невозможно продлить домен с текущим статусом
domain-renewing = Продление домена {$domain}...
domain-renewed = <strong>Домен продлён</strong>

Домен: {$domain}
domain-update-ns-enter = <strong>Изменение Nameservers</strong>

Текущие NS:
NS1: {$currentNs1}
NS2: {$currentNs2}

Введите новые nameservers (формат: ns1.example.com ns2.example.com):
domain-ns-updated = <strong>Nameservers обновлены</strong>

Домен: {$domain}
NS1: {$ns1}
NS2: {$ns2}
domain-status-draft = Черновик
domain-status-wait-payment = Ожидание оплаты
domain-status-registering = Регистрация
domain-status-registered = Зарегистрирован
domain-status-failed = Ошибка
domain-status-expired = Истёк
years = лет
default = По умолчанию

# User Statuses
user-status-newbie = 🆕 Новичок
user-status-user = 👤 Пользователь
user-status-admin = 👑 Админ
user-status-current = Текущий статус: {$status}
button-change-status = 🔄 Изменить статус
button-add-balance = 💰 Пополнить баланс
button-deduct-balance = ➖ Списать с баланса
button-balance-short = 💰 Баланс
button-services-short = 🖥 Услуги
button-partnership-short = 🎁 Партнёрка
button-tickets-short = 🎫 Тикеты
button-message-short = ✉ Сообщение
button-notes-short = 📝 Заметки
button-subscription-short = 🔐 Подписка
admin-subscription-grant = Выдать подписку
admin-subscription-revoke = Забрать подписку
admin-subscription-enter-days = Введите количество дней подписки (число от 1 до 3650):
admin-subscription-granted = Подписка выдана на {$days} дн. до {$until}.
admin-subscription-revoked = Подписка отменена.
admin-subscription-invalid-days = Некорректное число. Введите число дней от 1 до 3650.
admin-referral-percent-enter = Введите реферальный процент для этого пользователя (0–100):
admin-referral-percent-invalid = Некорректное значение. Введите число от 0 до 100.
admin-referral-percent-success = Реферальный процент установлен: {$percent}%.
button-block-short = ⛔ Блокировка
button-status-short = 🏷 Статус
button-operations-history = 📜 История операций
button-user-stats = 📊 Статистика
button-restrictions = ⛔ Ограничения
button-financial-analytics = 📈 Финансовая аналитика
admin-coming-soon = В разработке.
admin-notes-coming-soon = Заметки пользователя — в разработке.
admin-user-tickets-summary = Тикетов у пользователя: {$count}
admin-user-stats-screen = <strong>📊 Статистика пользователя</strong>

 💰 Финансы: депозит {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $, пополнений {$topupsCount}, последний депозит {$lastDepositStr}
 🛠 Услуги: активных {$activeServicesCount}, всего {$totalServicesCount}
 🎫 Тикетов: {$ticketsCount} | Заказов: {$ordersCount}
 📅 Регистрация: {DATETIME($createdAt, dateStyle: "long", timeStyle: "short")}
 🔥 Последняя активность: {$lastActivityStr}
 💵 Реферальный доход: {$referralIncome} $
admin-balance-enter-amount = Введите сумму для действия «<i>{$action}</i>» (положительное число, до 1 000 000):
admin-balance-action-add = пополнение
admin-balance-action-deduct = списание
admin-balance-invalid = Некорректная сумма. Введите положительное число.
admin-balance-deduct-more-than-have = У пользователя баланс {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $, списать {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $ нельзя.
admin-balance-success = Готово. Действие: {$action}, сумма: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $. Новый баланс пользователя: <b>{NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $</b>.

button-message-to-user = ✉️ Сообщение пользователю
button-manage-user-services = 🛠 Управление услугами
button-manage-user-referrals = 🤝 Управление партнёркой
admin-message-to-user-enter = Введите текст сообщения для пользователя:
admin-message-to-user-prefix = 📩 Сообщение от администрации:
admin-message-to-user-sent = Сообщение отправлено.
admin-message-to-user-failed = Не удалось отправить сообщение: {$error}
admin-user-services-summary = <strong>Услуги пользователя</strong>\n\n💰 Общий депозит: {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $\n🛠 Активных услуг: {$activeServicesCount}\n🎫 Тикетов: {$ticketsCount}\n\nVPS/VDS: {$vdsCount} | Dedicated: {$dedicatedCount} | Домены: {$domainCount}
admin-user-referrals-summary = <strong>Реферал</strong>

 Количество рефералов: {$count}
 Конверсия рефералов (REG2DEP): {$conversionPercent}%
 Средний депозит реферала: {$avgDepositPerReferral} $
 Реферальный процент: {$referralPercent}%

 💰 Реферальный баланс: {NUMBER($referralBalance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 (прибыль с покупок рефералов по реф. %, доступно к выводу)

 Реферальная ссылка:
 {$link}

 Активных рефералов за 30 дней: {$activeReferrals30d}

# Prime Subscription (Dior Host)
prime-subscription-title = 🔐 Prime Подписка
prime-subscription-body = Расширенные условия для активных клиентов и владельцев инфраструктуры.

 Что даёт Prime:

 🏷 Скидка 20% на все доменные зоны
 Доступ к специальному тарифу без ограничений по количеству регистраций.

 ⚡ Приоритетная обработка заказов
 Ваши домены и услуги обрабатываются в первую очередь.

 📈 Улучшенные коммерческие условия
 Гибкий подход при работе с объёмами и долгосрочными заказами.

 💬 Приоритет в поддержке
 Быстрый отклик по вопросам инфраструктуры и биллинга.

 🎁 Пробный доступ — 7 дней бесплатно
prime-subscription-intro = Открывает для вас следующие преимущества:
prime-subscription-benefit-ssl = Автоматическая установка SSL 🔰 (CloudFlare): Для каждого домена создается отдельный аккаунт, привязанный к вашему указанному IP-адресу!
prime-subscription-benefit-discount = 🏷 Вам открывается дисконт в 20% на все доступные домена!
prime-subscription-benefit-notify = Автоматическое оповещение о состоянии домена: Теперь вы будете автоматически оповещены через бота, если на вашем домене появится 🟥 "Красная табличка". Таким образом, вам больше не придется беспокоиться о состоянии домена.
prime-subscription-status-active = ✅ Подписка активирована
prime-subscription-status-inactive = ❌ Подписка не активирована
prime-subscription-status-until = Активна до: {$date}
prime-trial-activate = 🎁 Активировать за 0$ на 7 дней (Далее {$monthlyPrice}$/мес)
prime-trial-via-channel = Подпишись на наш канал, чтобы получить бесплатную Prime подписку на 7 дней
prime-button-activate-trial = 🎁 Активировать за 0$ на 7 дней
prime-button-menu-row = 🔐 Prime Подписка −20% на домены
prime-button-go-subscribe = ↗️ Перейти и подписаться
prime-button-i-subscribed = ✅ Я подписался
prime-trial-activated = ✅ Prime подписка активирована на 7 дней! Вам доступна скидка 20% на домены.
prime-subscribe-message = Подпишись на наш <a href="{$channelLink}">канал</a>, чтобы получить бесплатную Prime подписку на 7 дней
prime-trial-activated-message = 💎 Ваша Prime подписка была активирована на 1 неделю!
prime-trial-already-used = Вы уже использовали бесплатный пробный период. Продолжить подписку можно по тарифу {$monthlyPrice}$/мес.
prime-trial-subscribe-first = Сначала подпишитесь на канал, затем нажмите «Я подписался».
prime-trial-subscribe-first-retry = Подписка не обнаружена. Подпишитесь на канал по кнопке выше, подождите 5–10 секунд и нажмите «Я подписался» снова. Убедитесь, что бот добавлен в канал как администратор.
prime-channel-not-configured = Проверка подписки пока не настроена. Напишите в поддержку.
prime-discount-dedicated = 🔐 Prime Подписка −20% на Dedicated
prime-discount-vds = 🔐 Prime Подписка −20% на VPS/VDS

profile-prime-no = Prime: нет
profile-prime-until = Prime: до {$date}

nps-promoter = Спасибо за высокую оценку! 🎉 Приглашайте друзей по реферальной ссылке — получайте % с их пополнений. Или воспользуйтесь скидкой на годовое продление в профиле.
nps-detractor = Жаль, что что-то не понравилось. Напишите в поддержку — мы разберёмся и поможем. Кнопка «Задать вопрос» в меню откроет чат с нами.
nps-neutral = Спасибо за отзыв. Если появится идея, как нам стать лучше — напишите в поддержку. Мы всегда на связи.

# Infrastructure Bundles
button-infrastructure-bundle = 🚀 Infrastructure Bundle
bundle-infrastructure-bundles = 🚀 Пакеты инфраструктуры (Domain + VPS)
bundle-select-type = Выберите тип пакета:
bundle-starter-shield = Starter Shield
bundle-launch-pack = Launch Pack
bundle-infrastructure = Infrastructure Bundle
bundle-secure-launch = Secure Launch Kit
bundle-full-stack = Full Stack Deploy Pack
bundle-pro-infrastructure = Pro Infrastructure Pack
bundle-starter-shield-desc = Базовый пакет: домен + VPS + защита
bundle-starter-shield-title = 🚀 Starter Shield
bundle-starter-shield-intro = Базовый инфраструктурный пакет для быстрого запуска проекта
bundle-starter-shield-tagline = Готовое решение: bulletproof домен + сервер + базовая защита в одном комплекте.
    Минимум ручных действий — максимум скорости запуска.
bundle-starter-shield-includes-title = В пакет входит
bundle-starter-shield-includes-list = ✔️ Bulletproof Domain
    ✔️ Bulletproof VPS
    ✔️ Бесплатная настройка DNS
    ✔️ Привязка домена к VPS
    ✔️ Pre-config Firewall
    ✔️ 1 выделенный IP включён
bundle-starter-shield-benefits-title = Что это даёт
bundle-starter-shield-benefits-list = — Полный контроль над инфраструктурой
    — Снижение технических рисков на старте
    — Экономия времени на ручной настройке
    — Единая точка управления
bundle-starter-shield-pricing-title = Ценообразование
bundle-starter-shield-pricing-base = Базовая стоимость
bundle-starter-shield-pricing-discount = Скидка на пакет
bundle-starter-shield-pricing-final = Итоговая цена
bundle-starter-shield-pricing-savings = Ваша экономия
bundle-launch-pack-desc = Готовый к запуску: домен + VPS + настройка DNS + SSL + шаблон деплоя
bundle-infrastructure-desc = Полная инфраструктура: домен + мощный VPS + все настройки
bundle-secure-launch-desc = Безопасный запуск: домен + VPS + SSL + firewall + защита
bundle-full-stack-desc = Полный стек: домен + VPS + все инструменты для деплоя
bundle-pro-infrastructure-desc = Профессиональный пакет: домен + мощный VPS + Reverse DNS + мониторинг + Extra IP
bundle-pro-infrastructure-title = 🚀 Pro Infrastructure Pack
bundle-pro-infrastructure-intro = Профессиональный стек под серьёзные проекты и нагрузку
bundle-pro-infrastructure-tagline = Комплексное инфраструктурное решение: усиленный VPS, расширенная сеть и базовый мониторинг.
    Формат — готовый production-набор без донастройки вручную.
bundle-pro-infrastructure-includes-title = В пакет входит
bundle-pro-infrastructure-includes-list = ✔️ Bulletproof Domain
    ✔️ Мощный VPS/VDS
    ✔️ Бесплатная настройка DNS
    ✔️ Привязка домена к VPS
    ✔️ Базовый nginx config
    ✔️ SSL сертификат
    ✔️ Pre-config firewall
    ✔️ 1 основной IP включён
    ✔️ Готовый шаблон деплоя (LAMP / Docker / FastPanel)
    ✔️ Reverse DNS
    ✔️ Private DNS
    ✔️ Базовый мониторинг доступности
    ✔️ Дополнительный IP (Extra IP)
bundle-pro-infrastructure-benefits-title = Ключевые преимущества
bundle-pro-infrastructure-benefits-list = — Расширенная сетевая конфигурация (Reverse + Private DNS)
    — Готовая среда под быстрый деплой
    — Повышенная изоляция и управляемость
    — Подходит под долгосрочные проекты и масштабирование
    — Снижение операционных рисков на старте
bundle-includes = В пакет входит:
bundle-pricing = Ценообразование:
bundle-base-price = Базовая цена
bundle-discount = Скидка
bundle-final-price = Итоговая цена
bundle-savings = Экономия
bundle-ready-in-15min = ⚡ Готовая инфраструктура к запуску за 15 минут
bundle-button-purchase = 💳 Купить пакет
bundle-button-change-period = 📅 Изменить период
bundle-period-monthly = 1 месяц
bundle-period-quarterly = 3 месяца
bundle-period-semi-annual = 6 месяцев
bundle-discount-12 = -12%
bundle-discount-17 = -17%
bundle-discount-20 = -20%
bundle-feature-domain = Bulletproof Domain
bundle-feature-vps = VPS/VDS
bundle-feature-dns-setup = Бесплатная настройка DNS
bundle-feature-domain-binding = Привязка домена к VPS
bundle-feature-nginx = Базовый nginx config
bundle-feature-ssl = SSL сертификат
bundle-feature-firewall = Pre-config firewall
bundle-feature-ip = 1 IP включён
bundle-feature-deploy-template = Готовый шаблон деплоя (LAMP/Docker/FastPanel)
bundle-feature-reverse-dns = Reverse DNS
bundle-feature-private-dns = Private DNS
bundle-feature-monitoring = Базовый мониторинг
bundle-feature-extra-ip = Extra IP
bundle-upsell-domain = 🔥 Добавьте VPS — сэкономьте до 20%!
bundle-upsell-vps = 🔥 Добавьте домен — сэкономьте до 20%!
bundle-button-upgrade = Upgrade to Launch Pack
bundle-back-to-types = Назад к типам
bundle-enter-domain-name = Введите домен (с зоной или без): example или example.com
bundle-confirm-purchase-text = Домен: <b>{ $domain }</b>
Итоговая цена пакета: <b>${ $price }</b>

Подтвердить покупку?
bundle-purchase-success = <strong>Пакет успешно приобретён</strong>
Домен: { $domain }
VPS ID: { $vdsId }
IP: { $ip }
bundle-purchase-domain-only = Домен <b>{ $domain }</b> успешно зарегистрирован.
VPS временно недоступен (не подключены данные от VMManager). Когда подключите — пакеты с VPS заработают.
bundle-unavailable-no-vm-no-amper = Сейчас пакет недоступен: не настроены VPS (VMManager) и домены (Amper). Настройте .env и попробуйте позже.
bundle-select-period = Выберите период оплаты: