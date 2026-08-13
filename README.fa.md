# Universal Manager

**هوشمندی یکپارچه لینک برای Chrome**

Universal Manager یک افزونه Manifest V3 است که فقط با درخواست کاربر صفحه را اسکن می‌کند و یک Dataset مشترک را در دو نمای اصلی ارائه می‌دهد:

- **Parts** برای دانلودهای چندبخشی، تشخیص Partهای گمشده، Mirrorها، خروجی و دانلود انتخاب‌شده.
- **Links** برای استخراج و دسته‌بندی لینک‌های صفحه، دانلود، آرشیو، رسانه، تصویر، سند و لینک‌های داخلی/خارجی.

هسته استخراج روی DOM، data-*، URLهای Script، Shadow DOM باز و منابعی که صفحه قبلاً لود کرده کار می‌کند و برای کشف لینک روی دکمه‌های دانلود سایت کلیک نمی‌کند.

## کانال‌ها

- `developer`: سورس کامل، تست، diagnostics و ابزار انتشار.
- `personal`: نسخه مناسب استفاده روزمره با diagnostics بیشتر.
- `public`: بسته تمیز برای GitHub عمومی و Chrome Web Store.

## توسعه

```bash
npm run validate
npm test
npm run build:public
npm run build:personal
npm run build:developer
```

مجوز دسترسی به سایت‌ها به‌صورت حداقلی و در زمان نیاز درخواست می‌شود؛ `<all_urls>` به‌صورت permission اجباری نصب نمی‌شود.

## حریم خصوصی

پردازش لینک‌ها محلی است و افزونه به endpoint متعلق به سازنده برای ارسال URLها متصل نمی‌شود.

## مجوز

MIT

## زبان

زبان پیش‌فرض افزونه **English** است و **فارسی** نیز پشتیبانی می‌شود. زبان از مسیر **Settings → Appearance & Experience → Language** تغییر می‌کند.

## انتشار

برای انتشار در Chrome Web Store و GitHub فایل `docs/PUBLISHING.md` را ببینید.
