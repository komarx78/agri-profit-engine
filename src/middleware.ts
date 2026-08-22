import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // `share/invoice/[id]` や `/api/` などの公開ルートは認証をスキップする
  if (
    request.nextUrl.pathname.startsWith('/share') ||
    request.nextUrl.pathname.startsWith('/api/')
  ) {
    return
  }

  // それ以外のルートはセッションを更新（未ログインなら /login にリダイレクト）
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
