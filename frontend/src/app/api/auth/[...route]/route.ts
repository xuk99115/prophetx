import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// In-memory user store (for demo purposes)
const users: Map<string, { id: string; username: string; email: string; password: string; credits: number }> = new Map();

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const path = request.nextUrl.pathname;

  if (path.endsWith('/register')) {
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // Check if username already exists
    for (const user of users.values()) {
      if (user.username === username) {
        return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
      }
    }

    const id = generateToken().slice(0, 16);
    const user = { id, username, email, password, credits: 1000 };
    users.set(id, user);

    return NextResponse.json({ message: '注册成功', user: { id, username, email, credits: 1000 } });
  }

  if (path.endsWith('/login')) {
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '缺少用户名或密码' }, { status: 400 });
    }

    // Find user by username and password
    let foundUser: { id: string; username: string; email: string; password: string; credits: number } | null = null;
    for (const user of users.values()) {
      if (user.username === username && user.password === password) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const token = generateToken();
    return NextResponse.json({
      token,
      user: { id: foundUser.id, username: foundUser.username, email: foundUser.email, credits: foundUser.credits }
    });
  }

  return NextResponse.json({ error: '未知的认证端点' }, { status: 404 });
}