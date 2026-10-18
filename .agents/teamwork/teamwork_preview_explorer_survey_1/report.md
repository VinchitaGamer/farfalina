# VPS Infrastructure Survey & Decommissioning Plan (R1)

**Survey Date:** 2026-10-06T06:06:00Z  
**Target Server:** `ubuntu@207.211.167.189` (Oracle Cloud Infrastructure, Ampere A1 ARM64)  
**Private Key:** `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key`  
**Investigating Agent:** `teamwork_preview_explorer_survey_1` (Read-only Explorer)

---

## 1. Executive Summary

A non-interactive diagnostic survey of the SOURDEV VPS at IP `207.211.167.189` was performed to fulfill the prerequisites of Requirement **R1** (Desconexión y Cierre Definitivo de Servicios en VPS Antiguo).

### Key Findings:
1. **SSH Connectivity:** Successfully verified using OpenSSH with Windows PowerShell non-interactive flags (`-n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15`). The private key is valid and exists on the local workstation.
2. **PM2 Status:** Process `floreria` (id: 0) is actively running in fork mode (PID 435180, child next-server PID 435194), listening on port `3000`. No other PM2 processes exist.
3. **Nginx Status:** `nginx.service` is `active (running)` and `enabled` in systemd. It actively listens on ports `80` (HTTP) and `443` (HTTPS with Certbot SSL certificates for `farfalina.tech` and `www.farfalina.tech`), reverse-proxying all traffic to `http://127.0.0.1:3000`.
4. **Traffic Collision Risk:** Any traffic or webhook requests directed to `farfalina.tech` or `207.211.167.189` are currently received and processed by this legacy instance rather than the local development environment via Cloudflare Tunnel (`https://omnichannel.farfalina.tech`).
5. **Rate-Limiting Protection (Critical Gotcha):** As documented in `vps-manager/SKILL.md`, burst connections trigger Oracle Cloud / sshd `MaxStartups` rate-limiting (`Connection closed by 207.211.167.189 port 22`). All shutdown and decommissioning steps MUST be executed as a **single compound remote command**.

---

## 2. Live System Observations

### 2.1 Host & OS Environment
- **Hostname:** `instance-20260907-1825`
- **OS / Kernel:** Ubuntu 24.04 LTS (`Linux instance-20260907-1825 6.17.0-1020-oracle #20-Ubuntu SMP aarch64`)
- **Uptime:** 28 days, 7 hours
- **User:** `ubuntu` (confirmed passwordless sudo privileges for systemctl commands)

### 2.2 Live PM2 Process Details
Command: `pm2 status && pm2 describe floreria`
```text
┌────┬──────────┬───────────┬─────────┬──────┬────────┬────────┬──────┬────────┬────────┬────────┬────────┬──────────┐
│ id │ name     │ namespace │ version │ mode │ pid    │ uptime │ ↺    │ status │ cpu    │ mem    │ user   │ watching │
├────┼──────────┼───────────┼─────────┼──────┼────────┼────────┼──────┼────────┼────────┼────────┼────────┼──────────┤
│ 0  │ floreria │ default   │ N/A     │ fork │ 435180 │ 4D     │ 6    │ online │ 0%     │ 58.5mb │ ubuntu │ disabled │
└────┴──────────┴───────────┴─────────┴──────┴────────┴────────┴──────┴────────┴────────┴──────┴────────┴──────────┘
- script path: /usr/bin/npm start -- -p 3000
- exec cwd:    /var/www/floreria-demo
- dump file:   /home/ubuntu/.pm2/dump.pm2 (contains floreria configuration)
- node:        v20.20.2
```

### 2.3 Live Nginx Service & Configuration
Command: `sudo systemctl status nginx --no-pager`
```text
● nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-10-01 06:11:12 UTC; 4 days ago
   Main PID: 407440 (nginx)
```

Configuration in `/etc/nginx/sites-available/farfalina.tech`:
- Domains: `server_name farfalina.tech www.farfalina.tech;`
- Upstream: `proxy_pass http://127.0.0.1:3000;`
- SSL: Let's Encrypt certificates at `/etc/letsencrypt/live/farfalina.tech/fullchain.pem`
- HTTP Redirect: Port 80 redirects to 443 HTTPS.

