import "@/styles/globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function App({ Component, pageProps }: AppProps) {
  console.log(true)
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider>
        <Component {...pageProps} />
      </ThirdwebProvider>
    </QueryClientProvider>
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
