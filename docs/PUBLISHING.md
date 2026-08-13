# انتشار Universal Resource Manager

## Chrome Web Store

1. فایل `universal-resource-manager-v0.2.4-public.zip` را آماده داشته باشید.
2. وارد Chrome Web Store Developer Dashboard شوید: https://chrome.google.com/webstore/devconsole/
3. اگر اولین انتشار است، حساب Developer را ثبت و مراحل حساب را کامل کنید.
4. گزینه **Add new item** را بزنید.
5. ZIP مربوط به Public را Upload کنید.
6. اطلاعات Store Listing، Privacy و Distribution را تکمیل کنید.
7. در اولین انتشار بهتر است ابتدا آن را برای Trusted Testers یا با انتشار مرحله‌ای آزمایش کنید.
8. پس از تأیید Review، انتشار عمومی را فعال کنید.

### فایل پیشنهادی برای انتشار عمومی

`dist/universal-resource-manager-v0.2.4-public.zip`

Personal و Developer برای استفاده و عیب‌یابی توسعه هستند و برای Store Listing عمومی استفاده نشوند.

## GitHub

1. یک repository جدید با نام پیشنهادی `universal-resource-manager` بسازید.
2. Source ZIP را Extract کنید.
3. کل سورس Extract شده را داخل repository قرار دهید.
4. Commit و Push کنید.
5. در GitHub یک Release با tag پیشنهادی `v0.2.4` بسازید.
6. فایل Public ZIP را به Release به‌عنوان asset اضافه کنید.
7. Source ZIP و در صورت نیاز Personal/Developer ZIP را نیز به‌عنوان artifact ثانویه اضافه کنید.

### توجه

GitHub به‌تنهایی روش عمومی نصب افزونه Chrome برای کاربران معمولی نیست. Chrome برای نصب مستقیم افزونه‌های عمومی به Chrome Web Store متکی است؛ GitHub برای Source، Release، مستندات و دریافت فایل‌ها مناسب است.

## فرآیند پیشنهادی پروژه

`Development → Test → Validate → Build → ZIP Integrity → Chrome Test → Publish`

بعد از انتشار، گزارش‌های کاربر و Feedback را جمع‌آوری و روی همان شاخه توسعه بررسی کنید. شماره نسخه فقط وقتی تغییر کند که کاربر تصمیم بگیرد.
