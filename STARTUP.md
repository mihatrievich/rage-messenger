# RAGE Messenger - Подробная инструкция по запуску

## Шаг 1: Открыть терминал

Нажмите `Win + R`, введите `cmd` и нажмите Enter.

## Шаг 2: Перейти в папку с проектом

Введите (или скопируйте):
```
cd C:\Users\Михаил\Documents\rage
```

Если пишет "Системе не удается найти указанный путь", попробуйте:
```
cd /d "C:\Users\Михаил\Documents\rage"
```

## Шаг 3: Запустить сервер

Введите:
```
cd server
npm start
```

**Ожидайте увидеть:**
```
RAGE Server running on port 3000
MongoDB connected
```

---

## Шаг 4: Открыть второй терминал (для друзей)

Нажмите `Win + R`, введите `cmd` и нажмите Enter.

## Шаг 5: Запустить туннель

Введите:
```
cd C:\Users\Михаил\Documents\rage
cloudflared tunnel --url http://localhost:3000
```

**Подождите 10-20 секунд** - появится ссылка вида:
```
https://suit-topic-software.trycloudflare.com
```

Эту ссылку можно отправить другу!

---

## Если не работает...

### Ошибка "node не является внутренней или внешней командой"
Нужно установить Node.js: https://nodejs.org/

### Ошибка "EADDRINUSE: address already in use"
Порт занят. Введите:
```
taskkill /F /IM node.exe
```
Затем повторите `npm start`

### Ошибка "Системе не удается найти указанный путь"
Папка может называться иначе. Откройте проводник и найдите папку `rage` в документах.

### Cloudflare не установлен
Установите: https://github.com/cloudflare/cloudflared/releases

---

## Как проверить что всё работает

1. Откройте http://localhost:3000 в браузере
2. Зарегистрируйтесь / войдите
3. Если есть ссылка от cloudflared - друг может зайти по ней

---

## Структура папок

```
C:\Users\Михаил\Documents\rage\
├── server\           (тут сервер)
│   └── index.js
├── client\           (тут сайт)
│   ├── src\
│   └── build\
├── STARTUP.md        (этот файл)
└── README.md
```

---

## Быстрые команды (скопировать всё)

### Терминал 1 (Сервер):
```
cd /d "C:\Users\Михаил\Documents\rage\server" && npm start
```

### Терминал 2 (Для друзей):
```
cd /d "C:\Users\Михаил\Documents\rage" && cloudflared tunnel --url http://localhost:3000
```
