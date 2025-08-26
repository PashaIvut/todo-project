# Todo Project

Учебный проект на Bun + TypeScript + MongoDB + GraphQL

## Требования

- Bun
- Docker
- Git

## Установка и запуск

1. Клонируйте репозиторий:
   ```sh
   git clone <ваша_ссылка>
   cd todo-project
   ```

2. Установите зависимости:
   ```sh
   bun install
   ```

3. Запустите MongoDB через Docker:
   ```sh
   docker run -d -p 27017:27017 --name mongodb mongo
   ```

4. Запустите сервер:
   ```sh
   bun run index.ts
   ```

5. Откройте GraphQL Playground:
   - http://localhost:4000/graphql

   Можно делать запросы в GraphQL Playground по типу этого:
   ```sh
   mutation {
     register(username: "testuser", email: "test@example.com", password: "password123") {
       user {
         id
         username
         email
       }
       error
     }
   }
   ```

6. Минимальный frontend с подобием пользовательского интерфейса: 
   - http://localhost:4000/
  
