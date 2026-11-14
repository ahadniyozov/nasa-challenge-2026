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
