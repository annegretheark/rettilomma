import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Hovslager skal åpne direkte på innlogging
  if (host === 'hov.rettilomma.com') {
    if (path === '/' || path === '') {
      url.pathname = '/hovslager-login.html';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Hovslager demo skal åpne direkte på demoen
  if (host === 'demo.hovslager.rettilomma.com') {
    if (path === '/' || path === '') {
      url.pathname = '/public/demo/index.html';
      return NextResponse.rewrite(url);
    }

    // Hvis demoen ber om lokale assets som /assets/..., hent dem fra public/demo/assets/
    if (path.startsWith('/assets/')) {
      url.pathname = '/public/demo' + path;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // Håndverker skal åpne direkte på innlogging
  if (host === 'handverker.rettilomma.com') {
    if (path === '/' || path === '') {
      url.pathname = '/handverker-login.html';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Veterinær/behandler skal åpne direkte på innlogging
  if (
    host === 'veterinaer.rettilomma.com' ||
    host === 'veterinær.rettilomma.com' ||
    host === 'behandler.rettilomma.com'
  ) {
    if (path === '/' || path === '') {
      url.pathname = '/behandler-login.html';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // rettilomma.com og www.rettilomma.com bruker vanlig index.html
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
