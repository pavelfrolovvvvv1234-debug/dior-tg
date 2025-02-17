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
button-about-us = 📖 About us 📖
button-change-locale = 🇺🇸 Change language
button-ask-question = Ask question
button-deposit = 📤 Top up
button-promocode = 🎁 Promocode
button-contact-with-client = Contact with client
button-domains = 🌐 Domains
button-vds = 🖥 Virtual Dedicated Server (VDS)
button-dedicated-server = 🖥 Dedicated server

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

button-buy = ✅ Make order

domain-question = Write the domain you would like to purchase please do not specify <i>{$zoneName}</i>
domain-invalid = The entered domain is incorrect <i>{$domain}</i>
domain-not-available = 🚫 Domain <i>{$domain}</i>, already taken. Try to take another one.
domain-available = ✅ Domain <i>{$domain}</i> is available for registration. You want to buy it?

deposit-money-enter-sum = Write the amount you want to replenish (integer dollar amount)
deposit-money-incorrect-sum = The entered amount is incorrect

deposit-success-sum = ✅ Great, now all that's left to do is <u>pay</u> and we'll credit your balance.
 
 <blockquote>Top-up amount: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</blockquote>

 <strong>Select a payment method</strong>

payment-information = After payment wait a little, the system will automatically confirm the payment and the funds will be automatically credited to your account, if this did not happen please contact support.
payment-next-url-label = Proceed to payment
payment-await = Please wait...

deposit-by-sum = Your account has been funded with {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 2)} $