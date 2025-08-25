import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { MongoClient, ObjectId } from 'mongodb';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const MONGO_URL = 'mongodb://localhost:27017';
const client = new MongoClient(MONGO_URL);

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

let currentUser: CurrentUser | null = null;

async function main() {
  await client.connect();
  const db = client.db('todo-app');

  // Читаем typeDefs из файлов
  const userTypeDefs = readFileSync(path.join(__dirname, 'src/graphql/typeDefs/user.graphql'), 'utf-8');
  const taskTypeDefs = readFileSync(path.join(__dirname, 'src/graphql/typeDefs/task.graphql'), 'utf-8');
  const typeDefs = [userTypeDefs, taskTypeDefs];

  const resolvers = {
    Query: {
      async tasks(_: unknown, __: unknown, { db }: { db: any }) {
        if (!currentUser) {
          return {
            tasks: [],
            error: 'Требуется авторизация для просмотра задач'
          };
        }
        const tasksCollection = db.collection('tasks');
        const tasks = await tasksCollection.find({ userId: currentUser.id }).toArray();
        return {
          tasks: tasks.map((task: any) => ({
            id: task._id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            user: null,
          })),
          error: null
        };
      },

      async task(_: unknown, { id }: { id: string }, { db }: { db: any }) {
        if (!currentUser) {
          return {
            task: null,
            error: 'Требуется авторизация для просмотра задачи'
          };
        }
        const tasksCollection = db.collection('tasks');
        const task = await tasksCollection.findOne({
          _id: new ObjectId(id),
          userId: currentUser.id
        });
        if (!task) {
          return {
            task: null,
            error: 'Задача не найдена'
          };
        }
        return {
          task: {
            id: task._id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            user: null,
          },
          error: null
        };
      },

      async me(): Promise<{ user: CurrentUser | null; error: string | null }> {
        if (!currentUser) {
          return {
            user: null,
            error: 'Пользователь не авторизован'
          };
        }
        return {
          user: {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            createdAt: currentUser.createdAt,
          },
          error: null
        };
      },
    },
    Mutation: {
      async register(_: any, { username, email, password }: any, { db }: any) {
        const usersCollection = db.collection('users');
        const existing = await usersCollection.findOne({ email });
        if (existing) {
          return {
            user: null,
            error: 'Пользователь с таким email уже существует'
          };
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          username,
          email,
          password: hashedPassword,
          createdAt: new Date(),
        };
        const result = await usersCollection.insertOne(newUser);
        return {
          user: {
            id: result.insertedId,
            username,
            email,
            createdAt: newUser.createdAt.toISOString(),
          },
          error: null
        };
      },

      async login(_: unknown, { email, password }: { email: string; password: string }, { db }: { db: any }) {
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return {
            user: null,
            error: 'Пользователь не найден'
          };
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return {
            user: null,
            error: 'Неверный пароль'
          };
        }
        currentUser = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        };
        return {
          user: currentUser,
          error: null
        };
      },

      async createTask(
        _: unknown,
        { title, description }: { title: string; description?: string },
        { db }: { db: any }
      ) {
        if (!currentUser) {
          return {
            task: null,
            error: 'Требуется авторизация для создания задачи'
          };
        }
        const tasksCollection = db.collection('tasks');
        const newTask = {
          title,
          description,
          completed: false,
          userId: currentUser.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await tasksCollection.insertOne(newTask);
        return {
          task: {
            id: result.insertedId,
            title,
            description,
            completed: false,
            createdAt: newTask.createdAt.toISOString(),
            updatedAt: newTask.updatedAt.toISOString(),
            user: null,
          },
          error: null
        };
      },

      async updateTask(
        _: unknown,
        { id, title, description, completed }: { id: string; title?: string; description?: string; completed?: boolean },
        { db }: { db: any }
      ) {
        if (!currentUser) {
          return {
            task: null,
            error: 'Требуется авторизация для обновления задачи'
          };
        }
        const tasksCollection = db.collection('tasks');
        const updateFields: any = {};
        if (title !== undefined) updateFields.title = title;
        if (description !== undefined) updateFields.description = description;
        if (completed !== undefined) updateFields.completed = completed;
        updateFields.updatedAt = new Date();
        const result = await tasksCollection.updateOne(
          {
            _id: new ObjectId(id),
            userId: currentUser.id // Проверяем принадлежность задачи
          },
          { $set: updateFields }
        );
        if (result.matchedCount === 0) {
          return {
            task: null,
            error: 'Задача не найдена или у вас нет прав для её редактирования'
          };
        }
        const task = await tasksCollection.findOne({
          _id: new ObjectId(id),
          userId: currentUser.id
        });
        if (!task) {
          return {
            task: null,
            error: 'Задача не найдена'
          };
        }
        return {
          task: {
            id: task._id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            user: null,
          },
          error: null
        };
      },

      async deleteTask(
        _: unknown,
        { id }: { id: string },
        { db }: { db: any }
      ) {
        if (!currentUser) {
          return {
            success: false,
            error: 'Требуется авторизация для удаления задачи'
          };
        }
        const tasksCollection = db.collection('tasks');
        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(id),
          userId: currentUser.id
        });
        if (result.deletedCount === 0) {
          return {
            success: false,
            error: 'Задача не найдена или у вас нет прав для её удаления'
          };
        }
        return {
          success: true,
          error: null
        };
      },
    },
    Task: {
      user: () => null,
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const yoga = createYoga({
    schema,
    context: { db },
  });

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/graphql') {
      return yoga(req, res);
    }

    if (req.url === '/' || req.url === '/index.html') {
      try {
        const htmlPath = path.join(__dirname, 'public', 'index.html');
        const html = readFileSync(htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } catch (error) {
        res.writeHead(404);
        res.end('File not found');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(4000, () => {
    console.log('Server is running on http://localhost:4000');
    console.log('GraphQL endpoint: http://localhost:4000/graphql');
    console.log('Frontend: http://localhost:4000/');
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
});