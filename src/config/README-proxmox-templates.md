# Proxmox OS templates (git-safe)

Template VMIDs live in `proxmox-templates.json` — no secrets, safe for GitHub deploy.

| osKey (bot / reseller API) | VMID | Proxmox template name |
|----------------------------|------|------------------------|
| winserver2012 | 934 | windows-server-2012-en-template |
| winserver2016 | 935 | windows-server-2016-en-template |
| winserver2019 | 106 | windows-server-2019-en-template |
| windows10 | 904 | windows-10-pro-en-template |
| windows10ru | 103 | windows-10-pro-ru-template |
| windows11 | 906 | windows-11-pro-en-template |
| ubuntu2004 | 922 | ubuntu-20.04-template |
| ubuntu2204 | 102 | ubuntu-22.04-template |
| ubuntu2404 | 900 | ubuntu-24.04-template (default) |
| debian11 | 903 | debian-11-template |
| debian12 | 902 | debian-12-template |
| debian13 | 901 | debian-13-template |
| alma8 / almalinux8 | 921 | almalinux-8-template |
| alma9 / almalinux9 | 920 | almalinux-9-template |
| rockylinux / rockylinux9 | 923 | rockylinux-9-template |
| rockylinux8 | 924 | rockylinux-8-template |
| centos9 / centosstream9 | 925 | centos-stream-9-template |

**Override on server:** set `PROXMOX_TEMPLATE_MAP` in `.env` to a small JSON object; keys you set replace bundled values.

**Not mapped:** `winserver2025`, `freebsd` (shop keys without a template yet) — add entries to JSON when templates exist on the node.