### 2.4 Live Port Bindings (`sudo ss -tulpn`)
```text
tcp   LISTEN 0   511   0.0.0.0:80    0.0.0.0:*   users:(("nginx",pid=407442,fd=7),("nginx",pid=407440,fd=7))
tcp   LISTEN 0   511   0.0.0.0:443   0.0.0.0:*   users:(("nginx",pid=407442,fd=6),("nginx",pid=407440,fd=6))
tcp   LISTEN 0   511         *:3000        *:*   users:(("next-server (v1",pid=435194,fd=18))
tcp   LISTEN 0   511      [::]:80       [::]:*   users:(("nginx",pid=407442,fd=8),("nginx",pid=407440,fd=8))
tcp   LISTEN 0   511      [::]:443      [::]:*   users:(("nginx",pid=407442,fd=5),("nginx",pid=407440,fd=5))
```

---

## 3. Analysis & Required Actions for R1

To achieve full decommissioning of the legacy VPS and eliminate webhook/traffic collision:
1. **Stop & Delete PM2 Process:**
   - `pm2 stop floreria`: Stops process 435180 and child next-server 435194. Port 3000 is released.
   - `pm2 delete floreria`: Removes `floreria` from PM2 in-memory registry.
   - `pm2 save`: Flushes the empty process list to `/home/ubuntu/.pm2/dump.pm2`, ensuring PM2 will not resurrect `floreria` upon reboot.
2. **Stop & Disable Nginx Service:**
   - `sudo systemctl stop nginx`: Kills Nginx master and worker processes immediately. Ports 80 and 443 are released.
   - `sudo systemctl disable nginx`: Removes the systemd symlink `/etc/systemd/system/multi-user.target.wants/nginx.service`. Nginx will not start on reboot.
3. **Compound Execution Requirement:**
   - All actions must be chained with `&&` inside a single SSH command string so that:
     a) Stdin hang is prevented (`-n` flag in PowerShell).
     b) Oracle Cloud SSH rate-limiting is avoided.
     c) Execution halts if any prior step fails.

---

## 4. Exact Safe Non-Interactive Command Sequence

### 4.1 Execution Command (To Be Run by Implementer)
Run from Windows PowerShell on the host workstation:

```powershell
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 stop floreria && pm2 delete floreria && pm2 save && sudo systemctl stop nginx && sudo systemctl disable nginx"
```

### 4.2 Post-Execution Verification Command
Run from Windows PowerShell to confirm complete shutdown:

```powershell
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "echo '=== PM2 STATUS ===' && pm2 status && echo '=== NGINX STATUS ===' && sudo systemctl status nginx --no-pager || true && echo '=== PORT CHECK (80, 443, 3000) ===' && (sudo ss -tulpn | grep -E ':(80|443|3000)\b' || echo 'PORTS 80/443/3000 FULLY RELEASED')"
```

**Expected Verification Output:**
1. PM2 table shows empty list (`┌────┬──────┬──────────┬...` with 0 processes).
2. Nginx status shows `Active: inactive (dead)` and `Loaded: ... disabled`.
3. Ports check outputs: `PORTS 80/443/3000 FULLY RELEASED` (no listeners on 80, 443, 3000).

---

## 5. Rollback / Disaster Recovery Plan (Reference Only)

If the team ever needs to re-enable services on the VPS in the future:
```powershell
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "cd /var/www/floreria-demo && pm2 start npm --name floreria -- start -- -p 3000 && pm2 save && sudo systemctl enable nginx && sudo systemctl start nginx"
```

---

## 6. Readiness Assessment

| Requirement Item | Status | Notes |
|---|---|---|
| SSH Key Verified | **PASS** | Valid file at `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key` |
| VPS Reachable | **PASS** | `ubuntu@207.211.167.189` responsive, latency low |
| Passwordless Sudo | **PASS** | `ubuntu` can run `systemctl` without interactive prompt |
| PM2 Process Identified | **PASS** | `floreria` (PID 435180), exactly 1 process |
| Nginx Reverse Proxy Identified | **PASS** | Active on ports 80 & 443 proxying to :3000 |
| Non-interactive Command Formulated | **PASS** | Validated flags and single compound string ready |

The system is fully surveyed and ready for immediate execution of R1 by the implementation agent.
