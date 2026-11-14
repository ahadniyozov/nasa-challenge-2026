# Деплой на свой сервер и домен

Игра — чистая статика (`apps/web/dist`: `index.html`, `assets/`, `textures/`). Docker собирает её (`npm run build`), **Caddy** отдаёт по HTTPS: сертификат Let's Encrypt получает сам, сжимает zstd/gzip, ставит заголовки кэша.

```
deploy/
  deploy.sh           запуск и обновление одной командой
  docker-compose.yml  сервис web (Caddy + игра); server — необязательный (профиль multiplayer)
  Dockerfile          build (node:22-alpine, npm ci + npm run build) → web (caddy:2-alpine)
  Caddyfile           HTTPS, сжатие, кэш, MIME
  .env.example        DOMAIN=...
```

---

## 1. Что поставить на сервер

- Linux VPS (Ubuntu 22.04/24.04 или Debian 12), **1 ГБ RAM** хватает (сборка — пиковая нагрузка), x64 или arm64.
- Открыть порты **80/tcp, 443/tcp, 443/udp** (UFW: `ufw allow 80,443/tcp && ufw allow 443/udp`; у облачных VPS — ещё в панели провайдера, «security group / firewall»).
- Docker с плагином compose и git:
  ```bash
  curl -fsSL https://get.docker.com | sh
  apt-get install -y git curl
  docker compose version        # проверка: Docker Compose version v2.x
  ```

## 2. DNS-запись для домена

В панели, где куплен домен, создать **A-запись** на IP сервера (для IPv6 — ещё AAAA):

| Тип | Имя | Значение | TTL |
|---|---|---|---|
| A | `mission` (поддомен) или `@` (сам домен) | `203.0.113.10` ← IP сервера | 300 |

Проверить (с любого компьютера), что домен уже указывает на сервер:
```bash
nslookup mission.example.com        # Address: 203.0.113.10
```
Пока DNS не обновился, Caddy не получит сертификат — подождать 5–30 минут. Если перед доменом стоит Cloudflare-прокси (оранжевое облако) — на время первого запуска выключить (серое облако).

## 3. Запуск — одна команда

```bash
git clone https://github.com/ahadniyozov/nasa-challenge-2026.git
cd nasa-challenge-2026
./deploy/deploy.sh mission.example.com
```

Скрипт: сохраняет домен в `deploy/.env` → `git pull` → проверяет DNS → `docker compose up -d --build` → ждёт, пока `https://домен` ответит, и печатает `The game is live: https://...`.
Первая сборка — 2–4 минуты.

## 4. Обновление после мержа в `main`

```bash
cd nasa-challenge-2026 && ./deploy/deploy.sh
```
(домен берётся из `deploy/.env`). Сертификаты лежат в томе `caddy-data` и при обновлении сохраняются.

Полезное:
```bash
cd deploy
docker compose ps                     # что запущено
docker compose logs --tail=50 web     # логи Caddy (ошибки сертификата видны здесь)
docker compose down                   # остановить (тома с сертификатами остаются)
```

## 5. Как проверить HTTPS и настройки

```bash
D=https://mission.example.com
# 1) HTTPS с настоящим сертификатом (без -k!) и HTTP/2
curl -sI $D | head -1                                   # HTTP/2 200
# 2) http → https
curl -sI http://mission.example.com | grep -i location  # Location: https://mission.example.com/
# 3) index.html не кэшируется надолго
curl -sI $D/ | grep -i cache-control                    # no-cache
# 4) сжатие и долгий кэш для /assets/* (в именах хеш)
JS=$(curl -s $D/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -sI -H 'Accept-Encoding: zstd, gzip' $D$JS | grep -iE 'content-encoding|cache-control'
#   content-encoding: zstd   cache-control: public, max-age=31536000, immutable
# 5) текстуры: правильный MIME и кэш на неделю
curl -sI $D/textures/earth-day.webp | grep -iE 'content-type|cache-control'
#   content-type: image/webp   cache-control: public, max-age=604800
# 6) сертификат: кто выдал и до какого числа
echo | openssl s_client -connect mission.example.com:443 -servername mission.example.com 2>/dev/null | openssl x509 -noout -issuer -enddate
#   issuer=... Let's Encrypt ...   notAfter=... (Caddy продлевает сам)
```
Онлайн-проверка: https://www.ssllabs.com/ssltest/ — оценка A или выше.

Чек-лист в браузере:
- [ ] `https://домен` открывается, замок в адресной строке, нет предупреждений.
- [ ] 3D-полёт: Земля с текстурой; `?2d` — 2D-полёт. Миссия 1 проходится.
- [ ] По умолчанию английский (в приватном окне).
- [ ] Звук есть и выключается 🔊.
- [ ] Телефон: портрет, без горизонтальной прокрутки.

## 6. Локальная проверка (на своём компьютере с Docker)

```bash
./deploy/deploy.sh :80          # без сертификата → http://localhost
# или
./deploy/deploy.sh localhost    # HTTPS с сертификатом Caddy → https://localhost (браузер предупредит один раз)
```
Windows без bash: `cd deploy`, создать `.env` с `DOMAIN=:80`, затем `docker compose up -d --build`.

## Кэш и заголовки (Caddyfile)

| Путь | Cache-Control | Почему |
|---|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` | в имени файла хеш содержимого, новый деплой = новые имена |
| `/textures/*` | `public, max-age=604800` (неделя) | имена без хеша |
| `/`, `index.html` | `no-cache` | новый деплой виден сразу |

Сжатие: `encode zstd gzip` (JS/CSS/HTML; WebP уже сжат). MIME `.webp` → `image/webp` задан явно. `X-Content-Type-Options: nosniff`.
Резервного `index.html` для любых путей нет: маршрутов в игре нет (только `?2d`, `?all`), а пропавший `/assets/*.js` должен давать 404, а не HTML с годовым кэшем.

## Необязательный сервер мультиплеера

Сервис `server` (комнаты и лидерборд старого режима инженера) **игре не нужен** и по умолчанию не запускается (профиль compose `multiplayer`). Пути `/api/*` и `/socket.io/*` без него отвечают 502 — игра их не вызывает.
```bash
cd deploy && docker compose --profile multiplayer up -d --build   # включить
docker compose stop server && docker compose rm -f server         # выключить, если остался от старого деплоя
```

## Если порты 80/443 уже заняты

Другой веб-сервер на этой машине: убрать `ports` у `web` в `docker-compose.yml`, добавить `- "8080:80"` и в `.env` поставить `DOMAIN=:80`; HTTPS тогда делает существующий прокси (`proxy_pass http://127.0.0.1:8080`).

## Размеры (проверено 2026-11-14)

| Файл | Размер | gzip |
|---|---|---|
| `assets/three-*.js` (только 3D-полёт, грузится лениво) | 920 КБ | 243 КБ |
| `assets/react-*.js` | 221 КБ | 69 КБ |
| `assets/index-*.js` | 121 КБ | 42 КБ |
| `textures/earth-day.webp` | 197 КБ | — |
| `textures/earth-night.webp` | 52 КБ | — |
