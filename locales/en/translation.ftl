-language-icon = 🇺🇸
-language-name = English

quoted-balance = <blockquote>Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
strong-balance = <strong>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</strong>

welcome = DiorHost • Bulletproof Infrastructure
 
 Order and manage hosting services directly in this bot.
 24/7 uptime • Bulletproof • Offshore
 @diorhost
 
 {quoted-balance}

about-us = We provide reliable and high-performance VDS dedicated servers and hosting services.

 Our infrastructure provides anonymity, data security and stable performance with speeds up to 1 GBit/s.
 
 With us you get full control over services, flexible rates and 24/7 support from professionals.

support = We are always here to help! 🤝

 There are questions about registration domain names? Ideas for Improving of our service? Or offers for cooperation? We will be happy to listen to you!

 Write our support right now!

 <a href="https://dior.host/">Web Site</a> | <a href="https://t.me/diorhost">Support</a> | <a href="https://t.me/+C27tBPXXpj40ZGE6">Dior News</a>

support-message-template = Hello!
 I have a question.

profile = ┠💻 1REG PROFILE
┃
┗✅ STATS:
    ┠ ID: {$userId}
    ┠ Status: {$userStatus}
    ┗ Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
    ┠ 
    ┠👤 Contacts:
    ┠ WHOIS data: {$whoisStatus}
    ┗ Email: {$emailStatus}

