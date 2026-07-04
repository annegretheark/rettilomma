import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // hov.rettilomma.com skal vise HovslagerSystem
  if (host === 'hov.rettilomma.com') {
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/hovslager-login.html';
      return NextResponse.rewrite(url);
    }

    // Hvis noen går til /hovslager-login.html direkte, la filen vises
    if (url.pathname === '/hovslager-login.html') {
      return NextResponse.next();
    }

    // Hvis appen bruker /hovslager/... skal det få gå som normalt
    if (url.pathname.startsWith('/hovslager/')) {
      return NextResponse.next();
    }
  }

  // demo.hovslager.rettilomma.com skal vise demo
  if (host === 'demo.hovslager.rettilomma.com') {
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/demo/index.html';
      return NextResponse.rewrite(url);
    }

    if (url.pathname.startsWith('/demo/')) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
