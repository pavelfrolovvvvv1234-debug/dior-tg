-language-icon = 🇺🇸
-language-name = English

quoted-balance = <blockquote>Balance: {NUMBER($balance, minimumFractionDigits: 0, maximumFractionDigits: 0)} $</blockquote>
strong-balance = <strong>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</strong>

welcome = 🔷 DiorHost — Servers, Domains, CDN
    Bulletproof Infrastructure
    High availability • No logs, No KYC • 99.9% uptime
    
    👤 @{$username}
    ├ <b>Balance:</b> <code>${NUMBER($balance, minimumFractionDigits: 2, maximumFractionDigits: 2)}</code>
    ├ <b>ID:</b> <code>{$userIdText}</code>
    └ <b>Servers purchased:</b> <code>{$servicesCount}</code> pcs
    

about-us = We provide reliable and high-performance VDS dedicated servers and hosting services.

 Our infrastructure provides anonymity, data security and stable performance with speeds up to 1 GBit/s.
 
 With us you get full control over services, flexible rates and 24/7 support from professionals.

support = 🛠 Support

 Describe your issue or request.
 We'll get back to you shortly.

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

button-purchase = 🔎 Select Plan
button-manage-services = 💼 Services
button-personal-profile = 👤 Profile
button-support = 🛠 Support
button-about-us = 📖 About us
button-change-locale = 🌐 Language
button-ask-question = 📨 Contact Support
button-support-back = ⬅️ Back
button-tp = Support
button-deposit = 💳 Balance
button-promocode = 🎁 Promo Code
button-subscription = 🔐 Subscription
button-website = Web Site
button-support-profile = 🔔 Support
button-dior-news = Dior News
button-contact-with-client = Contact with client
button-domains = 🌐 Bulletproof Domains
button-vds = 🖥 VPS/VDS
button-cdn = 🌍 Cloudflare alternative
button-cdn-add-proxy = ➕ Add proxy
button-cdn-my-proxies = 📋 My proxies
button-bundle-manage = 🚀 Infrastructure Bundle
bundle-manage-header = <strong>🚀 Infrastructure Bundle</strong>

    Services purchased as a bundle (domain + VPS):
bundle-manage-empty = You have no bundle services yet
button-dedicated-server = 🔒 Dedicated Servers

# Purchase services — labels for current locale (3 buttons + language toggle)
button-service-buy-domains = 🌐 Domains
button-service-buy-cdn = 🛡 CDN
button-service-buy-dedicated = 🔒 Dedicated

button-dev-po = ⚡ Turnkey product
button-dev-po-discuss = 💬 Discuss project
button-crypto-exchange = 💱 Crypto Exchange
button-crypto-exchange-go = 💱 Go to exchanger
service-crypto-exchange = <b>💱 Crypto Exchange</b><br><br>Fast cryptocurrency exchange in our DiorChange bot — no extra registration or delays. Choose a pair, enter the amount (from $2) and get the exchange at a competitive rate.<br><br>Press the button below to open the DiorChange exchanger bot.
service-dev-po = <b>💻 Development &amp; Infrastructure</b><br><br>Designing and scaling digital products: code, traffic, infrastructure.<br><br>🌐 Web — fast, SEO-ready sites focused on conversion<br>⚙️ Backend — APIs, auth, billing, scalable systems<br>🤖 Automation — Telegram/Discord bots, panels, workflows<br>🧱 DevOps — VPS/Dedicated, Docker, secure deploy<br>📊 SEO — technical SEO, analytics, architecture for growth<br>🚀 Launch — from MVP to stable production<br><br>💰 From $10 (depends on task and scale)<br><br>To order — contact support using the button below
support-dev-po-template = Development & infrastructure — please describe your brief below (scope, features, deadlines).

Describe your requirements: what to develop, features, deadlines and wishes:
button-balance = 💳 Balance
button-standard = 🛡 Standard
button-bulletproof = ⚜️ Bulletproof
button-agree = ✅ Agree
update-button = 🔄 Update

button-back = ⬅️ Back
button-back-to-panel = ⬅️ Back to panel

