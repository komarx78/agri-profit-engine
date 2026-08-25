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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ログインしていない場合で、保護されたルートにアクセスした場合
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/farm') &&
    !request.nextUrl.pathname.startsWith('/sales') &&
    !request.nextUrl.pathname.startsWith('/work') &&
    !request.nextUrl.pathname.startsWith('/portal') &&
    !request.nextUrl.pathname.startsWith('/admin') &&
    !request.nextUrl.pathname.startsWith('/pesticides') &&
    !request.nextUrl.pathname.startsWith('/sales-management') &&
    !request.nextUrl.pathname.startsWith('/accounting-management') &&
    !request.nextUrl.pathname.startsWith('/hr') &&
    !request.nextUrl.pathname.startsWith('/manuals') &&
    !request.nextUrl.pathname.startsWith('/b2b-order') &&
    !request.nextUrl.pathname.startsWith('/super-admin') &&
    request.nextUrl.pathname !== '/'
  ) {
    // '/login' にリダイレクト
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