Terms of service (https://telegra.ph/Pravila-i-Usloviya-ispolzovaniya-servisa-1REG-05-26) | Support (https://t.me/one_reg_talk) | 1REG News (https://t.me/+kOkatN8cTig1ZGRk)

button-purchase = 💳 Purchase service
button-manage-services = 🛠 Manage services
button-personal-profile = 👤 Profile
button-support = 🤝 Support
button-about-us = 📖 About us
button-change-locale = 🇺🇸 Change language
button-ask-question = Ask question
button-tp = Support
button-deposit = 💸 Top up
button-promocode = 🎁 Promocode
button-subscription = 🔐 Subscription
button-website = Web Site
button-support-profile = 🔔 Support
button-dior-news = Dior News
button-contact-with-client = Contact with client
button-domains = 🌐 Bulletproof Domains
button-vds = 🖥 VPS/VDS
button-bundle-manage = 🚀 Infrastructure Bundle
bundle-manage-header = <strong>🚀 Infrastructure Bundle</strong>

    Services purchased as a bundle (domain + VPS):
bundle-manage-empty = You have no bundle services yet
button-dedicated-server = 🖥 Dedicated Server
button-balance = 💸 Balance
button-standard = 🛡 Standard
button-bulletproof = ⚜️ Bulletproof
button-agree = ✅ Agree
update-button = 🔄 Update

button-back = 🔙 Back
button-change-percent = 📊 Change percentage
button-close = ❌ Close
button-open = ✅ Open
button-pay = ✅ Pay
button-pay-service = 💳 Pay
button-copy-ip = 📋 IP
button-copy-login = 📋 Login
button-copy-password = 📋 Password
button-show-password = 👁 Show password
button-hide-password = 🙈 Hide password

button-change-locale-en = 🇺🇸 English
button-change-locale-ru = 🇷🇺 Русский

select-language = Select interface language

button-go-to-site = Go to website
button-user-agreement = User agreement

button-send-promote-link = 📤 Send link

button-any-sum = Any amount

promote-link = The link has been created. It will be active for 6 hours.

admin-help = Available commands for Administrator:
 1. /promote_link - Create a link to raise user rights
 <blockquote>This link will allow you to get moderator rights, after its creation it will be active for 6 hours.</blockquote>
 2. /users - Get a list of users and control them
 3. /domainrequests - Get a list of domain registration requests
 4. /create_promo (name) (sum) (uses count) - Creation a promocode
 5. /remove_promo (id) - Remove promocode
 6. /showvds (userId) - Show list of VDS
 7. /removevds (vdsId) - Remove vds from VMManager and user

link-expired = The link has expired
link-used = The link already has been used

promoted-to-moderator = You have been promoted to moderator
promoted-to-admin = You have been promoted to administrator
promoted-to-user = You have been demoted to user

admin-notification-about-promotion = User <a href="tg://user?id={$telegramId}">({$name})</a> - {$id} has been promoted to {$role}
admin-notification-topup = 💳 <strong>Balance top-up</strong>\nBuyer: {$username}\nAmount: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $

-users-list = Users list
-users-list-empty = Users list is empty
-user-info = <strong>User Control Panel</strong>

control-panel-users = {-users-list}

control-panel-about-user = {-user-info}

 ID: {$id}
 Username: {$usernameDisplay}
 Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Status: {$statusLabel}
 Prime subscription: {$primeStatusLabel}
 Level: {$userLevelLabel}

 💰 Finance
 Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Total deposit: {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 Top-ups: {$topupsCount}
 Last deposit: {$lastDepositStr}

 📊 Activity
 Active services: {$activeServicesCount}
 Total services: {$totalServicesCount}
 Tickets: {$ticketsCount}
 Orders: {$ordersCount}
 Registration date: {DATETIME($createdAt, dateStyle: "long", timeStyle: "short")}
 Last activity: {$lastActivityStr}
 
-balance = Balance
-id = ID
admin-user-status-active = Active
admin-user-status-banned = Banned
admin-prime-status-yes = Yes
admin-prime-status-no = No
admin-user-level-newbie = Newbie
admin-user-level-user = User
admin-user-level-admin = Admin
admin-date-format = {DATETIME($date, dateStyle: "medium", timeStyle: "short")}

sorting-by-balance = Sorting by: {-balance}
sorting-by-id = Sorting by: {-id}

sort-asc = 🔽
sort-desc = 🔼

# Admin Panel
button-admin-panel = ⚙️ Admin Panel
button-control-users = 👥 Manage Users
button-tickets = 🎫 Tickets
button-promocodes = 🎟 Promo codes
button-automations = 📬 Automations & Notifications
button-statistics = 📊 Statistics
admin-automations-header = <strong>📬 Automations & Notifications</strong>
admin-automations-description = Enable or disable scenarios. Full config in web panel.
admin-automations-empty = No scenarios. Add them via API or web panel.
admin-automations-web-hint = 🔗 Full trigger, template and offer config — use the button below.
admin-automations-open-web = 🌐 Open web panel
button-promos-create = ➕ Create promo code
admin-statistics-header = 📊 Purchase statistics
admin-statistics-topups = Top-ups
admin-statistics-purchases = Purchases
admin-statistics-sum = Profit
admin-statistics-24h = Last 24 hours
admin-statistics-7d = Last 7 days
admin-statistics-30d = Last 30 days
admin-statistics-all = All time
button-delete = 🗑 Delete
admin-panel-header = <strong>⚙️ Admin Panel</strong>
admin-promoted-notification = You have been granted administrator status. Tap the button below or use the /admin command. The Admin Panel button will also appear in your Profile.
button-open-admin-panel = ⚙️ Open admin panel

Select an action:
moderator-menu-header = <strong>Moderator Panel</strong>

# Referrals
button-referrals = 💲 Referrals
button-share-link = 📤 Share link
referrals-screen = 🚀 DiorHost Partner Program\n\nMonetize your traffic on VPS, dedicated servers and abuse-resistant domains.\n\n💰 Terms:\n\n• Up to 30% of each referred client's top-up\n• Lifetime — percentage from all future payments\n• Credited on first top-up from $10+\n• No limit on number of referrals\n• Automatic tracking in the system\n\n🔗 Your referral link:\n{$link}\n\nReferrals: {$count}\nEarned: {$profit} $\n\nDrive traffic — earn passive income on infrastructure.
referrals-share-text = Join me on Dior Host! Use my referral link to get started.

Select an action:

pagination-left = ⬅️
pagination-right = ➡️

block-user = 🚫 Block
unblock-user = ✅ Unblock

message-about-block = Unfortunately you are blocked. Contact support for clarification of the reasons for blocking.

button-buy = 💸 Make order

domain-question = Enter domain (with or without zone): example or example.com
domain-invalid = The entered domain is incorrect <i>{$domain}</i> try again
domain-not-available = 🚫 Domain <i>{$domain}</i>, already taken. Try to take another one.
domain-available = ✅ Domain <i>{$domain}</i> is available for registration. You want to buy it?
domain-registration-in-progress = 🔄 Domain registration in progress for <i>{$domain}</i> (Your balance has been debited) You can follow the status in the service management menu

empty = Empty
list-empty = The list is empty

service-maintenance = Currently under maintenance. Please try later.

service-pay-message = <strong>Service payment</strong>

Press the button below to pay.

service-info-header = Service information
service-label-ip = IP address
service-label-login = Login
service-label-password = Password
service-label-os = OS
service-label-status = Status
service-label-created-at = Created
service-label-paid-until = Paid until
service-date = {DATETIME($date, dateStyle: "medium", timeStyle: "short")}
status-active = Active
status-suspended = Suspended
status-pending = Pending

domain-request-approved = Domain has been approved
domain-request-reject = Domain has been reject

domain-request-not-found = Domain request was not found

domain-request = {$id}. <code>{$domain}</code> from user ({$targetId}).
 <strong>Additional information:</strong>
 <blockquote>{$info}</blockquote>

domain-request-list-info = (/approve_domain &lt;id&gt; &lt;expire_at: 1year or 1y&gt; - approve, /reject_domain &lt;id&gt; - reject)
domain-request-list-header = <strong>List of domain registration requests:</strong>
domain-registration-complete = ❗️ To finalize the domain purchase, please send information about the IP address to which it should be bound, or specify two NS servers separated by a space ❗️
domain-registration-complete-fail-message-length  = The information is too long try making the text smaller

domains-manage = <strong>Manage domains</strong>
domain-already-pending-registration = Domain already in pending await
domain-request-notification = New request /domainrequests (In progress: {$count})

domain-cannot-manage-while-in-progress = Domain is pending registration wait until it becomes available.

deposit-money-enter-sum = Enter payment amount
deposit-money-incorrect-sum = The entered amount is incorrect

topup-select-method = Select payment method
topup-select-amount = Select top-up amount
topup-method-manual = Manual payment
topup-manual-support = Contact support to complete manual top-up.
topup-manual-support-message = I want to top up my balance by {$amount} $. Please provide payment details.
topup-manual-support-message-no-amount = I want to top up my balance. Please provide payment details.
topup-manual-created = ✅ Manual top-up request created.
topup-cryptobot-not-configured = Crypto Pay (CryptoBot) is not configured. Add PAYMENT_CRYPTOBOT_TOKEN to .env or choose another payment method.
 
<blockquote>Amount: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
Ticket: #{$ticketId}

domain-was-not-found = Domain was not found

domain-information = Domain <i>{$domain}</i>

 <strong>Expiration date</strong>: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
 <strong>Renewal date</strong>: {DATETIME($paydayAt, dateStyle: "long", timeStyle: "short")}
 <strong>Price renewal</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

 <i>📌 Renewal is automatic, please top up your balance in advance</i>

 To change the NS or IP binding, contact tech support.

deposit-success-sum = ✅ Great, now all that's left to do is <u>pay</u> and we'll credit your balance.
 
 <blockquote>Top-up amount: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>

 <strong>Select a payment method</strong>

payment-information = After payment wait a little, the system will automatically confirm the payment and the funds will be automatically credited to your account, if this did not happen please contact support.
payment-next-url-label = Proceed to payment
payment-await = Please wait...

deposit-by-sum = Your account has been funded with {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

money-not-enough = You don't have enough money on your balance ({NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ short)
money-not-enough-go-topup = You need {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ more. Choose payment method:

invalid-arguments = Invalid arguments

new-promo-created = New promo are added /promo_codes - for see

promocode-already-exist = promocode with this name already exists

promocode = {$id} <strong>{$name}</strong> (Uses: {$use}/{$maxUses}) : {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
promocode-deleted = Promocode <strong>{$name}</strong> successfully deleted

promocode-not-found = Promocode was not found
promocode-not-exist = This promocode does not exist
promocode-input-question = Enter the promocode
promocode-used = The promo code was successfully used and you are credited on your balance {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

menu-service-for-buy-choose = 📃 <strong>Select the category of services to purchase</strong>

manage-services-header = 🛠 Manage services


vds-menu-rate-select = test

vds-bulletproof-mode-button-on = Bulletproof: ON
vds-bulletproof-mode-button-off = Bulletproof: OFF

vds-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $, {$cpu} cores, {$ram} gb ram, {$disk} gb disk
dedicated-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $/mo, {$cpu} cores / {$cpuThreads} threads, {$ram} GB RAM, {$storage} GB

dedicated-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU (Cores/Threads): </strong> {$cpu} cores / {$cpuThreads} threads
 <strong>💾 RAM: </strong> {$ram} GB
 <strong>💽 Storage: </strong> {$storage} GB
 <strong>🚀 Network: </strong> {$network} Gbps
 <strong>🛜 Bandwidth: </strong> {$bandwidth}

 <strong>OS: </strong> {$os}

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ / month

bulletproof-on = ✅ Bulletproof rate
bulletproof-off = ⚠️ Isn't bulletproof rate
unlimited = Unlimited

vds-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU (Cores): </strong> {$cpu}
 <strong>💾 RAM: </strong> {$ram} Gb
 <strong>💽 Disk (SSD/NVME): </strong> {$disk} Gb
 <strong>🚀 Network Speed: </strong> {$network} Mbit/s
 <strong>🛜 Bandwidth: </strong> Unlimited

 <strong>OS: </strong> Windows/Linux

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $ / month

vds-os-select = <strong>Select the OS to be installed</strong>

bad-error = Sorry, there's been a mistake on our end, we're fixing it now.

vds-created = The status can be monitored in the main menu. > Manage services

vds-manage-title = Manage VDS
vds-manage-list-item = «{$rateName}» - {$ip} 🖥

vds-stopped = Machine is DISABLED ⛔️
vds-work = Machine is ENABLED ✳️
vds-creating = Machine is CREATING ⚠️

vds-current-info = <strong>Manage VDS</strong>

 <strong>Expiration date</strong>: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
 <strong>Renewal Price</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 
 {$abuse}
 
 <strong>«{$rateName}»</strong>
 <strong>🖥 CPU (cores): </strong> {$cpu}
 <strong>💾 RAM: </strong> {$ram} Гб
 <strong>💽 DISK (SSD/NVME): </strong> {$disk} Гб

 <strong>IP: </strong> {$ip}
 <strong>OS: </strong> {$osName}

 {$status}

 <i>📌 Renewal is automatic, please top up your balance in advance</i>

 ❗️ We recommend changing the password on the machine itself and saving it in a safe place

vds-button-reinstall-os = 💿 Reinstall OS
vds-button-stop-machine = ⛔️ Disable
vds-button-start-machine  = ✳️ Enable
vds-button-regenerate-password = 🔁 Change Password
vds-button-copy-password = ⤵️ Copy Password

vds-new-password = New Password: <tg-spoiler>{$password}</tg-spoiler>

vds-reinstall-started = Reinstallation is running, please wait. You can monitor the status in > Manage services

dedicated-servers = This section will be available soon. In the meantime, you can get information about dedicated servers via DM in tech support.

vds-expiration = Your VDS Expires. Refill your balance by {$amount} $

no-vds-found = User don't have VDS

vds-info-admin = {$id}. {$ip} {$expireAt} - Renewal price {NUMBER($renewalPrice, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

vds-removed = VDS removed

vds-remove-failed = Remove VDS with ID {$vdsId} failed

vds-select-os-confirm = You choose {$osName}. You want to continue?
vds-select-os-next = Continue

failed-to-retrieve-info = Error retrieving machine information

await-please = Please await...
demo-operation-not-available = Demo service: operation not available

# Broadcast
button-broadcast = 📢 Broadcast
broadcast-enter-text = Enter the message text to send to all users:
broadcast-instructions = <strong>Broadcast</strong>
    Send the message text as a new message in this chat.
    You will see a preview with buttons to confirm or cancel.
    Alternative: /send your_text
broadcast-preview = <strong>Preview:</strong>

{$text}

Send this message to all users?
button-send = ✅ Send
button-confirm = ✅ Confirm
button-cancel = ❌ Cancel
broadcast-cancelled = Broadcast cancelled
broadcast-starting = Starting broadcast {$id}...
broadcast-completed = <strong>Broadcast completed</strong>
broadcast-stats = Total: {$total} | Sent: {$sent} | Failed: {$failed} | Blocked: {$blocked}
# Admin promo codes
admin-promos-header = Promo codes
admin-promos-footer = Page {$page} of {$total}
admin-promos-empty = No promo codes yet
admin-promos-delete-confirm = Delete promo code <strong>{$code}</strong>?
admin-promos-enter-code = Enter promo code name (letters, numbers, "-" or "_"):
admin-promos-invalid-code = Invalid promo code format
admin-promos-enter-amount = Enter discount amount (number):
admin-promos-invalid-amount = Invalid amount
admin-promos-enter-max-uses = Enter max activations (number):
admin-promos-invalid-max-uses = Invalid max activations
admin-promos-created = Promo code <strong>{$code}</strong> created
admin-promos-updated = Promo code <strong>{$code}</strong> updated
admin-promos-not-found = Promo code not found
admin-promos-edit-missing = No promo selected for editing
admin-promos-edit-code = Enter new code or /skip (current: {$code}):
admin-promos-edit-amount = Enter new amount or /skip (current: {$amount}):
admin-promos-edit-max-uses = Enter new max uses or /skip (current: {$maxUses}):

Total: {$total}
Sent: {$sent}
Failed: {$failed}
Blocked: {$blocked}
{$errors}

# Tickets
button-tickets-new = 🎫 Tickets (NEW)
button-tickets-in-progress = 🎫 Tickets (IN_PROGRESS)
tickets-none-new = No new tickets
tickets-none-in-progress = No tickets in progress
tickets-list-new = <strong>New Tickets ({$count})</strong>
tickets-list-in-progress = <strong>Tickets in Progress ({$count})</strong>
button-ticket-take = ✅ Take
button-ticket-assign-self = 🟢 Assign to me
button-ticket-unassign = 🔄 Unassign
button-ticket-ask-user = ❓ Ask User
button-ticket-ask-clarification = 💬 Request clarification
button-ticket-provide-result = ✅ Provide Result
button-ticket-complete = ✅ Complete
button-ticket-reject = ❌ Reject
ticket-taken = Ticket assigned to you
ticket-unassigned = Assignment removed
ticket-status-new = 🟡 New
ticket-status-in_progress = 🔵 In progress
ticket-status-wait_user = 🟣 Waiting for client
ticket-status-done = 🟢 Done
ticket-status-rejected = 🔴 Rejected
ticket-card-client = Client
ticket-card-created = Created
ticket-card-responsible = Responsible
ticket-card-responsible-none = —
ticket-card-title = Ticket #{$id}
ticket-card-status = Status
ticket-card-description = Description
ticket-card-balance = Client balance
ticket-card-amount = Requested amount
ticket-description-empty = No description provided
ticket-description-requested = User requested {$operation}.
error-ticket-not-found = Ticket not found
error-ticket-already-taken = Ticket already taken
ticket-ask-user-enter-question = Enter the question for the user:
ticket-question-from-moderator = <strong>Question from moderator</strong>

Ticket #{ticketId}

{$question}
ticket-question-sent = Question sent to user
ticket-provide-ip = Enter IP address:
ticket-provide-login = Enter login:
ticket-provide-password = Enter password:
ticket-provide-panel-optional = Enter panel URL (optional, press /skip to skip):
ticket-provide-notes-optional = Enter notes (optional, press /skip to skip):
ticket-provide-result-text = Enter result text:
ticket-result-provided = Result provided
ticket-result-received = <strong>Ticket #{ticketId} resolved</strong>

{$result}
ticket-reject-enter-reason-optional = Enter rejection reason (optional):
ticket-rejected = <strong>Ticket #{ticketId} rejected</strong>

Reason: {$reason}
ticket-rejected-by-moderator = Ticket rejected
ticket-new-notification = <strong>New Ticket #{ticketId}</strong>

User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Type: {$type}
ticket-moderator-notification = <strong>You received a ticket</strong>

Ticket #{ticketId}
Type: {$type}
User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
{$amountLine}
withdraw-notification-amount = Amount: {$amount} $
ticket-type-dedicated_order = Dedicated Order
ticket-type-dedicated_reinstall = Reinstall OS
ticket-type-dedicated_reboot = Reboot
ticket-type-dedicated_reset = Reset Password
ticket-type-dedicated_power_on = Power On
ticket-type-dedicated_power_off = Power Off
ticket-type-dedicated_other = Other Request
ticket-type-manual_topup = Manual Top-up
ticket-request-what = What needs to be done
ticket-request-server = Server

# Dedicated Servers
button-order-dedicated = 💳 Make Order
button-my-dedicated = 🖥 Dedicated
button-my-tickets = 🎫 My Requests
dedicated-none = You don't have any dedicated servers
dedicated-status-requested = <strong>Dedicated Server Request</strong>

Ticket #{ticketId}
Status: {$status}

Please wait for moderator to process your request.
dedicated-status-requested-no-ticket = <strong>Dedicated Server Request</strong>

Status: REQUESTED

Please wait for moderator to process your request.
dedicated-no-credentials = Dedicated server credentials not available yet
dedicated-info = <strong>My Dedicated Server</strong>

<strong>IP:</strong> {$ip}
<strong>Login:</strong> {$login}
<strong>Password:</strong> {$password}
<strong>Panel:</strong> {$panel}
<strong>Notes:</strong> {$notes}
button-reinstall-os = 💿 Reinstall OS
button-reboot = 🔄 Reboot
button-reset-password = 🔑 Reset Password
button-other-request = 📝 Other Request
button-dedicated-start = ✳️ Enable
button-dedicated-stop = ⛔️ Disable
dedicated-order-enter-requirements = Enter your requirements (CPU/RAM/SSD/Location):
dedicated-order-enter-comment-optional = Enter additional comment (optional, press /skip to skip):
dedicated-order-created = <strong>Request sent to moderator</strong>

Ticket #{ticketId}
Status: {$status}
dedicated-order-success = <strong>Purchase completed successfully</strong>

Ticket #{ticketId}

If you need help, contact support.
dedicated-purchase-success = <strong>Your purchase was successful</strong>

Please contact support.
dedicated-operation-requested = <strong>Request sent to support</strong>

 Operation: {$operation}
 Ticket #{$ticketId}. Please wait for moderator response.

Operation: {$operation}
Ticket #{ticketId}
tickets-none-user = You don't have any tickets
tickets-list-user = <strong>My Tickets ({$count})</strong>
ticket-dedicated-ready = <strong>Your Dedicated Server is Ready!</strong>

Ticket #{ticketId}

<strong>IP:</strong> {$ip}
<strong>Login:</strong> {$login}
<strong>Password:</strong> {$password}
<strong>Panel:</strong> {$panel}
<strong>Notes:</strong> {$notes}
button-view-ticket = View Ticket

# Common
not-specified = Not specified
none = None
no-reason-provided = No reason provided
error-access-denied = Access denied
error-invalid-context = Invalid context
error-unknown = Error: {$error}
not-assigned = Not assigned
ticket-view = Ticket view (placeholder - using inline)
ticket-user-view = Ticket user view (placeholder - using inline)
dedicated-operation-confirm = Confirm operation (placeholder - using inline)
dedicated-menu-header = <strong>Dedicated Servers</strong>

Choose an option:
dedicated-location-select-title = Start with location selection.
dedicated-os-select-title = After selecting an operating system, the server is rented.
dedicated-purchase-success-deducted = <strong>Purchase successful.</strong> {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $ has been deducted from your balance.
dedicated-contact-support-message = To receive your dedicated server, contact our support.
button-go-to-support = Go to support
support-message-dedicated-paid = Hello! I paid for the service "{$serviceName}", location: {$location}, OS: {$os}. Can you provide it?
# Dedicated locations (table: Germany, NL/USA/Turkey)
dedicated-location-de-germany = 🇩🇪 Germany
dedicated-location-nl-amsterdam = 🇳🇱 Netherlands
dedicated-location-usa = 🇺🇸 USA
dedicated-location-tr-istanbul = 🇹🇷 Turkey
# Dedicated OS (table: Win Server 2019/2025, Win11, Alma 8/9, CentOS 9, Debian 11/12/13, Ubuntu 22/24; or Any)
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
dedicated-os-os-any = Any (your choice)
button-return-to-main = Return to main page
dedicated-not-active = Dedicated server is not active
dedicated-not-suspended = Dedicated server is not powered off
dedicated-price-not-set = Dedicated price is not set. Please contact support.
ticket-credentials-invalid = Invalid credentials. Please provide IP, login, and password.

# Withdraw Request
button-withdraw = 💸 Withdraw funds
button-referral-stats = 📊 Statistics
referral-statistics-header = 📊 Referral statistics
referral-stat-count = Referrals count: { $count }
referral-stat-reg2dep = Referral conversion (REG2DEP): { $percent }%
referral-stat-avg-deposit = Average referral deposit: { $amount } $
referral-stat-percent = Referral percentage: { $percent }%
referral-stat-active-30d = Active referrals (30 days): { $count }
referral-stat-earned = Earned
withdraw-enter-amount = <strong>Withdraw Balance</strong>

Your balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
Maximum amount: {NUMBER($maxAmount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $

Enter the amount to withdraw:
withdraw-enter-amount-short = Enter withdrawal amount (from $15 to {NUMBER($maxAmount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $):
withdraw-insufficient-balance = You have insufficient balance.
withdraw-minimum-not-met = Withdrawal is available from $15. Your balance: {$balance}$. Top up and try again.
withdraw-minimum-alert = Withdrawal from $15. Your balance: {$balance}$

Current balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
withdraw-invalid-amount = Invalid amount. Please enter a positive number.
withdraw-amount-exceeds-balance = Amount exceeds your balance.

Requested: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
Available: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
withdraw-enter-details = Enter payment details (card number, wallet, etc.):
withdraw-details-too-short = Details are too short. Please provide complete payment details.
withdraw-enter-comment-optional = Enter a comment (optional, type /skip to skip):
withdraw-confirm = <strong>Confirm Withdrawal</strong>

Amount: {$amount} $
Details: {$details}
Comment: {$comment}

Confirm withdrawal:
withdraw-cancelled = Withdrawal cancelled
withdraw-request-created = <strong>Withdrawal Request Created</strong>

Ticket #{ticketId}

A moderator will process your request shortly.
withdraw-new-notification = <strong>New Withdrawal Request #{ticketId}</strong>

User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Amount: {$amount} $
withdraw-approved = <strong>Withdrawal Request Approved</strong>

Ticket #{ticketId}
Amount: {$amount} $

Funds have been deducted from your balance.
withdraw-approved-by-moderator = Withdrawal approved
ticket-type-withdraw_request = Withdrawal Request
button-ticket-approve-withdraw = ✅ Approve Withdrawal
error-invalid-ticket-type = Invalid ticket type
error-user-not-found = User not found

# VDS Rename
vds-button-rename = ✏️ Rename
vds-rename-enter-name = <strong>Rename VDS</strong>

Current name: {$currentName}

Enter new name (between {$minLength} and {$maxLength} characters):
vds-rename-invalid-length = Invalid name length. Name must be between {$minLength} and {$maxLength} characters.
vds-rename-no-linebreaks = Name cannot contain line breaks.
vds-rename-success = <strong>VDS Renamed</strong>

New name: {$newName}
vds-current-info = <strong>{$displayName}</strong>

Status: {$status}
IP: {$ip}
CPU: {$cpu}
RAM: {$ram} GB
Disk: {$disk} GB
Network: {$network} Mbit/s
OS: {$osName}
Bulletproof: {$abuse}
Rate: {$rateName}
Renewal Price: {$price} $
Expires: {$expireAt}
vds-manage-list-item = {$displayName} ({$rateName}) - {$ip}

# Amper Domains
button-register-domain = 🌐 Register Domain
button-register-domain-amper = 🌐 Register Domain (Amper)
button-my-domains = 📋 My Domains
button-my-domains-amper = 📋 My Domains (Amper)
domains-none = You have no registered domains
domains-list = <strong>My Domains ({$count})</strong>
domain-register-enter-name = Enter domain (with or without zone): example or example.com
domain-register-enter-tld = Enter domain zone (e.g.: com, org, net):
domain-api-not-configured = Error: domain API is not configured. Check AMPER_API_BASE_URL and AMPER_API_TOKEN.
domain-invalid-format = Invalid domain format: {$domain}

Domain must be in format example.com
domain-invalid-format-registrar = Registrar rejected domain format: {$domain}
    If the input is correct (e.g. name.com), try another domain or check with support.

Possible reasons: invalid characters, TLD not supported by registrar, or zone restrictions. Use only letters, digits, and hyphen.
domain-label-too-long = Domain name (part before the dot) must not exceed {$max} characters. Current: {$length}.
domain-checking-availability = Checking domain availability {$domain}...
domain-check-error = ⚠️ Error checking domain {$domain}
domain-check-format-warning = ⚠️ Availability check via API is unavailable for domain <b>{$domain}</b>.
    Proceeding with registration — availability will be checked automatically during registration.
    If the domain is taken, your balance will not be charged (refunded).

API Error: {$error}

Please try again later or contact support.
domain-not-available = Domain {$domain} is not available for registration
domain-not-available-with-reason = Domain {$domain} is not available for registration.
    Reason: {$reason}
domain-check-unrelated-to-balance = ℹ️ Availability check is not related to balance. Amper balance is charged only when the domain is actually registered.

Registrar reason: {$reason}
domain-register-enter-period = Enter registration period in years (1-10):
domain-invalid-period = Invalid period. Enter a number from 1 to 10.
domain-register-enter-ns-optional = Enter nameservers (optional, type /skip to skip):

Format: ns1.example.com ns2.example.com
Default: {$defaultNs1} and {$defaultNs2}
domain-invalid-ns-format = Invalid nameserver format. Enter two nameservers separated by space or comma.
domain-register-confirm = <strong>Registration Confirmation</strong>

Domain: {$domain}
Period: {$period} {NUMBER($period) -> 
  [one] year
 *[other] years
}
Price: {$price} $
NS1: {$ns1}
NS2: {$ns2}

Confirm registration:
domain-register-cancelled = Domain registration cancelled
domain-registering = Registering domain {$domain}...
domain-registered = <strong>Domain Registered</strong>

Domain: {$domain}
ID: {$domainId}
Status: {$status}
domain-register-failed = <strong>Domain Registration Failed</strong>\n\nReason: { $error }
domain-register-failed-registrar-balance = Registrar (Amper) account has insufficient funds. Top up your balance in the Amper dashboard — then domain registration in the bot will work. Your bot balance was not charged (refunded).
domain-register-failed-domain-taken = Domain <b>{$domain}</b> is already taken and unavailable for registration. Your balance was not charged (refunded).
domain-register-failed-already-owned = Domain <b>{$domain}</b> is already registered to you. Add it to Services to change nameservers.
domain-import-success = Domain <b>{$domain}</b> added to Services. Go to Services → domains to change nameservers.
domain-import-not-found = Domain not found in Amper account. If you just registered it, wait a minute and try again.
button-domain-add-to-services = Add to Services
domain-service-temporarily-unavailable = ⚠️ Domain registration service is temporarily unavailable (error { $statusCode }). Please try again later.
domain-register-failed-network = ⚠️ Domain registration service is temporarily unavailable (network issue). Check Amper API availability or try again later. Your balance was not charged.
domain-check-service-unavailable = ⚠️ Domain availability check is temporarily unavailable (error { $statusCode }). Amper service is overloaded or unavailable. Please try again later.

Domain: {$domain}
Error: {$error}
domain-information-amper = <strong>Domain Information</strong>

Domain: {$domain}
Status: {$status}
TLD: {$tld}
Period: {$period} {NUMBER($period) -> 
  [one] year
 *[other] years
}
Price: {$price} $
NS1: {$ns1}
NS2: {$ns2}
button-domain-renew = 🔄 Renew
button-domain-update-ns = 🔧 Update NS
domain-renew-confirm = <strong>Domain Renewal</strong>

Domain: {$domain}
Period: {$period} {NUMBER($period) -> 
  [one] year
 *[other] years
}
Price: {$price} $

Confirm renewal:
domain-cannot-renew = Cannot renew domain with current status
domain-renewing = Renewing domain {$domain}...
domain-renewed = <strong>Domain Renewed</strong>

Domain: {$domain}
domain-update-ns-enter = <strong>Update Nameservers</strong>

Current NS:
NS1: {$currentNs1}
NS2: {$currentNs2}

Enter new nameservers (format: ns1.example.com ns2.example.com):
domain-ns-updated = <strong>Nameservers Updated</strong>

Domain: {$domain}
NS1: {$ns1}
NS2: {$ns2}
domain-status-draft = Draft
domain-status-wait-payment = Waiting Payment
domain-status-registering = Registering
domain-status-registered = Registered
domain-status-failed = Failed
domain-status-expired = Expired
years = years
default = Default

# User Statuses
user-status-newbie = 🆕 Newbie
user-status-user = 👤 User
user-status-admin = 👑 Admin
user-status-current = Current status: {$status}
button-change-status = 🔄 Change Status
button-add-balance = 💰 Add to balance
button-deduct-balance = ➖ Deduct from balance
button-balance-short = 💰 Balance
button-services-short = 🖥 Services
button-partnership-short = 🎁 Partnership
button-tickets-short = 🎫 Tickets
button-message-short = ✉ Message
button-notes-short = 📝 Notes
button-subscription-short = 🔐 Subscription
admin-subscription-grant = Grant subscription
admin-subscription-revoke = Revoke subscription
admin-subscription-enter-days = Enter number of subscription days (1–3650):
admin-subscription-granted = Subscription granted for {$days} days until {$until}.
admin-subscription-revoked = Subscription revoked.
admin-subscription-invalid-days = Invalid number. Enter days from 1 to 3650.
admin-referral-percent-enter = Enter referral percentage for this user (0–100):
admin-referral-percent-invalid = Invalid value. Enter a number from 0 to 100.
admin-referral-percent-success = Referral percentage set to {$percent}%.
button-block-short = ⛔ Block
button-status-short = 🏷 Status
button-operations-history = 📜 Operations history
button-user-stats = 📊 Statistics
button-restrictions = ⛔ Restrictions
button-financial-analytics = 📈 Financial analytics
admin-coming-soon = Coming soon.
admin-notes-coming-soon = User notes — coming soon.
admin-user-tickets-summary = User tickets: {$count}
admin-user-stats-screen = <strong>📊 User statistics</strong>

 💰 Finance: deposit {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $, top-ups {$topupsCount}, last deposit {$lastDepositStr}
 🛠 Services: active {$activeServicesCount}, total {$totalServicesCount}
 🎫 Tickets: {$ticketsCount} | Orders: {$ordersCount}
 📅 Registration: {DATETIME($createdAt, dateStyle: "long", timeStyle: "short")}
 🔥 Last activity: {$lastActivityStr}
 💵 Referral income: {$referralIncome} $
admin-balance-enter-amount = Enter amount for action "<i>{$action}</i>" (positive number, up to 1,000,000):
admin-balance-action-add = add
admin-balance-action-deduct = deduct
admin-balance-invalid = Invalid amount. Enter a positive number.
admin-balance-deduct-more-than-have = User balance is {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $; cannot deduct {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $.
admin-balance-success = Done. Action: {$action}, amount: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $. User's new balance: <b>{NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $</b>.

button-message-to-user = ✉️ Message to user
button-manage-user-services = 🛠 Manage services
button-manage-user-referrals = 🤝 Manage partnership
admin-message-to-user-enter = Enter the message text for the user:
admin-message-to-user-prefix = 📩 Message from administration:
admin-message-to-user-sent = Message sent.
admin-message-to-user-failed = Failed to send message: {$error}
admin-user-services-summary =
  <strong>User services</strong>

  💰 Total deposit: {NUMBER($totalDeposit, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
  🛠 Active services: {$activeServicesCount}
  🎫 Tickets: {$ticketsCount}

  VPS/VDS: {$vdsCount} · Dedicated: {$dedicatedCount} · Domains: {$domainCount}
admin-user-services-domains-title = <strong>User domains</strong>
admin-domain-ns-prompt =
  Enter nameservers on one line, space-separated:
  <code>ns1.example.com ns2.example.com</code>
  Cancel: /cancel
admin-domain-ns-success = Nameservers for <b>{$domain}</b> updated.
admin-domain-ns-cancelled = Cancelled.
admin-domain-ns-failed = Failed to update NS: {$error}
admin-domain-set-amper-id-prompt = Enter Amper Domain ID (copy from Amper dashboard or API response):
admin-domain-set-amper-id-success = Amper ID for domain <b>{$domain}</b> saved. You can now change NS.
admin-domain-set-amper-id-cancelled = Cancelled.
button-admin-domain-change-ns = Change NS
button-admin-set-amper-id = Set Amper ID
button-admin-services-back = Back to summary
button-admin-domains-list = 🌐 Domains ({$count})
button-admin-register-domain = ➕ Register domain
admin-domain-register-prompt = Send domain name (e.g. <code>example.com</code>). The domain will be added to the user without payment. Cancel: /cancel
admin-domain-register-success = Domain <b>{$domain}</b> added for user. You can set Amper ID and NS in the domains list.
admin-domain-register-cancelled = Cancelled.
admin-domain-register-failed = Failed: {$error}
admin-user-referrals-summary = <strong>Referral</strong>

 Referrals: {$count}
 Referral conversion (REG2DEP): {$conversionPercent}%
 Avg deposit per referral: {$avgDepositPerReferral} $
 Referral percentage: {$referralPercent}%

 💰 Referral balance: {NUMBER($referralBalance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $
 (profit from referral purchases per ref. %, available to withdraw)

 Referral link:
 {$link}

 Active referrals (30 days): {$activeReferrals30d}

# Prime Subscription (Dior Host)
prime-subscription-title = 🔐 Prime Subscription
prime-subscription-body = Extended terms for active clients and infrastructure owners.

 What Prime gives you:

 🏷 20% discount on all domain zones
 Access to a special rate with no limit on the number of registrations.

 ⚡ Priority order processing
 Your domains and services are processed first.

 📈 Better commercial terms
 Flexible approach for volume and long-term orders.

 💬 Priority support
 Fast response on infrastructure and billing questions.

 🎁 Free 7-day trial
prime-subscription-intro = Unlocks the following benefits for you:
prime-subscription-benefit-ssl = Automatic SSL installation 🔰 (CloudFlare): A separate account is created for each domain, linked to your specified IP address!
prime-subscription-benefit-discount = 🏷 You get a 20% discount on all available domains!
prime-subscription-benefit-notify = Automatic domain status notification: You will be automatically notified via the bot if a 🟥 "Red Plate" appears on your domain. No need to worry about your domain status.
prime-subscription-status-active = ✅ Subscription active
prime-subscription-status-inactive = ❌ Subscription not active
prime-subscription-status-until = Active until: {$date}
prime-trial-activate = 🎁 Activate for $0 for 7 days (Then {$monthlyPrice}$/month)
prime-trial-via-channel = Subscribe to our channel to get a free Prime subscription for 7 days
prime-button-activate-trial = 🎁 Activate for $0 for 7 days
prime-button-menu-row = 🔐 Prime Subscription −20% on domains
prime-button-go-subscribe = ↗️ Go and subscribe
prime-button-i-subscribed = ✅ I have subscribed
prime-trial-activated = ✅ Prime subscription activated for 7 days! You now have a 20% discount on domains.
prime-subscribe-message = Subscribe to our <a href="{$channelLink}">channel</a> to get a free Prime subscription for 7 days
prime-trial-activated-message = 💎 Your Prime subscription has been activated for 1 week!
prime-trial-already-used = You have already used the free trial. Continue subscription at {$monthlyPrice}$/month.
prime-trial-subscribe-first = Please subscribe to the channel first, then press "I have subscribed".
prime-trial-subscribe-first-retry = Subscription not detected. Subscribe via the button above, wait 5–10 seconds and press "I have subscribed" again. Ensure the bot is added to the channel as an administrator.
prime-channel-not-configured = Channel for free trial is not configured. Contact support.
prime-discount-dedicated = 🔐 Prime Subscription −20% on Dedicated
prime-discount-vds = 🔐 Prime Subscription −20% on VPS/VDS

profile-prime-no = Prime: No
profile-prime-until = Prime: until {$date}

nps-promoter = Thanks for the high rating! 🎉 Invite friends via your referral link — earn % from their deposits. Or use the yearly renewal discount in your profile.
nps-detractor = Sorry something wasn't right. Contact support — we'll look into it and help. The «Ask question» button in the menu opens a chat with us.
nps-neutral = Thanks for your feedback. If you have ideas on how we can improve — contact support. We're here for you.

# Infrastructure Bundles
button-infrastructure-bundle = 🚀 Infrastructure Bundle
bundle-infrastructure-bundles = 🚀 Infrastructure Bundles (Domain + VPS)
bundle-select-type = Select bundle type:
bundle-starter-shield = Starter Shield
bundle-launch-pack = Launch Pack
bundle-infrastructure = Infrastructure Bundle
bundle-secure-launch = Secure Launch Kit
bundle-full-stack = Full Stack Deploy Pack
bundle-pro-infrastructure = Pro Infrastructure Pack
bundle-starter-shield-desc = Basic package: domain + VPS + protection
bundle-starter-shield-title = 🚀 Starter Shield
bundle-starter-shield-intro = Basic infrastructure package for quick project launch
bundle-starter-shield-tagline = Ready solution: bulletproof domain + server + basic protection in one bundle.
    Minimum manual steps — maximum launch speed.
bundle-starter-shield-includes-title = Package includes
bundle-starter-shield-includes-list = ✔️ Bulletproof Domain
    ✔️ Bulletproof VPS
    ✔️ Free DNS setup
    ✔️ Domain to VPS binding
    ✔️ Pre-config Firewall
    ✔️ 1 dedicated IP included
bundle-starter-shield-benefits-title = What you get
bundle-starter-shield-benefits-list = — Full control over infrastructure
    — Lower technical risks at start
    — Time saved on manual setup
    — Single point of management
bundle-starter-shield-pricing-title = Pricing
bundle-starter-shield-pricing-base = Base cost
bundle-starter-shield-pricing-discount = Package discount
bundle-starter-shield-pricing-final = Final price
bundle-starter-shield-pricing-savings = Your savings
bundle-launch-pack-desc = Ready to launch: domain + VPS + DNS setup + SSL + deploy template
bundle-infrastructure-desc = Full infrastructure: domain + powerful VPS + all configurations
bundle-secure-launch-desc = Secure launch: domain + VPS + SSL + firewall + protection
bundle-full-stack-desc = Full stack: domain + VPS + all deployment tools
bundle-pro-infrastructure-desc = Professional package: domain + powerful VPS + Reverse DNS + monitoring + Extra IP
bundle-pro-infrastructure-title = 🚀 Pro Infrastructure Pack
bundle-pro-infrastructure-intro = Professional stack for serious projects and load
bundle-pro-infrastructure-tagline = Complete infrastructure solution: enhanced VPS, extended network and basic monitoring.
    Ready production bundle without manual tuning.
bundle-pro-infrastructure-includes-title = Package includes
bundle-pro-infrastructure-includes-list = ✔️ Bulletproof Domain
    ✔️ Powerful VPS/VDS
    ✔️ Free DNS setup
    ✔️ Domain to VPS binding
    ✔️ Basic nginx config
    ✔️ SSL certificate
    ✔️ Pre-config firewall
    ✔️ 1 main IP included
    ✔️ Ready deploy template (LAMP / Docker / FastPanel)
    ✔️ Reverse DNS
    ✔️ Private DNS
    ✔️ Basic availability monitoring
    ✔️ Extra IP
bundle-pro-infrastructure-benefits-title = Key benefits
bundle-pro-infrastructure-benefits-list = — Extended network config (Reverse + Private DNS)
    — Ready environment for fast deploy
    — Better isolation and manageability
    — Suited for long-term projects and scaling
    — Lower operational risks at start
bundle-includes = Package includes:
bundle-pricing = Pricing:
bundle-base-price = Base price
bundle-discount = Discount
bundle-final-price = Final price
bundle-savings = Savings
bundle-ready-in-15min = ⚡ Ready infrastructure to launch in 15 minutes
bundle-button-purchase = 💳 Buy bundle
bundle-button-change-period = 📅 Change period
bundle-period-monthly = 1 month
bundle-period-quarterly = 3 months
bundle-period-semi-annual = 6 months
bundle-discount-12 = -12%
bundle-discount-17 = -17%
bundle-discount-20 = -20%
bundle-feature-domain = Bulletproof Domain
bundle-feature-vps = VPS/VDS
bundle-feature-dns-setup = Free DNS setup
bundle-feature-domain-binding = Domain to VPS binding
bundle-feature-nginx = Basic nginx config
bundle-feature-ssl = SSL certificate
bundle-feature-firewall = Pre-config firewall
bundle-feature-ip = 1 IP included
bundle-feature-deploy-template = Ready deploy template (LAMP/Docker/FastPanel)
bundle-feature-reverse-dns = Reverse DNS
bundle-feature-private-dns = Private DNS
bundle-feature-monitoring = Basic monitoring
bundle-feature-extra-ip = Extra IP
bundle-upsell-domain = 🔥 Add VPS — save up to 20%!
bundle-upsell-vps = 🔥 Add domain — save up to 20%!
bundle-button-upgrade = Upgrade to Launch Pack
bundle-back-to-types = Back to types
bundle-enter-domain-name = Enter domain (with or without zone): example or example.com
bundle-confirm-purchase-text = Domain: <b>{ $domain }</b>
Bundle total: <b>${ $price }</b>

Confirm purchase?
bundle-purchase-success = <strong>Bundle purchased</strong>
Domain: { $domain }
VPS ID: { $vdsId }
IP: { $ip }
bundle-purchase-domain-only = Domain <b>{ $domain }</b> registered successfully.
VPS is temporarily unavailable (VMManager not connected). When you connect it, bundles with VPS will work.
bundle-unavailable-no-vm-no-amper = Bundle unavailable: VPS (VMManager) and domains (Amper) are not configured. Set up .env and try again later.
bundle-select-period = Select payment period: