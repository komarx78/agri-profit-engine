import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // ⚡ 現場ポータル・作業画面等は外部認証チェックを完全バイパス（0ms即座に応答し、現場通信ハングを100%遮断）
  if (
    pathname.startsWith('/portal') ||
    pathname.startsWith('/work') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/farm') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/manuals')
  ) {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 公開ルート（現場作業員・PIN管理者・未認証アクセス許可ルート・PWAマニフェスト）の判定
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sales-management') ||
    pathname.startsWith('/accounting-management') ||
    pathname.startsWith('/hr') ||
    pathname.startsWith('/farm') ||
    pathname.startsWith('/manuals') ||
    pathname.startsWith('/pesticides') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname === '/'

  // 1. 未ログイン状態で保護ルートにアクセスした場合は /login にリダイレクト
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. すでにログインしている状態で /login にアクセスした場合は管理者画面 (/admin/cultivations) にリダイレクト
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/cultivations'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
