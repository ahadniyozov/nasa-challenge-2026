# Деплой на свой домен

Сервер собирает игру в Docker; Caddy отдаёт её по HTTPS (сертификат Let's Encrypt получается сам) и сжимает ответы (zstd/gzip).

## Что нужно

- VPS с Linux (1 ГБ RAM хватает), открытые порты 80 и 443.
- Docker и Docker Compose (`curl -fsSL https://get.docker.com | sh`).
- Домен или поддомен, например `mission.example.com`.

## Шаги

1. **DNS.** В панели домена создать A-запись: `mission` → IP сервера. Проверить: `nslookup mission.example.com` показывает IP сервера. Без этого Caddy не получит сертификат.
2. **Код на сервер:**
   ```bash
   git clone https://github.com/ahadniyozov/nasa-challenge-2026.git
   cd nasa-challenge-2026/deploy
   cp .env.example .env
   nano .env              # DOMAIN=mission.example.com
   ```
3. **Запуск:**
   ```bash
   docker compose up -d --build
   docker compose logs -f web     # ждать строку "certificate obtained successfully"
   ```
4. **Обновление** после мержа в `main`:
   ```bash
   cd nasa-challenge-2026 && git pull && cd deploy && docker compose up -d --build
   ```

Если порты 80/443 уже заняты другим сервисом — убрать `ports` у `web` в `docker-compose.yml` и проксировать на него из существующего прокси.

## Проверка после деплоя

```bash
D=https://mission.example.com
# 1. HTTPS работает, сертификат валиден (без -k!)
curl -sI $D | head -1                                   # HTTP/2 200
# 2. http → https редирект
curl -sI http://mission.example.com | grep -i location  # https://...
# 3. сжатие JS включено
JS=$(curl -s $D | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -sI -H 'Accept-Encoding: gzip, zstd' $D$JS | grep -i content-encoding   # zstd или gzip
# 4. текстуры отдаются и кэшируются
curl -sI $D/textures/earth-day.webp | grep -iE 'content-type|cache-control'  # image/webp, max-age=31536000
```

Чек-лист в браузере:
- [ ] Игра открывается по `https://`, замок в адресной строке.
- [ ] По умолчанию английский язык (в приватном окне, без сохранённого `lang`).
- [ ] Звук работает и выключается кнопкой 🔊.
- [ ] Телефон: портрет, нет горизонтальной прокрутки, полёт плавный.

## Размеры (проверено 2026-11-14)

| Файл | Размер | Лимит из TASKS-3D |
|---|---|---|
| `textures/earth-day.webp` | 197 КБ | ≤ 2 МБ |
| `textures/earth-night.webp` | 52 КБ | ≤ 2 МБ |
| `assets/three-*.js` (gzip) | 326 КБ | бандл 3D ≤ 1,5 МБ gzip |
| `assets/index-*.js` (gzip) | 90 КБ | — |

Текстуры уже в WebP, отдельное сжатие не нужно. `encode` в Caddy их не пережимает (WebP уже сжат), а JS/CSS/HTML сжимает.

## Crew mode on the relay (gonogo.twiy.ceo)

Crew mode needs the small socket.io server in `apps/server` next to the static site. On the relay (Caddy runs from systemd):

1. Copy the code (from the Mac): `rsync -az --delete --exclude node_modules --exclude .git --exclude apps/web/dist --exclude _nasa --exclude 'Claude outputs' ~/nasa-challenge-2026/ ahad@158.160.239.254:~/gonogo/`
2. Once: Node 22 on the relay: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
3. `cd ~/gonogo && npm ci -w @mission/server`
4. Once: `sudo cp deploy/gonogo-crew.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now gonogo-crew` (after an update: `sudo systemctl restart gonogo-crew`)
5. Once: in the `gonogo.twiy.ceo` block of `/etc/caddy/Caddyfile` add, before `file_server`: `handle /socket.io/* { reverse_proxy 127.0.0.1:8787 }`, then `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`
6. Check: `curl -s localhost:8787/api/health` prints `ok`.

Locally: `npm run dev:server` in one terminal and `npm run dev` in another (Vite forwards `/socket.io` to port 8787).
