import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#15803d" />

        <meta name="application-name" content="مزارع السنبلة" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="السنبلة" />

        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
