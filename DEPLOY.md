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
3. **Важно:** в настройках проекта укажите:
   - **Root Directory:** `web` (папка с Next.js)
   - **Framework Preset:** Next.js (определится автоматически)

4. Добавьте переменные окружения в **Settings → Environment Variables**:
   - `ADMIN_LOGIN` — логин администратора (например, `admin`)
   - `ADMIN_PASSWORD` — пароль администратора (задайте надёжный пароль)

5. Нажмите **Deploy**.

## 3. Обновление данных

После запуска `generate_report.py` в корне проекта:

```bash
# Скопируйте обновлённые данные в web
cp work_summary.json web/public/

# Закоммитьте и запушьте
git add web/public/work_summary.json
git commit -m "Обновление данных отчёта"
git push
```

Vercel автоматически пересоберёт проект после пуша.

## 4. Доступ к сайту

- По умолчанию: `https://ИМЯ_ПРОЕКТА.vercel.app`
- Вход: `/login` — логин и пароль из переменных окружения
