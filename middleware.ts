import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { initPocketBaseFromRequest } from './app/lib/pb';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const pb = await initPocketBaseFromRequest(request);
  
  if (!pb.authStore.isValid) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
 
// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.png|login).*)'],
}


