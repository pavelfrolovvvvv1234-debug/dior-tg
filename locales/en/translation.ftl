-language-icon = 🇺🇸
-language-name = English

welcome = Hi! I'm a DripHosting bot.
 With me, you can easily order services right here. 

 We're the one bulletproof hosting where your projects will work stably 24/7. If you have any questions, our support is always on call: @drip_sup.
 
 <blockquote>Your balance: {NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</blockquote>

about-us = We provide reliable and high-performance VDS dedicated servers and hosting services.

 Our infrastructure provides anonymity, data security and stable performance with speeds up to 1 GBit/s.
 
 With us you get full control over services, flexible rates and 24/7 support from professionals.

support = Do you have any questions? Feel free to ask us! We will try to solve the question within 15 minutes

support-message-template = Hello!
 I have a question.

profile = Your balance: <strong>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</strong>
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

button-back = 🔙 Back
button-close = ❌ Close

button-change-locale-en = 🇺🇸 English
button-change-locale-ru = 🇷🇺 Русский

button-go-to-site = Go to website
button-user-agreement = User agreement

button-send-promote-link = 📤 Send link

promote-link = The link has been created. It will be active for 6 hours.

admin-help = Available commands for Administrator:
 1. /promote_link - Create a link to raise user rights
 <blockquote>This link will allow you to get moderator rights, after its creation it will be active for 6 hours.</blockquote>

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
 <blockquote>Balance of user: {NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 2)} $</blockquote>
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