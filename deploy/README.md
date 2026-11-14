# Деплой

Игра — чистая статика (HTML + JS + текстуры), сервер ей не нужен. Основной способ — **GitHub Pages**, запасной — свой сервер на **Docker + Caddy**.

---

## Основной способ: GitHub Pages

Адрес игры: **https://ahadniyozov.github.io/nasa-challenge-2026/**
(2D-полёт: `…/nasa-challenge-2026/?2d`, все миссии открыты: `…/?all`).

### Как это работает

`.github/workflows/pages.yml`: на каждый push в `main` (и вручную кнопкой **Run workflow** во вкладке Actions):
`npm ci` → `npm run build -w @mission/web -- --mode pages` → публикация `apps/web/dist` в Pages.

Сайт живёт не в корне домена, а в папке `/nasa-challenge-2026/`, поэтому:
- `--mode pages` включает `base: '/nasa-challenge-2026/'` в `apps/web/vite.config.ts`. Обычная сборка, `npm run dev` и Docker остаются в корне `/`.
- Файлы из `public/` (текстуры и т.п.) в коде загружать **только** через `import.meta.env.BASE_URL`:
  ```ts
  `${import.meta.env.BASE_URL}textures/earth-day.webp`   // ✅
  '/textures/earth-day.webp'                             // ❌ на Pages будет 404
  ```
- Если репозиторий переименуют — поменять `PAGES_BASE` в `vite.config.ts`.

### Включить один раз (владелец репозитория)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Запустить: **Actions → Pages → Run workflow** (или любой push в `main`).
3. Через 1–2 минуты ссылка появится в Settings → Pages и в шаге `deploy` workflow.

### Проверка после публикации

- [ ] `https://ahadniyozov.github.io/nasa-challenge-2026/` открывается, замок HTTPS (Pages даёт его сам).
- [ ] 3D-полёт: видна Земля с текстурой (не чёрный шар). В DevTools → Network нет 404, `textures/earth-day.webp` грузится из `/nasa-challenge-2026/textures/`.
- [ ] `?2d` — 2D-полёт с картой Земли.
- [ ] Обновить страницу на `?all` — не 404.

### Проверить сборку Pages локально

```bash
npm run build -w @mission/web -- --mode pages
cd apps/web && npx vite preview --mode pages
# открыть http://localhost:4173/nasa-challenge-2026/
```

---

## Запасной способ: свой сервер (Docker + Caddy)

Сервер собирает игру в Docker; Caddy отдаёт её по HTTPS (сертификат Let's Encrypt получается сам) и сжимает ответы (zstd/gzip). Сборка здесь обычная, от корня домена.

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
