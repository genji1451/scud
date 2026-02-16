# Развёртывание на Vercel

## 1. Подготовка к GitHub

В корне проекта выполните:

```bash
# Инициализация git (если ещё не сделано)
git init

# Добавление файлов
git add .
git commit -m "Initial commit: дашборд с авторизацией"

# Создание репозитория на GitHub и пуш
# Создайте репозиторий на github.com, затем:
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПОЗИТОРИЯ.git
git branch -M main
git push -u origin main
```

## 2. Подключение к Vercel

1. Зайдите на [vercel.com](https://vercel.com) и войдите через GitHub.
2. Нажмите **Add New Project** и выберите ваш репозиторий.
3. **Перед деплоем** нажмите **Configure Project** и укажите:
   - **Root Directory:** нажмите **Edit** → выберите папку `web` → **Continue**
   - **Framework Preset:** Next.js (должен определиться автоматически)
   - **Build Command:** `npm run build` (по умолчанию)
   - **Output Directory:** `.next` (по умолчанию)

4. В разделе **Environment Variables** добавьте:
   - `ADMIN_LOGIN` = ваш логин (например, `admin`)
   - `ADMIN_PASSWORD` = ваш пароль (надёжный!)

5. Нажмите **Deploy**.

---

### Если на Vercel не работает авторизация (работает локально)

**1. Проверьте Root Directory**

- Зайдите в проект на Vercel → **Settings** → **General**
- В блоке **Root Directory** должно быть указано `web`
- Если там пусто или другой путь — нажмите **Edit**, выберите `web`, сохраните
- Сделайте **Redeploy** (Deployments → три точки у последнего деплоя → Redeploy)

**2. Проверьте переменные окружения**

- **Settings** → **Environment Variables**
- Должны быть `ADMIN_LOGIN` и `ADMIN_PASSWORD` для Production (и Preview, если нужно)
- После изменения переменных — **Redeploy**

**3. Проверьте домен**

- Используйте основной домен: `https://ИМЯ_ПРОЕКТА.vercel.app`
- Preview-ссылки (например, `xxx-git-branch-username.vercel.app`) тоже должны работать, если переменные заданы для Preview

**4. Очистите cookies и кэш**

- Откройте сайт в режиме инкогнито или очистите cookies для домена vercel.app

**5. Ошибка vercel.live / feedback.js ERR_TIMED_OUT**

- Скрипт Vercel Live может таймаутить и мешать работе. Отключите: **Settings** → **Analytics** → отключите лишние функции или проверьте, что домен vercel.live не блокируется (VPN, фаервол, блокировщик рекламы).

**6. Ошибка 500 / __dirname is not defined**

- **Framework Preset:** Vercel → Settings → General → **Build & Development Settings** → Framework Preset должен быть **Next.js** (не "Other"). Если "Other" — переключите на Next.js и сделайте Redeploy
- **Vercel Logs:** Deployments → выберите деплой → вкладка **Functions** или **Logs** — там будет stack trace
- **Частые причины:** отсутствие `work_summary.json` в `web/data/`, неверные env vars

## 3. Исключение строк из статистики

Чтобы исключить определённые дни (сотрудник + дата) из отчётов и дашборда, отредактируйте `generate_report.py`:

```python
EXCLUDE_ROWS = [
    ('Фамилия Имя Отчество', '03.12.2025'),
    ('Другой сотрудник', '15.01.2026'),
]
```

Формат: `(Сотрудник, Дата)` — полное ФИО как в данных, дата в формате `ДД.ММ.ГГГГ`.

## 4. Обновление данных

После запуска `generate_report.py` в корне проекта:

```bash
# Скопируйте обновлённые данные в web (в data — для API, в public — для статики)
cp work_summary.json web/data/
cp work_summary.json web/public/

# Закоммитьте и запушьте
git add web/data/work_summary.json web/public/work_summary.json
git commit -m "Обновление данных отчёта"
git push
```

Vercel автоматически пересоберёт проект после пуша.

## 5. Доступ к сайту

- По умолчанию: `https://ИМЯ_ПРОЕКТА.vercel.app`
- Вход: `/login` — логин и пароль из переменных окружения
