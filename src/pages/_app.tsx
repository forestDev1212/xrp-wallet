import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  console.log(true)
  return (
    <Component {...pageProps} />
  )
}

// export default function App({ Component, pageProps }: AppProps) {
//   return (
//       <Component {...pageProps} />
//   )
// }

// // _app.tsx or index.tsx
// import { AppProps } from 'next/app';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { client } from './client';

// const queryClient = new QueryClient();

// function MyApp({ Component, pageProps }: AppProps) {
//   return (
//     <QueryClientProvider client={queryClient}>
//       <Component {...pageProps} />
//     </QueryClientProvider>
//   );
// }

// export default MyApp;
