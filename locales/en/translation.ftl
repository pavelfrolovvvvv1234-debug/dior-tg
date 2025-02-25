-language-icon = 🇺🇸
-language-name = English

quoted-balance = <blockquote>Your balance: {NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</blockquote>
strong-balance = <strong>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</strong>

welcome = Hi! I'm a DripHosting bot.
 With me, you can easily order services right here. 

 We're the one bulletproof hosting where your projects will work stably 24/7. If you have any questions, our support is always on call: @drip_sup.
 
 {quoted-balance}

about-us = We provide reliable and high-performance VDS dedicated servers and hosting services.

 Our infrastructure provides anonymity, data security and stable performance with speeds up to 1 GBit/s.
 
 With us you get full control over services, flexible rates and 24/7 support from professionals.

support = Do you have any questions? Feel free to ask us! We will try to solve the question within 15 minutes

support-message-template = Hello!
 I have a question.

profile = Your balance: {strong-balance}
 Your ID: {$id} ({$name})

button-purchase = 💳 Purchase service
button-manage-services = 🛠 Manage services
button-personal-profile = 🧑‍💼 Profile
button-support = 🤝 Support
button-about-us = 📖 About us
button-change-locale = 🇺🇸 Change language
button-ask-question = Ask question
button-tp = Support
button-deposit = 📤 Top up
button-promocode = 🎁 Promocode
button-contact-with-client = Contact with client
button-domains = 🌐 Domains
button-vds = 🖥 Virtual Dedicated Server (VDS)
button-dedicated-server = 🖥 Dedicated server
button-agree = ✅ Agree
update-button = 🔄 Update

button-back = 🔙 Back
button-close = ❌ Close

button-change-locale-en = 🇺🇸 English
button-change-locale-ru = 🇷🇺 Русский

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

-users-list = Users list
-users-list-empty = Users list is empty
-user-info = Control Panel by user

control-panel-users = {-users-list}

control-panel-about-user = {-user-info}
 ID: {$username} ({$id})
 {quoted-balance}
 Account created at: {DATETIME($createdAt, dateStyle: "long", timeStyle: "short")}
 
-balance = Balance
-id = ID

sorting-by-balance = Sorting by: {-balance}
sorting-by-id = Sorting by: {-id}

sort-asc = 🔽
sort-desc = 🔼

pagination-left = ⬅️
pagination-right = ➡️

block-user = 🚫 Block
unblock-user = ✅ Unblock

message-about-block = Unfortunately you are blocked. Contact support for clarification of the reasons for blocking.

button-buy = 💸 Make order

domain-question = Write the domain you would like to purchase please do not specify <i>{$zoneName}</i>
domain-invalid = The entered domain is incorrect <i>{$domain}</i> try again
domain-not-available = 🚫 Domain <i>{$domain}</i>, already taken. Try to take another one.
domain-available = ✅ Domain <i>{$domain}</i> is available for registration. You want to buy it?
domain-registration-in-progress = 🔄 Domain registration in progress for <i>{$domain}</i> (Your balance has been debited) You can follow the status in the service management menu

empty = Empty
list-empty = The list is empty

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

deposit-money-enter-sum = Write the amount you want to replenish (integer dollar amount)
deposit-money-incorrect-sum = The entered amount is incorrect

domain-was-not-found = Domain was not found

domain-information = Domain <i>{$domain}</i>

 <strong>Expiration date</strong>: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
 <strong>Renewal date</strong>: {DATETIME($paydayAt, dateStyle: "long", timeStyle: "short")}
 <strong>Price renewal</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 2)} $

 <i>📌 Renewal is automatic, please top up your balance in advance</i>

 To change the NS or IP binding, contact tech support.

deposit-success-sum = ✅ Great, now all that's left to do is <u>pay</u> and we'll credit your balance.
 
 <blockquote>Top-up amount: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</blockquote>

 <strong>Select a payment method</strong>

payment-information = After payment wait a little, the system will automatically confirm the payment and the funds will be automatically credited to your account, if this did not happen please contact support.
payment-next-url-label = Proceed to payment
payment-await = Please wait...

deposit-by-sum = Your account has been funded with {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $

money-not-enough = You don't have enough money on your balance ({NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $ short)

invalid-arguments = Invalid arguments

new-promo-created = New promo are added /promo_codes - for see

promocode-already-exist = promocode with this name already exists

promocode = {$id} <strong>{$name}</strong> (Uses: {$use}/{$maxUses}) : {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $
promocode-deleted = Promocode <strong>{$name}</strong> successfully deleted

promocode-not-found = Promocode was not found
promocode-input-question = Enter the promocode
promocode-used = The promo code was successfully used and you are credited on your balance {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $

menu-service-for-buy-choose = 📃 <strong>Select the category of services to purchase</strong>

manage-services-header = 🛠 Manage services

 {quoted-balance}


vds-menu-rate-select = test

vds-bulletproof-mode-button-on = Bulletproof: ON
vds-bulletproof-mode-button-off = Bulletproof: OFF

vds-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 2)} $, {$cpu} cores, {$ram} gb ram, {$disk} gb disk

bulletproof-on = ✅ Bulletproof rate
bulletproof-off = ⚠️ Isn't bulletproof rate

vds-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU (Cores): </strong> {$cpu}
 <strong>💾 RAM: </strong> {$ram} Gb
 <strong>💽 Disk (SSD/NVME): </strong> {$disk} Gb
 <strong>🚀 Network Speed: </strong> {$network} Mbit/s
 <strong>🛜 Bandwidth: </strong> Unlimited

 <strong>OS: </strong> Windows/Linux

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 2)} $ / month

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
 <strong>Renewal Price</strong>: {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 2)} $
 
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

dedicated-servers = This section will be available soon, but in the meantime you can familiarize yourself with the allocated machines on the site https://driphosting.com/en/abuse/dedicated/. You can place your order through the support.

vds-expiration = Your VDS Expires. Refill your balance by {$amount} $

no-vds-found = User don't have VDS

vds-info-admin = {$id}. {$ip} {$expireAt} - Renewal price {NUMBER($renewalPrice, style: "currency", currency: "USD", minimumFractionDigits: 2)} $

vds-removed = VDS removed

vds-remove-failed = Remove VDS with ID {$vdsId} failed

vds-select-os-confirm = You choose {$osName}. You want to continue?
vds-select-os-next = Continue

failed-to-retrieve-info = Error retrieving machine information

await-please = Please await...