# Profile root menu only
button-profile-back = ⬅️ Back
button-change-percent = 📊 Change percentage
button-change-referral-percent = 📊 Referral %
button-close = ❌ Close
button-open = ✅ Open
button-pay = ✅ Pay
button-pay-service = 💳 Pay
button-copy-ip = 📋 IP
button-copy-login = 📋 Login
button-copy-password = 📋 Password
button-copy-link = 📋 Link
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
admin-notification-topup = 💳 <strong>Balance top-up</strong>\nBuyer: {$username}\n{$referralLine}\nAmount: {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $\nPayment method: {$paymentMethod}

-users-list = Users list
-users-list-empty = Users list is empty

control-panel-users = {-users-list}

admin-lookup-user-button = 🔍 Find user
admin-lookup-user-prompt = Send the user’s <b>internal DB id</b>, numeric <b>Telegram id</b>, or public <b>@username</b> (5–32 chars).
admin-lookup-user-not-found = User not found. Use the <b>internal id</b> from the list (#350), <b>Telegram id</b>, or <b>@username</b> (as shown in the list). If @username fails, open the user from the list or ask them to send /start to the bot.
admin-lookup-vds-button = 🔍 Find VDS

control-panel-about-user =
    <b>👤 User</b>{$gap}
    ID: {$id} • TG: <code>{$telegramId}</code>
    {$usernameDisplay}
    Role: {$roleBadge} • {$userLevelLabel}
    Status: {$statusLine} • Subscription: {$primeStatusLabel}{$gap}
    <b>👥 Referral</b>
    {$referralLine}{$gap}
    <b>💳 Finance</b>
    Balance: {$balanceFormatted}
    Deposits: {$depositFormatted}
    Top-ups: {$topupsCount}{$gap}
    <b>📊 Activity</b>
    Services: {$activeServicesCount} active / {$totalServicesCount} total
    Tickets: {$ticketsCount} • Orders: {$ordersCount}{$gap}
    <b>🕒 Metadata</b>
    Registered: {$registeredAtStr}
    Last active: {$lastActiveStr}

control-panel-user-status-active = 🟢 Active
control-panel-user-status-banned = ⛔ Banned
control-panel-prime-yes = Yes
control-panel-prime-no = None

-balance = Balance
-id = ID
admin-user-status-active = Active
admin-user-status-banned = Banned
admin-prime-status-yes = Yes
admin-prime-status-no = No
admin-user-level-user = User
admin-user-level-moderator = Moderator
admin-user-level-admin = Admin

role-badge-user = 👤 USER
role-badge-mod = 🛡 MOD
role-badge-admin = ⚡ ADMIN

admin-users-role-filter = 🔽 Role: {$label}
admin-users-filter-all = All
admin-users-filter-user = USER
admin-users-filter-mod = MOD
admin-users-filter-admin = ADMIN

control-panel-referral-line = {$referralPercent}% · balance {NUMBER($referralBalance, minimumFractionDigits: 0, maximumFractionDigits: 2)} $ · invites {$referralCount}

admin-date-format = {DATETIME($date, dateStyle: "medium", timeStyle: "short")}

sorting-by-balance = Sorting by: {-balance}
sorting-by-id = Sorting by: {-id}

sort-asc = 🔽
sort-desc = 🔼

# Admin Panel
button-admin-panel = ⚙️ Admin
button-control-users = 👥 Users
button-tickets = 🎫 Tickets
button-promocodes = 🎟 Promocodes
button-automations = 📬 Automations & Notifications
button-statistics = 📊 Statistics
button-resellers = 🤝 Resellers
admin-resellers-line-mrr = • MRR (Monthly Recurring Revenue), est.: <b>{ $amount }</b>

# DIOR CONTROL — reseller panel (ars)
ars-hub-title = <b>DIOR CONTROL</b> · Partners
ars-hub-kpi = { $partners } in DB · VPS <b>{ $active }</b>/<b>{ $total }</b>
ars-hub-mrr = MRR <b>{ $mrr }</b>
ars-hub-top-label = Leaders
ars-hub-top-line = { $n} · <code>{ $id }</code> · { $amount} · { $svc } VPS

ars-btn-resellers = 👤 Partners
ars-btn-api-keys = 🔑 API
ars-btn-services = 🖥 VPS
ars-btn-finance = 💰 MRR
ars-btn-analytics = 📈 Overview
ars-btn-logs = 🧾 Log
ars-btn-security = 🔐 Access
ars-btn-system = ⚙ Infra
ars-btn-add-reseller = ＋ New partner
ars-btn-hub = ← Overview
ars-btn-add = ＋ Add
ars-btn-list = ← List
ars-btn-reseller-back = ← Profile
ars-btn-create = ✓ Create
ars-btn-cancel = ✕ Cancel
ars-btn-skip = Skip →
ars-btn-confirm-rotate = Confirm
ars-btn-rotate-key = ↻ API key
ars-btn-show-signing = 🔏 Signing
ars-show-signing-done = Signing secret for <code>{ $id }</code> (stored in DB):\n<code>{ $secret }</code>
ars-show-signing-missing = No signing secret stored for <code>{ $id }</code>. Open partner profile after bot restart or rotate API key.
ars-rotate-done-signing = Signing: <code>{ $secret }</code>
ars-btn-suspend = Suspend
ars-btn-activate = Activate

ars-list-title = <b>Partners</b>
ars-list-page = { $page } / { $total }
ars-list-empty = Empty. Create a partner below.
ars-list-legacy-badge = legacy · no API profile
ars-btn-ensure-profile = ⚙ Create API profile
ars-ensure-done-title = API profile for <code>{ $id }</code> is ready
ars-ensure-new-key = New API key (save now):\n<code>{ $key }</code>
ars-ensure-failed = Could not create profile: { $error }

reseller-api-cmd-none = You do not have Reseller API access. Contact support.
reseller-api-cmd-ok = { $body }

ars-detail-title = <code>{ $id }</code>
ars-detail-wallet = Balance <b>{ $balance }</b>
ars-detail-wallet-unlinked = Balance <i>not linked</i>
ars-detail-status-line = { $status } · { $plan }
ars-detail-tg = { $line }
ars-detail-kpi = VPS <b>{ $active }</b>/<b>{ $count }</b> · clients <b>{ $clients }</b>
ars-detail-mrr = MRR <b>{ $mrr }</b>
ars-detail-legacy = <i>Services only (no profile)</i>
ars-detail-api-keys-title = API
ars-detail-api-keys-none = no keys
ars-detail-key-line = { $status } · <code>{ $prefix }</code>

ars-finance-title = <b>MRR</b>
ars-finance-mrr = MRR <b>{ $mrr }</b> · VPS <b>{ $count }</b>
ars-finance-accounts = Partners <b>{ $accounts }</b> · ARR <b>{ $arr }</b>
ars-finance-top = Leaders
ars-finance-top-line = { $n} · <code>{ $id }</code> · { $amount }

ars-analytics-title = <b>Overview</b>
ars-analytics-body = VPS <b>{ $count }</b> · <code>{ $url }</code>

ars-logs-title = <b>Audit</b>
ars-logs-page = { $page }
ars-logs-empty = empty

ars-security-title = <b>Access</b>
ars-security-body = SHA-256 keys · HMAC · IP allowlist · rate limit
ars-security-docs = <code>{ $url }</code>

ars-system-title = <b>Infra</b>
ars-system-body = <code>{ $url }</code> · API { $enabled } · :{ $port }
ars-system-env-hint = After restart — keys in .env (snippet on create).

ars-keys-title = <b>API keys</b>

ars-services-recent-title = <b>Partner VPS</b>
ars-services-recent-empty = empty
ars-services-title = <code>{ $id }</code>
ars-services-line = #{ $sid } · { $ip } · ${ $price }

ars-rotate-confirm = Rotate API key for <code>{ $id }</code>? Old key revoked.
ars-rotate-done-title = <b>Key updated</b>
ars-rotate-done-reseller = <code>{ $id }</code>
ars-rotate-done-key = <code>{ $key }</code>
ars-rotate-failed = Rotation failed

ars-access-denied = Access denied

ars-onb-title = <b>New partner</b>
ars-onb-step1 = Telegram (optional)
ars-onb-step1-hint = ID or @username · or Skip
ars-onb-step2-title = Create?
ars-onb-id = <code>{ $id }</code>
ars-onb-tg-linked = TG <code>{ $tgId }</code>{ $username }
ars-onb-tg-billing-hint = Top up bot balance before API use.
ars-onb-tg-skipped = No TG — API create unavailable
ars-onb-confirm-hint = <code>yes</code> create · else cancel
ars-onb-cancelled = Cancelled
ars-onb-created-title = <b>Partner created</b>
ars-onb-env-hint = Add to .env after restart:
ars-onb-dm-ok = DM sent
ars-onb-dm-fail = DM not delivered
ars-onb-failed = Error: { $error }

ars-status-active = active
ars-status-suspended = suspended
ars-status-pending = pending

admin-automations-header = <strong>📬 Automations & Notifications</strong>
admin-automations-description = Enable or disable scenarios. Full config in web panel.
admin-automations-empty = No scenarios. Add them via API or web panel.
admin-automations-web-hint = 🔗 Full trigger, template and offer config — use the button below.
admin-automations-open-web = 🌐 Open web panel
button-promos-create = ➕ Create promo code
admin-statistics-header = 📊 Purchase statistics
admin-statistics-topups = Top-ups
admin-statistics-purchases = New users
admin-statistics-sum = Profit
admin-statistics-24h = Last 24 hours
admin-statistics-7d = Last 7 days
admin-statistics-30d = Last 30 days
admin-statistics-all = All time
admin-service-percents-header = <strong>📊 Service percentages</strong>
admin-service-percent-all = Overall (all services)
admin-service-percent-line = • {$name}: {$percent}%
admin-service-percent-vds-block = <b>VDS</b>: Standard {$standard}%, Bulletproof {$bulletproof}%
admin-service-percent-dedicated-block = <b>Dedicated</b>: Standard {$standard}%, Bulletproof {$bulletproof}%
admin-service-percents-prompt = Tap a button and enter percentage (0–100).
admin-service-percents-submenu = percentages
admin-service-percents-vds-header = <strong>🖥 VDS percentages</strong>
admin-service-percents-dedicated-header = <strong>🔒 Dedicated percentages</strong>
admin-service-percent-enter = Enter percentage (0–100) for «{$name}»:
admin-service-percent-success = Percentage for «{$name}» set to {$percent}%.
button-delete = 🗑 Delete
admin-panel-header = <strong>⚙️ Admin Panel</strong>
admin-promoted-notification = You have been granted administrator status. Tap the button below or use the /admin command. The Admin button will also appear in your Profile.
button-open-admin-panel = ⚙️ Open admin panel

Select an action:
moderator-menu-header = <strong>Moderator Panel</strong>

# Referrals
button-referrals = 👥 Referrals
button-share-link = 🔗 Share
referrals-screen = 🚀 Affiliate Program\n\nMonetize your traffic with DiorHost infrastructure.\n\n💸 Up to 30% commission\n♾ Lifetime earnings\n⚡ Withdrawals from $10\n📊 Built-in analytics\n\n🔗 Your link:\n{$link}\n\n👥 Referrals: {$count}\n💰 Earnings: $ { $profit }

referrals-screen-premium =
    <b>💼 Affiliate Center · DiorHost</b>
    
    <i>Enterprise hosting partner program</i>
    
    {$tierEmoji} <b>Tier {$tier}</b> · {$referralPercent}% commission
    
    ━━━━━━━━━━━━━━
    <b>📊 Performance</b>
    👥 Referrals: <b>{$totalReferees}</b> · active: <b>{$activeReferees}</b>
    💰 Earned: <b>${$totalEarned}</b> · 7d: <b>${$earned7d}</b> · 30d: <b>${$earned30d}</b>
    💳 Pending: <b>${$pendingPayout}</b> · conversion: <b>{$conversionRate}%</b>
    🕒 Last referral: {$lastJoin}
    
    ━━━━━━━━━━━━━━
    🔗 <b>Your link</b>
    <code>{$link}</code>
    
    ━━━━━━━━━━━━━━
    💼 Partner balance: <b>${$profit}</b>

button-my-referrals = 👥 My Referrals
ref-loading = ⏳ Loading affiliate center…

ref-list-header-title = <b>👥 My Referrals</b>
ref-list-summary-card =
    {$tierEmoji} <b>{$tier}</b> · referrals <b>{$total}</b> (active {$active})
    💰 Lifetime <b>${$earned}</b> · pending <b>${$pending}</b>
    📈 Conversion <b>{$conversion}%</b> · last: {$lastJoin}
ref-list-empty = No referrals yet. Share your link from overview.
ref-list-tap-hint = Tap a referral below for details ↓
ref-list-page = Page {$current} / {$total}

ref-sort-label-earnings = Sort: earnings
ref-sort-label-join = Sort: join date
ref-sort-label-activity = Sort: activity
ref-sort-label-spent = Sort: spending
ref-filter-label-all = Filter: all
ref-filter-label-active = Filter: active
ref-filter-label-inactive = Filter: inactive
ref-filter-label-deposited = Filter: deposited

ref-status-active = 🟢 active
ref-status-inactive = ⚪ inactive
ref-row-joined = Joined:
ref-row-last = Last seen:
ref-row-services = Services:
ref-row-earned = Referral revenue:
ref-row-spent = Spent:

ref-btn-sort = ⇅ Sort
ref-btn-filter = ⊙ Filter
ref-btn-search = 🔍 Search
ref-btn-activity = ⚡ Feed
ref-btn-analytics = 📈 Analytics
ref-btn-back-hub = ⬅️ Overview
ref-btn-back-list = ⬅️ Back to list

ref-sort-menu-title = <b>⇅ Sort referrals</b>
ref-filter-menu-title = <b>⊙ Filter referrals</b>
ref-sort-earnings = By earnings
ref-sort-join = By join date
ref-sort-activity = By activity
ref-sort-spent = By spending
ref-filter-all = All
ref-filter-active = Active
ref-filter-inactive = Inactive
ref-filter-deposited = Deposited
ref-search-prompt = Enter <b>@username</b>, Telegram ID or internal ID to search.

ref-activity-title = <b>⚡ Live Activity</b>
ref-activity-empty = No events yet.
ref-activity-join-line = {$when} · 👋 <b>{$name}</b> joined
ref-activity-reward-line = {$when} · 💰 <b>{$name}</b> +${$reward} (deposit ${$amount})
ref-activity-topup-line = {$when} · 💳 <b>{$name}</b> topped up ${$amount}

ref-analytics-title = <b>📈 Partner Analytics</b>
ref-analytics-earnings =
    7 days: <b>${$w7}</b>
    30 days: <b>${$m30}</b>
    All time: <b>${$all}</b>
    Projected / mo: <b>${$projected}</b>
ref-analytics-chart = Weekly trend
ref-analytics-top = 🏆 Top referrals
ref-analytics-no-top = —

ref-detail-title = <b>👤 {$name}</b>
ref-detail-joined = 📅 Joined:
ref-detail-last = 🕒 Last activity:
ref-detail-metrics =
    💰 Earned from referral: <b>${$earned}</b>
    💳 Referee deposits: <b>${$spent}</b> ({$deposits} tx)
    📦 Services: {$services}
ref-detail-recent-topups = Recent top-ups
ref-detail-timeline = Timeline
ref-detail-no-topups = none
ref-detail-no-events = none

ref-admin-top-title = <b>🏆 Top Affiliates</b>
ref-admin-top-empty = No affiliate data yet.
ref-admin-top-row = {$rank}. {$tierEmoji} {$name} · 👥 {$refs} · 💰 ${$earned} · bal ${$balance} · {$percent}%
ref-admin-view-referees = 👥 User referrals
ref-admin-top-affiliates = 🏆 Top affiliates

referrals-share-text = Join me on Dior Host! Use my referral link to get started.
referral-new-joined =
    👋 <strong>New referral</strong>

    Someone joined via your link.
    Total referrals: <b>{$count}</b>

referral-topup-notify =
    💰 <strong>Referral topped up</strong>

    ├ Top-up amount: <b>{ $amount }</b>
    ├ Your rate: <b>{ $percent }%</b>
    └ Credited to referral balance: <b>{ $reward }</b>

    Select an action:

pagination-left = ⬅️
pagination-right = ➡️

block-user = 🚫 Block
unblock-user = ✅ Unblock

message-about-block =
    🚫 <strong>Account blocked</strong>

    Contact support — we'll explain why and what to do next.

button-buy = 💸 Make order

domain-question = Enter domain (with or without zone): example or example.com

domains-purchase-screen = 🌐 <b>Domains</b>

Register domains with stable infrastructure.
Support for popular TLDs.

💳 Price: from { NUMBER($minPrice, minimumFractionDigits: 0, maximumFractionDigits: 0) } $/year

domain-shop-cat-popular = 🌍 Popular
domain-shop-cat-business = 💼 Business
domain-shop-cat-tech = 💻 Tech
domain-shop-cat-geo = 🌐 Geo
domain-shop-cat-all = 🔎 All TLDs

domain-shop-list-title-popular = 🌍 <b>Popular</b>
domain-shop-list-title-business = 💼 <b>Business</b>
domain-shop-list-title-tech = 💻 <b>Tech</b>
domain-shop-list-title-geo = 🌐 <b>Geo</b>
domain-shop-list-title-all = 🔎 <b>All TLDs</b>

domain-shop-list-page = Page { $current } of { $total }
domain-shop-page-prev = ⬅️
domain-shop-page-next = ➡️

domain-shop-confirm = 🌐 <b>Domain: { $zone }</b>

Price: { NUMBER($price, minimumFractionDigits: 0, maximumFractionDigits: 2) } $/year

Select action:

domain-shop-register = 🛒 Register
domain-shop-my-domains = 📋 My Domains
domain-shop-my-title = 📋 <b>My domains</b>
domain-shop-my-empty = No domains yet.
domain-invalid =
    ⚠️ <strong>Invalid domain</strong>

    <code>{$domain}</code> — check the format and try again.

domain-not-available =
    🚫 <strong>Domain taken</strong>

    <code>{$domain}</code> — already registered. Try another option.
domain-available =
    ✅ <strong>Domain available</strong>

    <code>{$domain}</code> — ready to register.

    Continue purchase?

domain-registration-in-progress =
    🔄 <strong>Domain registration</strong>

    <code>{$domain}</code> — request accepted, balance charged.

    Status — «Manage services → Domains».

cdn-service = 🌐 <strong>CDN &amp; Traffic</strong> — optimized routing, protection, and delivery. Pick a plan to connect a proxy.

cdn-welcome = 🌐 <strong>CDN &amp; Traffic</strong>

Optimized routing, protection and stable delivery.

🚀 Acceleration
🛡 Protection
🌍 Global network

cdn-main-screen = 🌐 <strong>CDN &amp; Traffic</strong>

Optimized routing, protection and stable delivery.

🚀 Acceleration
🛡 Protection
🌍 Global network

cdn-tariffs-screen = 📦 <strong>CDN Plans</strong>

Choose configuration:

button-cdn-plans = 📦 CDN Plans
button-cdn-proxy-ip = 🔗 Proxies / IP
button-cdn-pick-standard = 🚀 Standard — from {$price}$
button-cdn-pick-protected = 🛡 Protected — from {$price}$
button-cdn-pick-bundle = ⚡ CDN + VDS — from {$price}$
button-cdn-prime-row = 🔐 Prime — up to 10% off
button-cdn-connect = 🛒 Connect
button-cdn-details = 📋 Details

cdn-card-standard-body = 🚀 <strong>Standard CDN</strong>

Basic traffic acceleration and caching.

✔️ CDN routing
✔️ Caching
✔️ SSL
✔️ Basic protection

💳 {$price}$ / month

cdn-card-protected-body = 🛡 <strong>Protected CDN</strong>

Enhanced protection and routing stability.

✔️ Advanced filtering
✔️ Stable routing
✔️ Traffic protection
✔️ Priority network

💳 {$price}$ / month

cdn-card-bundle-body = ⚡ <strong>CDN + VDS</strong>

Ready-to-use infrastructure stack.

✔️ CDN + server
✔️ Reverse proxy
✔️ Origin protection
✔️ Full control

💳 {$price}$ / month

cdn-detail-standard-body = 🚀 <strong>Standard CDN</strong>

Best for sites that need fast caching, SSL at the edge, and baseline L7 protection — without operational overhead.

✔️ CDN routing
✔️ Caching
✔️ SSL
✔️ Basic protection

💳 <b>{$price}$ / month</b> · per site · billed from balance

cdn-detail-protected-body = 🛡 <strong>Protected CDN</strong>

For traffic that demands stronger filtering, resilient routing, and priority treatment when it matters.

✔️ Advanced filtering
✔️ Stable routing
✔️ Traffic protection
✔️ Priority network

💳 <b>{$price}$ / month</b> · per site · billed from balance

cdn-detail-bundle-body = ⚡ <strong>CDN + VDS</strong>

Single stack: edge CDN plus a dedicated server — reverse proxy, hidden origin, and full control.

✔️ CDN + server
✔️ Reverse proxy
✔️ Origin protection
✔️ Full control

💳 <b>{$price}$ / month</b> · bundle · billed from balance

cdn-proxy-hub-screen = 🔗 <strong>Proxies / IP</strong>

Add extra IPs and routing options.

✔️ IPv4 / IPv6
✔️ Geo locations
✔️ Load balancing

cdn-plan-standard-name = Standard CDN
cdn-plan-bulletproof-name = Protected CDN
cdn-plan-bundle-name = CDN + VDS
cdn-choose-plan = 📦 <strong>CDN Plans</strong> — choose a configuration below.
cdn-choose-plan-hint = Open <b>CDN Plans</b> and pick a tier, or use the buttons in the last message.

cdn-enter-domain = Enter the <strong>domain</strong> for proxying (e.g. <code>cdn.example.com</code>):
cdn-enter-target = Enter the <strong>target URL</strong> (e.g. <code>https://origin.example.com</code>):
cdn-enter-target-friendly = Where does your site currently point? Enter the origin address (e.g. <code>origin.example.com</code> or <code>https://origin.example.com</code>).
    If you are not sure, tap the button below.
cdn-confirm = Plan: <b>{$planName}</b>

Proxy: <code>{$domainName}</code> → <code>{$targetUrl}</code>

Cost: <b>{$price}$</b> for 30 days. Deduct from balance?
cdn-created = ✅ Proxy created: <code>{$domainName}</code> → <code>{$targetUrl}</code>. Configure DNS as per CDN panel instructions.
cdn-error = CDN error: {$error}
manage-cdn-no-active = You have no active CDN services.
cdn-not-configured = CDN service is not configured. To enable: set CDN_BASE_URL and CDN_BOT_API_KEY in .env (proxy service URL and API key).
cdn-invalid-domain = Invalid domain name. Enter domain only without http:// (e.g. cdn.example.com).
cdn-invalid-url = Invalid URL. Enter a domain/IP (http optional) or a full address with http:// / https://.
button-cdn-target-auto = 🤖 Auto-pick
button-cdn-target-help = ❓ Where to get origin URL?
cdn-target-help = <strong>Where can I get origin URL?</strong>

    This is your current site/server address where CDN should forward traffic.
    Examples:
    • <code>https://site.example.com</code>
    • <code>origin.example.com</code>
    • <code>123.123.123.123:8080</code>

    If you are not sure, tap “Auto-pick”.
cdn-target-auto-not-ready = First enter the domain to proxy.
cdn-target-auto-picked = Origin was auto-filled: <code>{$targetUrl}</code>
cdn-my-proxies-empty =
cdn-my-proxies-list = 🔗 <strong>Your proxies</strong>
cdn-proxy-item = • {$domain} → {$target} ({$status})
button-cdn-confirm = ✅ Confirm
button-cdn-cancel = ❌ Cancel
cdn-proxy-manage-title = <strong>{$domain}</strong> ({$status})
cdn-proxy-detail = <strong>CDN proxy</strong>
    
    Domain: <code>{$domain}</code>
    Origin: <code>{$target}</code>
    Status: {$status}
    Expires: {$expiresAt}
    Auto-renew: {$autoRenew}
button-cdn-renew = 📅 Renew 30d
button-cdn-autorenew-on = 🔄 Auto-renew ON
button-cdn-autorenew-off = ⏸ Auto-renew OFF
button-cdn-retry-ssl = ♻️ Retry SSL
button-cdn-delete = 🗑 Delete
button-cdn-refresh = 🔁 Refresh
cdn-renew-success =
    ✅ <strong>CDN renewal</strong>

    Request accepted — status will update automatically.

cdn-renew-failed =
    ❌ <strong>Renewal failed</strong>

    Try again later or contact support.

cdn-autorenew-on-success =
    ✅ <strong>Auto-renew enabled</strong>

    CDN will renew automatically from your balance.

cdn-autorenew-off-success =
    ⏸ <strong>Auto-renew disabled</strong>

    Remember to renew manually before expiry.

cdn-autorenew-failed =
    ❌ <strong>Error</strong>

    Could not change auto-renew. Try again later.

cdn-retry-ssl-success =
    ✅ <strong>SSL</strong>

    Certificate re-issuance started.

cdn-retry-ssl-failed =
    ❌ <strong>SSL</strong>

    Could not start re-issuance. Contact support.

cdn-delete-success =
    ✅ <strong>Proxy deleted</strong>

    You can remove DNS records at your registrar.

cdn-delete-failed =
    ❌ <strong>Delete failed</strong>

    Try again later or contact support.
cdn-delete-confirm = <b>Delete this proxy permanently?</b>

empty = Empty
list-empty = The list is empty

service-maintenance =
    🔧 <strong>Maintenance</strong>

    This section is temporarily unavailable. Try again in a few minutes.

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
service-label-vm-host-id = VM ID (hypervisor)
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
domain-registration-complete =
    📋 <strong>Complete domain setup</strong>

    Send in one message:
    ├ <b>IP address</b> to bind
    └ <b>or</b> two NS servers separated by space

domain-registration-complete-fail-message-length =
    ⚠️ <strong>Message too long</strong>

    Shorten the text and send again.

domains-manage = <strong>Manage domains</strong>
domain-already-pending-registration = Domain already in pending await
domain-request-notification = New request /domainrequests (In progress: {$count})

domain-cannot-manage-while-in-progress = Domain is pending registration wait until it becomes available.

deposit-money-enter-sum = Enter payment amount
deposit-money-incorrect-sum = The entered amount is incorrect

topup-select-method = 💳 Add Balance

 Select a payment method:

topup-select-amount = Select top-up amount
topup-method-cryptobot = 💳 CryptoBot
topup-method-crystalpay = 💎 CrystalPay
topup-method-heleket = 🪙 Heleket
topup-method-bank = 🏦 Bank Transfer
topup-heleket-not-configured = Heleket is not configured. Set PAYMENT_HELEKET_MERCHANT and PAYMENT_HELEKET_API_KEY in .env
topup-method-back = ⬅️ Back
topup-amounts-title = 💳 <b>Top up balance</b>
topup-popular-badge = Popular
topup-enter-custom-button = ⌨️ Enter custom amount
topup-enter-custom-prompt = Enter custom amount (USD):
topup-manual-support = For bank transfer top-up, contact support.
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

payment-information =
    💳 <strong>Payment</strong>

    After transfer, wait 1–2 minutes — balance updates automatically.

    If funds don't arrive — contact support with your ticket number.

deposit-by-sum =
    ✅ <strong>Balance topped up</strong>

    💳 Credited: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $

payment-credited =
    ✅ <strong>Balance topped up</strong>

    💳 Credited: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

payment-credited-bonus =
    🎁 Bonus: +{NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

payment-credited-reactivation-bonus =
    🎁 Welcome-back bonus: +{NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

service-payment-paid =
    ✅ <strong>Payment received</strong>

    Paid until: {$date}

money-not-enough =
    ⚠️ <strong>Insufficient balance</strong>

    Short by: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

    Top up to continue.

money-not-enough-go-topup =
    ⚠️ <strong>Insufficient balance</strong>

    Short by: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

    Choose a payment method below.

invalid-arguments = Invalid arguments

new-promo-created = New promo are added /promo_codes - for see

promocode-already-exist = promocode with this name already exists

promocode = {$id} <strong>{$name}</strong> (Uses: {$use}/{$maxUses}) : −{$amount}%
promocode-deleted = Promocode <strong>{$name}</strong> successfully deleted

promocode-not-found = Promocode was not found
promocode-not-exist = This promocode does not exist
promocode-input-question = Enter the promocode
payment-next-url-label = Proceed to payment
payment-await = Please wait...

promocode-used =
    🎁 <strong>Promo activated</strong>

    ├ Promo discount: <b>−{$percent}%</b>
    └ Total on orders (Prime + promos): <b>−{$totalPercent}%</b>

menu-service-for-buy-choose = 🚀 <strong>Select a service</strong>

manage-services-header = 💼 Services

# Manage services menu
button-manage-domains = 🌐 Domains
button-manage-cdn = 🛡 CDN
cdn-manage-services-title = <strong>CDN</strong>
button-manage-dedicated = 🔒 Dedicated
button-manage-services-back = ⬅️ Back


vds-menu-rate-select = test

vds-bulletproof-mode-button-on = Bulletproof: ON
vds-bulletproof-mode-button-off = Bulletproof: OFF

vds-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $, {$cpu} cores, {$ram} gb ram, {$disk} gb disk
dedicated-rate = «{$rateName}» - {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $/mo, {$cpu} cores / {$cpuThreads} threads, {$ram} GB RAM, {$storage} GB

dedicated-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU {$cpuModel} (Cores): </strong> {$cpu}
 <strong>💾 RAM: </strong> {$ram} GB
 <strong>💽 Disk: </strong> {$storage} GB SSD / NVMe
 <strong>🚀 Network: </strong> {$network} Gbps
 <strong>🛜 Bandwidth: </strong> {$bandwidth}

 <strong>OS: </strong> {$os}

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $ / month

# Dedicated server shop (multi-step)
dedicated-shop-step1-text =
    <b>🔒 Dedicated</b>

    Choose infrastructure type:
dedicated-shop-btn-standard = ⚙️ Standard
dedicated-shop-btn-bulletproof = 🛡 Bulletproof
dedicated-shop-step2-title = Choose configuration:
dedicated-shop-bulletproof-blurb =
    <b>🛡 Bulletproof servers</b>

    Infrastructure for sensitive workloads.
    Stable network and priority handling.
dedicated-shop-type-standard = Standard
dedicated-shop-type-bulletproof = Bulletproof
dedicated-shop-tier-start = 🚀 Start
dedicated-shop-tier-standard = ⚙️ Standard
dedicated-shop-tier-performance = 🔥 Performance
dedicated-shop-tier-enterprise = 🏢 Enterprise
dedicated-shop-tier-start-label = Start
dedicated-shop-tier-standard-label = Standard
dedicated-shop-tier-performance-label = Performance
dedicated-shop-tier-enterprise-label = Enterprise
dedicated-shop-step3-header = <b>🔒 {$typeLine} • {$tierLine}</b>
dedicated-shop-step3-prompt = Choose server:
dedicated-shop-list-page = Page {$current} / {$total}
dedicated-shop-page-prev = ⬅️ Prev
dedicated-shop-page-next = ➡️ Next
dedicated-shop-storage-line = SSD / NVMe
dedicated-shop-card =
    <b>🔒 {$title}</b>

    <b>CPU:</b> {$cpu}
    <b>RAM:</b> {$ram} GB
    <b>Storage:</b> {$storage} GB SSD / NVMe
    <b>Type:</b> {$typeLine}

    💳 <b>Price:</b> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $ / month
dedicated-shop-order = 🛒 Order
dedicated-shop-details = 📋 Details

bulletproof-on = ✅ Bulletproof rate
bulletproof-off = ⚠️ Isn't bulletproof rate
unlimited = Unlimited

vds-rate-full-view = <strong>«{$rateName}»</strong>
 
 {$abuse}

 <strong>🖥 CPU {$cpuModel} (Cores): </strong> {$cpu}
 <strong>💾 RAM: </strong> {$ram} Gb
 <strong>💽 Disk (SSD/NVME): </strong> {$disk} Gb
 <strong>🚀 Network Speed: </strong> {$network} Mbit/s
 <strong>🛜 Bandwidth: </strong> Unlimited

 <strong>OS: </strong> Windows/Linux

 <strong>💰 Price: </strong> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $ / month

vds-purchase-paused-alert = VPS orders are paused — back in a couple of days. Thanks for your patience!
vds-purchase-paused-reply =
    <b>VPS / VDS</b>

    Ordering is temporarily unavailable — it should work again in a couple of days. All plans stay in the menu for you to review.

# VPS shop (multi-step)
vds-shop-step1-text =
    <b>🖥 VPS / VDS</b>

    Full system control.
    Ideal for websites, apps and services.

    🚀 Up to 150 Mbps
    🔒 No logs

    <b>Choose type:</b>
vds-shop-btn-standard = ⚙️ Standard
vds-shop-btn-bulletproof = 🛡 Bulletproof
vds-shop-step2-title = <b>Choose tier:</b>
vds-shop-bulletproof-blurb =
    <b>🛡 Bulletproof VDS</b>

    Stable infrastructure for sensitive workloads.
    Priority handling.
vds-shop-type-standard = Standard
vds-shop-type-bulletproof = Bulletproof
vds-shop-bulletproof-list-header = 🖥 Bulletproof VDS/VPS for projects of any color and risk!
vds-shop-standard-list-header = 🖥 Standard VPS/VDS
vps-location-ru = 🇷🇺 Russia
vps-location-by = 🇧🇾 Belarus
vps-location-ab = 🇦🇧 Abkhazia
vds-shop-tier-start = 🚀 Start
vds-shop-tier-standard = ⚙️ Standard
vds-shop-tier-performance = 🔥 Performance
vds-shop-tier-enterprise = 🏢 Enterprise
vds-shop-tier-start-label = Start
vds-shop-tier-standard-label = Standard
vds-shop-tier-performance-label = Performance
vds-shop-tier-enterprise-label = Enterprise
vds-shop-step3-header = <b>🖥 {$typeLine} • {$tierLine}</b>
vds-shop-step3-prompt = Choose configuration:
vds-shop-list-page = Page {$current} / {$total}
vds-shop-page-prev = ⬅️ Prev
vds-shop-page-next = ➡️ Next
vds-shop-card =
    <b>🖥 {$title}</b>

    <b>CPU:</b> {$cpu} vCPU
    <b>RAM:</b> {$ram} GB
    <b>Storage:</b> {$storage} GB SSD
    <b>Network:</b> {$network} Mbps

    💳 <b>Price:</b> {NUMBER($price, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $ / month
vds-shop-order = 🛒 Order
vds-shop-details = 📋 Details

vds-os-select = <strong>Select the OS to be installed</strong>
vds-provisioning-wait =
    ⚡ <b>Spinning up your VPS</b>
    We're connecting networking, storage, and access. Most setups finish within a minute.

vps-provisioning-failed =
    ❌ <strong>Could not create VPS</strong>

    Payment cancelled — funds returned to balance.

    If this repeats — contact support.

vps-premium-region-auto = Region: automatic

vps-premium-headline = ✓ <b>Your VPS is ready</b>

vps-premium-sec-instance = Overview
vps-premium-sec-access = Connect

vps-premium-host-and-id = <code>{$host}</code> · ID: <code>{$id}</code>

vps-premium-k-region = Location
vps-premium-k-plan = Plan
vps-premium-k-specs = Hardware
vps-premium-k-os = Operating system
vps-premium-k-ipv4 = IPv4 address
vps-premium-k-user = Username
vps-premium-k-password = Password
vps-premium-k-ssh = SSH command
vps-premium-k-remote = Remote Desktop

vps-premium-specs-line = {$cpu} vCPU · {$ram} GB RAM · {$disk} GB SSD · {$net} Mbps — {$cpuModel}

vps-premium-ipv4-pending =
    Your public IPv4 is still being assigned — often 30–90 seconds. Open My services and pull to refresh; the address will show up automatically.

vps-premium-rdp-body = Use <b>Remote Desktop</b> to connect to <code>{$ip}</code> with user <code>{$login}</code>

vps-premium-console-hint = Power controls, reinstall, billing, and password changes are under Main menu → My services.

bad-error =
    ⚠️ <strong>Temporary error</strong>

    We're on it. Try again in a minute or contact support.

vds-created =
    ✅ <strong>VDS created</strong>

    Server is ready. Manage — «Main menu → My services».

vds-manage-title = Manage VDS
vds-manage-list-item = {$label} - {$ip}
button-my-vds = 🖥 VPS/VDS

vds-autorenew-line = <strong>Auto-renew:</strong> {$state}
vds-autorenew-on = on
vds-autorenew-off = off
vds-management-locked-notice =
    ⚠️ <strong>Subscription expired</strong>

    Management disabled. Top up your balance or renew manually.

vds-renew-period-label = 📅 {$months} mo — {NUMBER($total, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $
vds-renew-confirm-ask = Renew for <strong>{$months}</strong> mo. for <strong>{NUMBER($total, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $</strong>?
vds-renew-success =
    ✅ <strong>Subscription renewed</strong>

    Period: <b>{$months}</b> mo. Manage — in «My services».

vds-admin-blocked-notice =
    🔒 <strong>Service blocked</strong>

    Admin restricted access. Renewal and support are available.

vds-autorenew-enable = 🔄 Enable auto-renewal
vds-autorenew-disable = ⏸ Disable auto-renewal
vds-button-renew = 📅 Renew
vds-button-more = ⚙️ More
vds-button-extra-ipv4 = ➕ Extra IPv4 (${ $price }/mo)
vds-extra-ipv4-confirm-ask =
    Add <b>1 additional IPv4</b> for <b>${ $price }</b>/mo?

    Charge now: <b>${ $price }</b>
    Renewal price will become: <b>${ $renewal }</b>/mo (includes extra IP)
vds-extra-ipv4-success =
    ✅ Extra IPv4 added.

    IP: <code>{ $ip }</code>
    +${ $price }/mo added to plan (included in renewal)
vds-extra-ipv4-active = Extra IPv4 is active (see second address above or in Proxmox)
service-label-extra-ipv4 = Extra IPv4
vds-button-power-off = 🔴 Shut down
vds-button-power-on = 🟢 Power on
vds-button-new-password = 🔁 New password
vds-button-support-request = 🛠 Contact support

vds-password-generate = 🔁 Generate password
vds-password-manual = ✏️ Set password manually
vds-password-manual-prompt = Send the new password for <code>{ $login }</code> (8+ chars).
vds-password-manual-invalid = Password must be 8–128 characters.
vds-password-manual-success = Password updated.
vds-password-change-failed =
    ❌ Could not apply the password on the server. The password in the bot was not changed — try again or contact support.
vds-password-change-applied =
    ✅ Password updated and applied on the server. If changed via cloud-init, wait 1–2 minutes after reboot before logging in.
vds-password-change-applied-with-password =
    ✅ Password updated and being applied on the server. Wait 1–2 minutes after reboot.

    New password: <tg-spoiler>{ $password }</tg-spoiler>

vds-button-rename = ✏️ Rename
vds-button-plan-change = 📈 Change plan / upgrade
vds-plan-change-support-body =
    To change configuration or upgrade your plan (e.g. Lite tier), contact support and include:
    
    • VM ID (hypervisor): <code>{$vmHostId}</code>
    • Service id in the bot: <code>{$serviceId}</code>
    • Current plan name: {$rateName}

# Admin VDS
button-admin-vds = 🖥 Services
button-admin-cdn = 🌍 CDN (admin)
admin-vds-title = <strong>VDS — admin</strong>
Search: service id, VM id, IP, name. Page {$page} / {$totalPages}
admin-vds-empty = No records.
admin-vds-row = <b>{$n}.</b>   <code>{$ip}</code>   <code>[{$rate}]</code>   { $status ->
  [running] 🟢 Running
  [stopped] 🔴 Stopped
  [expired] ⚫ Expired
 *[unknown] ⚪ Unknown
}
admin-vds-detail = <strong>VDS #{$id}</strong>
VM ID: {$vmId}
VM state: {$vmState}
IP: {$ip}
User: {NUMBER($userId)}
Telegram: <code>{$ownerTelegramId}</code>
Plan: {$rate}
Plan price: {$renewalPrice} USD / 30d
Login: <code>{$login}</code>
Password: <code>{$password}</code>
{$flags}
Expires: {DATETIME($expireAt, dateStyle: "long", timeStyle: "short")}
admin-vds-flag-blocked = 🔒 Blocked by admin
admin-vds-flag-locked = ⛔ Management locked (overdue)
admin-vds-search-button = 🔍 Search
admin-vds-search-prompt = Send a search string (service id, VM id, IP, plan or display name) or «clear» to reset.
admin-vds-search-done = Filter: «{$query}»
admin-vds-extended = Extended by {$days} days.
admin-vds-transferred = Owner changed to user id {$userId}
admin-vds-deleted = VDS removed
admin-vds-delete-confirm = <b>Delete this VDS and VM permanently?</b>
admin-vds-transfer-prompt = Send the new owner’s <b>internal user id</b> (DB id, number):
admin-vds-ip-synced = ✅ IP synchronized.
admin-vds-ip-not-available = ⚠️ IP is not available yet (guest agent/network still initializing).
admin-vds-vm-started = ✅ VM started.
admin-vds-vm-stopped = ✅ VM stopped.
admin-vds-vm-rebooted = ✅ VM rebooted.
admin-vds-proxmox-search-hint = <b>Proxmox:</b> find the guest by <b>VMID</b> <code>{$vmid}</code> in the VM list / task log; guest <b>Notes/Description</b> may contain <code>DiorHost</code>.
admin-vds-bot-ids-line = <b>Bot:</b> service id <code>{$serviceId}</code> · customer user id <code>{$userId}</code>

# Admin — add service wizard
admin-cs-restart-hint = Restarting the wizard…
admin-cs-add-button = ➕ Add service
admin-cs-wizard-title = Add service
admin-cs-step = Step {$current} / {$total} · {$title}
admin-cs-step-type = Service type
admin-cs-step-form = Service details
admin-cs-step-user = Assignment
admin-cs-step-review = Review
admin-cs-step-creating = Creating
admin-cs-type-prompt =
    Choose a service type.

    For VPS you can paste a block:
    <code>@username
    ID vm: 230
    Tarif: Mega 1
    Ip: 45.74.7.131</code>
admin-cs-vds-block-hint =
    You can paste a <b>single block</b>:

    <code>@username
    ID vm: 230
    Tarif: Mega 1
    Ip: 45.74.7.131</code>

    Price and expiry default from the plan (30 days) when omitted.
admin-cs-vds-block-applied = ✅ Block parsed. Review on the confirmation step.
admin-cs-type-domain = 🌐 Domains
admin-cs-type-vds = ☁ VPS / VDS
admin-cs-type-dedicated = 🖥 Dedicated
admin-cs-cancelled = Service setup cancelled.
admin-cs-cancel = Cancel
admin-cs-form-field-progress = Field {$current} of {$total}
admin-cs-hint-domain-idn = Latin or IDN (e.g. whəd.net is stored as punycode).
admin-cs-error-domain = Invalid domain. Use a zone, e.g. example.com
admin-cs-error-date = Invalid date. Use DD.MM.YY (22.05.26) or YYYY-MM-DD
admin-cs-error-not-date = That looks like a Telegram ID, not a date. Use DD.MM.YY
admin-cs-error-ipv4 = Invalid IPv4
admin-cs-error-integer = Enter an integer ≥ 1
admin-cs-error-number = Enter a valid number
admin-cs-error-amount = Enter a valid amount
admin-cs-back = ◀ Back
admin-cs-skip-field = Skip
admin-cs-field-required = This field is required.
admin-cs-user-prompt = Find a customer: send <b>user id</b>, <b>Telegram id</b>, or <b>@username</b>.
admin-cs-user-not-found = User not found. Check id or @username.
admin-cs-user-missing = User not found.
admin-cs-user-card-title = Assigned customer
admin-cs-user-id-line = DB id: {$id}
admin-cs-user-active = Active
admin-cs-user-banned = Banned
admin-cs-confirm-checkbox = I confirm the data is correct
admin-cs-confirm-required = Check the confirmation box before creating.
admin-cs-edit-type = Edit type
admin-cs-edit-form = Edit details
admin-cs-edit-user = Edit customer
admin-cs-edit-type-short = Type
admin-cs-edit-form-short = Details
admin-cs-edit-user-short = Client
admin-cs-submit = Create service
admin-cs-review-type = Type
admin-cs-review-data = Details
admin-cs-review-user = Customer
admin-cs-review-meta = Meta
admin-cs-review-warning = Review carefully. The service will be linked to the customer.
admin-cs-created-by = Created by (admin user id)
admin-cs-created-at = Time (UTC)
admin-cs-creating = Creating service…
admin-cs-success-title = Service created successfully
admin-cs-success-hint = Quick actions below.
admin-cs-open-service = Open service
admin-cs-add-another = Add another
admin-cs-go-user = Go to customer
admin-cs-done = Back to list
admin-cs-error = Error: {$error}
admin-cs-hint-date = Format: DD.MM.YY (22.05.26) or DD.MM.YYYY
admin-cs-hint-vmid = Leave empty for auto VMID
admin-cs-field-domain = Domain (example.com)
admin-cs-field-registrar = Registrar / provider (optional)
admin-cs-hint-registrar-optional = Note for your records: Amper, Namecheap, transfer… Skip to use «transfer».
admin-cs-field-expires = Expiry date
admin-manual-domain-prompt =
    <b>Domain (transfer / manual add)</b>

    Send <b>domain</b> and <b>expiry date</b>. Registrar is optional (any label or skip → transfer).

    Examples:
    <code>example.com 2026-12-31</code>
    <code>example.com | 31.12.2026</code>
    <code>example.com | amper | 2026-12-31</code>
admin-manual-domain-exists = Domain <code>{$domain}</code> already exists for this user.
admin-manual-vps-prompt =
    <b>VPS/VDS (transfer)</b>

    <b>Block</b> (recommended):
    <code>@username
    ID vm: 230
    Tarif: Mega 1
    Ip: 45.74.7.131</code>

    Or one line: <b>IP</b> · <b>VMID</b> · <b>plan</b> · <b>price $</b> · <b>date</b>
    Example: <code>45.74.7.154 162 Lite 1 24 22.05.26</code>
admin-manual-vps-already-assigned = VMID <code>{$vmid}</code> is already linked to this user.
admin-manual-dedicated-prompt =
    <b>Dedicated (transfer)</b>

    One line: IP · Server ID · plan · price $ · date (<code>22.05.26</code>)

    Example:
    <code>127.0.0.1 998 Lite 1 24 22.05.26</code>
admin-manual-cdn-prompt =
    <b>CDN (manual)</b>

    Domain/project, status/plan (e.g. <code>active</code>), expiry date — spaces or <code>|</code>.

    Example:
    <code>cdn.example.com active 2026-12-31</code>
admin-manual-vps-vmid-exists = VMID <code>{$vmid}</code> is already used by another service.
admin-manual-service-added = ✅ Service added
admin-manual-service-invalid-format = ❌ Invalid data format
admin-cs-field-ns1 = NS1 (optional)
admin-cs-field-ns2 = NS2 (optional)
admin-cs-field-notes = Notes (optional)
admin-cs-field-ipv4 = IPv4
admin-cs-field-login = Login
admin-cs-field-password = Password
admin-cs-field-provider = Provider
admin-cs-field-os = OS label
admin-cs-field-ssh-port = SSH port (optional)
admin-cs-field-vmid = VMID (optional)
admin-cs-field-rate = Plan name
admin-cs-field-cpu = CPU (count)
admin-cs-field-ram = RAM, GB
admin-cs-field-disk = Disk, GB
admin-cs-field-price = Renewal price, USD
admin-cs-field-rack = Rack / location
admin-cs-field-hardware = Hardware / specs
admin-cs-field-monthly = Monthly price, USD (optional)
admin-cs-field-paid-until = Paid until (optional)

admin-cdn-title = <strong>CDN — admin</strong>
Search: proxyId, domain, origin. Page {$page} / {$totalPages}
admin-cdn-empty = No CDN records.
admin-cdn-row = #{$id} {$domain} ({$status})
admin-cdn-detail = <strong>CDN #{$id}</strong>
Proxy ID: <code>{$proxyId}</code>
Domain: <code>{$domain}</code>
Origin: <code>{$target}</code>
Status: {$status}
Expires: {$expiresAt}
Deleted: {$deleted}
admin-cdn-search-prompt = Send search query (proxyId, domain, origin) or “clear”.
admin-cdn-sync-success = ✅ CDN records synchronized.

vds-autorenew-notify =
    ✅ <strong>VDS #{$vdsId} — subscription renewed</strong>

    🔄 Auto-renewed for 1 month
    💳 Charged from balance: {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $

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
vds-reinstall-failed = ❌ OS reinstall failed (hypervisor error or clone timeout). Check bot logs and Proxmox tasks for the service VMID.

dedicated-servers = This section will be available soon. In the meantime, you can get information about dedicated servers via DM in tech support.

vds-expiration =
    ⏰ <strong>VDS #{$vdsId} subscription expired</strong>

    💰 Top up {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $ or renew manually.

    ⏳ You have <strong>3 days</strong> before the service is removed.

vds-grace-insufficient =
    ⚠️ <strong>VDS #{$vdsId} subscription expired</strong>

    ├ 🖥 <b>Status:</b> VM stopped
    ├ 🔄 <b>Auto-renew:</b> failed — insufficient balance
    ├ 💳 <b>Short by:</b> {NUMBER($missing, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $
    └ 📦 <b>Need:</b> {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $/mo

    ⏳ <strong>3 days</strong> left — top up or renew manually, or the service will be deleted.

vds-grace-autorenew-off =
    ⚠️ <strong>VDS #{$vdsId} subscription expired</strong>

    ├ 🖥 <b>Status:</b> VM stopped
    ├ 🔄 <b>Auto-renew:</b> off
    └ 💰 <b>Renewal:</b> {NUMBER($amount, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2)} $/mo

    ⏳ Renew manually within <strong>3 days</strong>, or the service will be deleted.

vds-deleted-after-grace =
    ❌ <strong>VDS #{$vdsId} removed</strong>

    The 3-day grace period ended without payment — service and data deleted.

vds-grace-day2 =
    🎁 <strong>VDS reminder</strong>

    <b>+5%</b> renewal discount — valid for <strong>24 more hours</strong>.

    Renew now to keep your data.

vds-grace-day3 =
    🔴 <strong>Last day</strong>

    VDS will be deleted soon. <b>5%</b> renewal discount still active.

    Renew now to save your data.

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
admin-promos-enter-amount = Enter order discount percent (1–100):
admin-promos-invalid-amount = Invalid percent (enter a number from 1 to 100)
admin-promos-enter-max-uses = Enter max activations (number):
admin-promos-invalid-max-uses = Invalid max activations
admin-promos-created = Promo code <strong>{$code}</strong> created
admin-promos-updated = Promo code <strong>{$code}</strong> updated
admin-promos-not-found = Promo code not found
admin-promos-edit-missing = No promo selected for editing
admin-promos-edit-code = Enter new code or /skip (current: {$code}):
admin-promos-edit-amount = Enter new discount percent or /skip (current: {$amount}%):
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
ticket-support-label = Support
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
ticket-question-from-moderator = <strong>Question from Support</strong>

Ticket #{$ticketId}

{$question}
ticket-question-sent = Question sent to user
ticket-provide-ip = Enter IP address:
ticket-provide-login = Enter login:
ticket-provide-password = Enter password:
ticket-provide-panel-optional = Enter panel URL (optional, press /skip to skip):
ticket-provide-notes-optional = Enter notes (optional, press /skip to skip):
ticket-provide-result-text = Enter result text:
ticket-result-provided = Result provided
ticket-result-received = <strong>Ticket #{$ticketId} resolved</strong>

{$result}
ticket-reject-enter-reason-optional = Enter rejection reason (optional):
ticket-rejected = <strong>Ticket #{$ticketId} rejected</strong>

Reason: {$reason}
ticket-rejected-by-moderator = Ticket rejected
ticket-new-notification = <strong>New Ticket #{$ticketId}</strong>

User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Type: {$type}
ticket-moderator-notification = <strong>You received a ticket</strong>

Ticket #{$ticketId}
Type: {$type}
User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
{$amountLine}
{$detailsLine}
withdraw-notification-amount = Amount: {$amount} $
withdraw-notification-details = Wallet / payment details: {$details}
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
button-my-dedicated = 🔒 Dedicated Servers
button-my-tickets = 🎫 My Requests
dedicated-none = You don't have any dedicated servers
dedicated-status-requested = <strong>Dedicated Server Request</strong>

Ticket #{$ticketId}
Status: {$status}

Please wait for Support to process your request.
dedicated-status-requested-no-ticket = <strong>Dedicated Server Request</strong>

Status: REQUESTED

Please wait for Support to process your request.
dedicated-no-credentials = Dedicated server credentials not available yet
dedicated-info = <strong>🔒 My Dedicated Server</strong>

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
dedicated-order-created = <strong>Request sent to Support</strong>

Ticket #{$ticketId}
Status: {$status}
dedicated-order-success = <strong>Purchase completed successfully</strong>

Ticket #{$ticketId}

If you need help, contact support.
dedicated-purchase-success = <strong>Your purchase was successful</strong>

Please contact support.
dedicated-operation-requested = <strong>Request sent to support</strong>

 Operation: {$operation}
 Ticket #{$ticketId}. Please wait for a response from Support.

Operation: {$operation}
Ticket #{$ticketId}
tickets-none-user = You don't have any tickets
tickets-list-user = <strong>My Tickets ({$count})</strong>
ticket-dedicated-ready = <strong>Your Dedicated Server is Ready!</strong>

Ticket #{$ticketId}

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
dedicated-menu-header = <strong>🔒 Dedicated Servers</strong>

Choose an option:
dedicated-location-select-title = Start with location selection.
dedicated-os-select-title = After selecting an operating system, the server is rented.
dedicated-purchase-success-deducted = <strong>Purchase successful.</strong> {NUMBER($amount, minimumFractionDigits: 0, maximumFractionDigits: 0)} $ has been deducted from your balance.
dedicated-contact-support-message = To receive your dedicated server, contact our support.
button-go-to-support = Go to support
support-message-dedicated-paid = Hello! I paid for the service "{$serviceName}", location: {$location}, OS: {$os}. Can you provide it?

button-provisioning-tickets = 🛠 Server setup tickets
provisioning-menu-title = <strong>🛠 Dedicated server setup tickets</strong>\n\n📊 Ticket statuses:\n\n🟡 Open: {$open}\n🔵 In progress: {$inProgress}\n⏸ Waiting: {$waiting}\n🟢 Done: {$done}\n\nTotal: {$total}\n\nChoose a status to open ticket list.
provisioning-list-empty = No tickets in status: {$status}
provisioning-list-title = <strong>Ticket queue:</strong> {$status}\nTotal: {$count}
provisioning-ticket-view = <strong>🛠 Setup Ticket #{$ticketId}</strong>\nTicket: <code>{$ticketNumber}</code>\nOrder: <code>{$orderNumber}</code>\n\n<strong>Status:</strong> {$status}\n<strong>Assignee:</strong> {$assignee}\n<strong>User:</strong> {$userId}\n<strong>Amount:</strong> {$amount} {$currency}\n<strong>Server:</strong> {$serviceName}\n<strong>Location:</strong> {$location}\n<strong>OS:</strong> {$os}\n<strong>Checklist:</strong> {$checklist}\n<strong>Created:</strong> {$createdAt}
provisioning-latest-note = Latest internal note
provisioning-assigned-refresh = Ticket assigned to you.
provisioning-status-updated = Provisioning status updated.
provisioning-checklist-open = Checklist
button-provisioning-send-credentials = ✅ Send access details
provisioning-checklist-title = <strong>Checklist for ticket #{$ticketId}</strong>
provisioning-checklist-updated = Checklist item updated.
provisioning-note-enter = Send internal note text for this provisioning ticket.
provisioning-note-saved = Internal note saved.
provisioning-complete-enter-message = Send final message for customer (credentials/details). It will be delivered and ticket marked completed.
provisioning-completed = Ticket marked as completed.
provisioning-user-ready-message = <strong>✅ Your dedicated server is ready</strong>\n\n<strong>Access details:</strong>\n{$message}\n\nIf you need help with setup, please contact our support @diorhost.
dedicated-provisioning-ticket-created =
    ✓ <b>Order received</b>

    Your server is being prepared manually. When it's ready, we'll send the access details here in Telegram.

    <b>What you ordered</b>
    Plan: <code>{$serviceName}</code>
    Location: <code>{$location}</code>
    Operating system: <code>{$os}</code>

    <b>Reference</b>
    Request <code>#{$ticketId}</code> · Order <code>#{$orderId}</code>

    <i>Manage your service under Main menu → My services.</i>
dedicated-provisioning-staff-notification = <strong>🛠 New dedicated setup ticket</strong>\nTicket: <code>#{$ticketId}</code>\nOrder: <code>#{$orderId}</code>\nUser: {$userId}\nAmount: {$amount} $\nServer: {$serviceName}\nLocation: {$location}\nOS: {$os}

ticket-status-pending_review = 🟡 Pending review
ticket-status-awaiting_payment = 🟠 Awaiting payment
ticket-status-paid = 🟢 Paid
ticket-status-awaiting_stock = 🟠 Awaiting stock
ticket-status-in_provisioning = 🔵 In setup
ticket-status-awaiting_final_check = 🟣 Awaiting final check
ticket-status-completed = ✅ Completed
ticket-status-cancelled = ⚫ Cancelled
ticket-status-open = 🟡 Open
ticket-status-waiting = ⏸ Waiting
ticket-status-done = 🟢 Done
# Dedicated locations (table: Germany, NL/USA/Turkey)
dedicated-location-de-germany = 🇩🇪 Germany
dedicated-location-nl-amsterdam = 🇳🇱 Netherlands (Auto)
dedicated-location-usa = 🇺🇸 USA
dedicated-location-tr-istanbul = 🇹🇷 Turkey
# Dedicated OS (table: Win Server 2019/2025, Win11, Alma 8/9, CentOS 9, Debian 11/12/13, Ubuntu 22/24; or Any)
dedicated-os-winserver2019 = Windows Server 2019
dedicated-os-winserver2025 = Windows Server 2025
dedicated-os-winserver2012 = Windows Server 2012
dedicated-os-winserver2016 = Windows Server 2016
dedicated-os-windows10 = Windows 10
dedicated-os-windows11 = Windows 11
dedicated-os-alma8 = AlmaLinux 8
dedicated-os-alma9 = AlmaLinux 9
dedicated-os-rockylinux = Rocky Linux
dedicated-os-centos9 = CentOS 9
dedicated-os-debian11 = Debian 11
dedicated-os-debian12 = Debian 12
dedicated-os-debian13 = Debian 13
dedicated-os-freebsd = FreeBSD
dedicated-os-ubuntu2204 = Ubuntu 22.04
dedicated-os-ubuntu2404 = Ubuntu 24.04
dedicated-os-os-any = Any (your choice)
button-return-to-main = ⬅️ Return to main page
dedicated-not-active = Dedicated server is not active
dedicated-not-suspended = Dedicated server is not powered off
dedicated-price-not-set = Dedicated price is not set. Please contact support.
ticket-credentials-invalid = Invalid credentials. Please provide IP, login, and password.

# Withdraw Request
button-withdraw = 💰 Withdraw
button-referral-stats = 📊 Statistics
referral-statistics-header = 📊 Referral statistics
referral-stat-count = Referrals count: { $count }
referral-stat-reg2dep = Referral conversion (REG2DEP): { $percent }%
referral-stat-avg-deposit = Average referral deposit: { $amount } $
referral-stat-percent = Referral percentage: { $percent }%
referral-stat-active-30d = Active referrals (30 days): { $count }
referral-stat-new-clients = New clients
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

Support will process your request shortly.
withdraw-new-notification = <strong>New Withdrawal Request #{$ticketId}</strong>

User: <a href="tg://user?id={$userId}">@{$username}</a> ({$userId})
Amount: {$amount} $
withdraw-approved = <strong>Withdrawal Request Approved</strong>

Ticket #{$ticketId}
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
user-status-user = 👤 User
user-status-moderator = 🛡 Moderator
user-status-admin = 👑 Admin
user-status-current = Current status: {$status}
button-change-status = 🔄 Change Status
button-add-balance = 💰 Add to balance
button-deduct-balance = ➖ Deduct from balance
button-balance-short = 💳 Balance
button-services-short = 💼 Services
button-partnership-short = 🎁 Partnership
button-tickets-short = 🎫 Tickets
button-message-short = 📨 Message
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
button-referral-percent-by-service = 📋 Ref. % by service
admin-referral-percent-by-service-title = <b>Ref. % by service</b>\nCurrent values (empty = general %):
admin-referral-percent-enter-for = Enter ref. percentage 0–100 for «{$name}»:
admin-referral-percent-success-for = Ref. % for «{$name}» set to {$percent}%.
button-ref-topup-percent = ⚡ Top-up %
ref-percent-label-domains = Domains
ref-percent-label-dedicated = Dedicated
ref-percent-label-vds = VDS
ref-percent-label-cdn = CDN
admin-referral-percent-back-to-list = ⬅️ Back to list
button-block-short = ⛔ Block
button-control-user-back = ⬅️ Back
button-status-short = 🏷 Role
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
  Skip: /skip · Cancel: /cancel
admin-domain-ns-success = Nameservers for <b>{$domain}</b> updated.
admin-domain-ns-cancelled = Cancelled.
admin-domain-ns-skipped = Nameservers skipped. No changes made.
admin-domain-ns-failed = Failed to update NS: {$error}
admin-domain-set-amper-id-prompt = Enter Amper Domain ID (copy from Amper dashboard or API response):
admin-domain-set-amper-id-success = Amper ID for domain <b>{$domain}</b> saved. You can now change NS.
admin-domain-set-amper-id-cancelled = Cancelled.
button-admin-domain-change-ns = Change NS
button-admin-set-amper-id = Set Amper ID
button-admin-services-back = ⬅️ Back to summary
button-admin-domains-list = 🌐 Domains ({$count})
button-admin-register-domain = ➕ Register domain
button-admin-delete-domain = 🗑 Delete
admin-domain-delete-not-found = Domain not found.
admin-domain-register-prompt = Send domain name (e.g. <code>example.com</code>). The domain will be added to the user without payment. Cancel: /cancel
admin-domain-register-success = Domain <b>{$domain}</b> registered via Amper and added for user.
admin-domain-register-success-local = Domain <b>{$domain}</b> added for user. You can set NS or Amper ID in the domain list if needed.
admin-domain-register-success-local-no-amper = Domain <b>{$domain}</b> added for user (local only). To register via Amper: add <code>AMPER_API_BASE_URL</code> and <code>AMPER_API_TOKEN</code> to <code>.env</code> on the server, then restart the bot (<code>pm2 restart dior-host-bot</code>).
admin-domain-register-success-local-amper-failed = Domain <b>{$domain}</b> added for user (local only). Amper registration failed: {$error}
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
prime-subscription-title = 🔐 Prime
prime-subscription-body = Extended access to platform capabilities:
prime-subscription-benefits-block =
    ⚡ Priority processing

    📊 Improved pricing conditions

    🛠 Enhanced-priority support

    🎯 Exclusive offers
prime-subscription-trial-line = 🎁 Free access — 7 days
prime-subscription-status-active = ✅ Subscription active
prime-subscription-status-inactive = ❌ Subscription not active
prime-subscription-status-until = Active until: {$date}
prime-trial-activate = 💳 Then — $ {$monthlyPrice} / month
prime-trial-via-channel = Subscribe to our channel to get a free Prime subscription for 7 days
prime-button-activate-trial = 🎁 Activate for $0
prime-button-menu-row = 🔐 Prime
prime-button-go-subscribe = ↗️ Go and subscribe
prime-button-i-subscribed = ✅ I have subscribed
prime-trial-activated = ✅ Prime subscription activated for 7 days!
prime-subscribe-message = Subscribe to our <a href="{$channelLink}">channel</a> to get a free Prime subscription for 7 days
prime-trial-activated-message = 💎 Your Prime subscription has been activated for 1 week!
prime-trial-already-used = You have already used the free trial. Continue subscription at {$monthlyPrice}$/month.
prime-trial-subscribe-first = Please subscribe to the channel first, then press "I have subscribed".
prime-trial-subscribe-first-retry = Subscription not detected. Subscribe via the button above, wait 5–10 seconds and press "I have subscribed" again. Ensure the bot is added to the channel as an administrator.
prime-channel-not-configured = Channel for free trial is not configured. Contact support.
prime-discount-dedicated = 🔐 Prime — up to 10% off
prime-discount-vds = 🔐 Prime — up to 10% off
prime-discount-domains = 🔐 Prime — 10% off domains

profile-prime-no = Prime: No
profile-prime-until = Prime: until {$date}

profile-screen-header = 🔷 DiorHost
profile-screen-user = 👤 {$username}
profile-screen-id = ID: {$id}
profile-screen-balance = Balance: {$amount}
profile-screen-active-services = Active services: {$count}
profile-screen-subscription = Subscription: {$value}
profile-screen-status = Status: {$status}
profile-subscription-none = None
profile-status-active-label = Active
profile-status-banned-label = Banned
profile-username-unknown = —

bot-cmd-start = Main menu
bot-cmd-balance = Check balance
bot-cmd-services = Services

vds-expiration-btn-topup = 💳 Top up balance
vds-expiration-btn-manage = 🖥 My services

nps-promoter =
    🎉 <strong>Thanks for the rating!</strong>

    Invite friends via your referral link — earn % from their deposits.

    Or use the yearly renewal discount in your profile.

nps-detractor =
    💬 <strong>Sorry to hear that</strong>

    Contact support — we'll look into it and help.

    The «Ask question» button opens a chat with us.

nps-neutral =
    🙏 <strong>Thanks for your feedback</strong>

    If you have ideas how we can improve — contact support. We're here for you.

growth-upsell-offer =
    🎯 <strong>Special offer</strong>

    Top up another <b>$50</b> and get <b>+10%</b> bonus.

growth-winback =
    💼 <strong>Balance ready to deploy</strong>

    You have <b>{NUMBER($balance, style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0)} $</b> — enough for a VDS.

    🎁 Launch today and get <b>+5%</b> extra term.

growth-scarcity =
    ⏰ <strong>End of month</strong>

    <b>+12%</b> top-up bonus — until <strong>23:59</strong>.

growth-anniversary =
    🎂 <strong>One year with DiorHost</strong>

    Thank you for staying! <b>+15%</b> on top-up — <strong>48 hours</strong> left.

growth-cross-sell =
    🛡 <strong>Strengthen your stack</strong>

    Backup IP or backup pack for project stability.

    🎁 <b>−7%</b> — <strong>72 hours</strong> left.

growth-b2b =
    🏢 <strong>Scale up</strong>

    Running multiple VDS? Consider a dedicated server.

    💰 Save up to <b>18%</b> vs current spend.

growth-reactivation =
    👋 <strong>We miss you</strong>

    Come back and get <b>+15%</b> on your next top-up.

growth-referral-push =
    🤝 <strong>Referral program</strong>

    Share your link — <b>+10%</b> on your balance when a referral makes their first deposit.

growth-large-deposit =
    💎 <strong>Large deposit</strong>

    Thank you! Lock in <b>+3% forever</b> — top up another <b>$200</b> within <strong>24h</strong>.

growth-tier-silver =
    🥈 <strong>Silver tier</strong>

    Now <b>+3%</b> on every top-up.

growth-tier-gold =
    🥇 <strong>Gold tier</strong>

    Now <b>+5%</b> on every top-up.

growth-tier-platinum =
    💎 <strong>Platinum tier</strong>

    <b>+7%</b> on top-ups and priority support.

growth-nps-request =
    ⭐ <strong>Rate DiorHost</strong>

    How satisfied are you? From <b>1</b> to <b>5</b>.

growth-nps-followup =
    🙏 <strong>Thank you!</strong>

    Referral program and <b>−10%</b> yearly discount — in the bot.

growth-usage-upsell =
    📈 <strong>Load near limit</strong>

    Upgrade plan — <b>+40%</b> resources with no downtime.

    🎁 <b>10%</b> off — <strong>48h</strong> left.

growth-behavioral =
    ⚡ <strong>Active usage</strong>

    Need snapshots, backup or extra IP? Enable in one click.

growth-anti-churn =
    📉 <strong>Activity dropped</strong>

    We can optimize your plan or move you to a better tariff.

growth-incident-upsell =
    🔔 <strong>Recommendation</strong>

    Add monitoring + auto-reboot — <b>7 days free</b>.

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
bundle-back-to-types = ⬅️ Back to types
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