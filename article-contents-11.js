export const ART33_CONTENT = `
<div class="cve-summary-card">
  <div class="cve-item">
    <span class="cve-label">CVE شناسه</span>
    <span class="cve-value ltr">CVE-2026-41940</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">امتیاز CVSS v3</span>
    <span class="cve-score">9.8</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">شدت</span>
    <span class="cve-value cve-critical">بحرانی (Critical)</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">نوع آسیب‌پذیری</span>
    <span class="cve-value">CRLF Injection → RCE</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">محصول آسیب‌پذیر</span>
    <span class="cve-value ltr">cPanel &amp; WHM &gt; 11.40</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">وضعیت پچ</span>
    <span class="cve-value cve-patched">پچ موجود است ✓</span>
  </div>
  <div class="cve-item">
    <span class="cve-label">تاریخ افشاء</span>
    <span class="cve-value">فروردین ۱۴۰۵</span>
  </div>
</div>

<h2>مقدمه: وقتی خطاهای کلاسیک، سیستم‌های مدرن را به زانو درمی‌آورند</h2>
<p>در اوایل سال <strong>۱۴۰۵ (۲۰۲۶)</strong>، جامعه امنیت سایبری با یکی از خطرناک‌ترین آسیب‌پذیری‌های دهه اخیر مواجه شد. آسیب‌پذیری با شناسه <strong>CVE-2026-41940</strong> که قلب تپنده مدیریت هاستینگ جهان، یعنی <strong>cPanel &amp; WHM</strong> را هدف قرار داد. این یک باگ پیچیده حافظه نبود؛ بلکه یک خطای منطقی از جنس <em>Carriage Return Line Feed (CRLF) Injection</em> بود که به مهاجم اجازه می‌داد با یک درخواست HTTP ساده، بدون داشتن نام کاربری و رمز عبور، به سطح دسترسی <strong>Root</strong> برسد.</p>

<p>اهمیت این آسیب‌پذیری زمانی مشخص می‌شود که بدانیم بیش از <strong>۱.۵ میلیون سرور</strong> لینوکسی در سطح اینترنت از cPanel استفاده می‌کنند. در این مقاله از <strong>تکناو</strong>، مکانیزم این Zero-Day را به صورت فنی و خط‌به‌خط بررسی می‌کنیم تا درک کنیم چگونه یک اعتبارسنجی ساده هدرهای HTTP می‌تواند کل یک زیرساخت را به خطر بیندازد.</p>

<h2>ریشه‌یابی آسیب‌پذیری (Root Cause Analysis)</h2>
<p>سرویس اصلی که وظیفه مدیریت ورود به پنل‌های cPanel و WHM را برعهده دارد، دیمن <code>cpsrvd</code> است. فرایند لاگین در این سرویس به این شکل طراحی شده بود که قبل از تایید نهایی رمز عبور، یک <strong>فایل نشست (Session File) موقت</strong> روی دیسک ایجاد می‌کرد.</p>

<p>آسیب‌پذیری دقیقاً در مرحله پردازش هدر <code>Authorization: Basic</code> رخ می‌دهد. مهاجم می‌تواند محتوای این هدر را پیش از ارسال به سرور دستکاری کند. مشکل اینجاست که <code>cpsrvd</code> در نسخه‌های آسیب‌پذیر، هدرهای HTTP را به درستی <strong>Sanitize</strong> (پاک‌سازی) نمی‌کند.</p>

<blockquote class="security-quote">
«بزرگترین اشتباه در معماری cpsrvd این بود که محتوای فیلد رمز عبور را بدون فیلتر کردن کاراکترهای کنترلی، مستقیماً وارد فرایند ساخت فایل سشن موقت می‌کرد. این یک دعوت‌نامه باز برای حملات Injection بود.»
<br/><br/>
<strong>— گزارش تحلیل فنی، تیم تحقیقاتی watchTowr</strong>
</blockquote>

<h3>تشریح حمله تزریق CRLF</h3>
<p>حمله CRLF زمانی رخ می‌دهد که مهاجم کاراکترهای <code>\r\n</code> (بازگشت به ابتدای خط و خط جدید) را در یک ورودی متنی وارد کند. در فایل‌های متنی لینوکس، این کاراکترها نشان‌دهنده پایان یک خط و شروع خط بعدی هستند.</p>

<p>در جریان این اکسپلویت، مهاجم یک درخواست لاگین با هدری مشابه زیر ارسال می‌کند:</p>

<pre><code class="language-http">GET / HTTP/1.1
Host: target-server.com:2087
Authorization: Basic YWRtaW46cGFzc3dvcmRcclxudXNlcj1yb290</code></pre>

<p>عبارت <code>YWRtaW46cGFzc3dvcmRcclxudXNlcj1yb290</code> در واقع فرمت Base64 شده رشته زیر است:</p>

<pre><code class="language-plaintext">admin:password\r\nuser=root</code></pre>

<p>هنگامی که <code>cpsrvd</code> این هدر را دیکد می‌کند و رشته را در فایل نشست موقت می‌نویسد، به دلیل وجود <code>\r\n</code>، سیستم آن را به عنوان <strong>دو خط مجزا</strong> تفسیر می‌کند:</p>

<pre><code class="language-ini">password=password
user=root</code></pre>

<p>با این ترفند ساده، مهاجم موفق شده است ویژگی <code>user=root</code> را به فایل نشست تزریق کند. حالا تنها کاری که باید انجام شود، فراخوانی مجدد این نشست است. سیستم فایل سشن را می‌خواند، می‌بیند که <code>user=root</code> تنظیم شده است، و بدون نیاز به تایید رمز عبور، دسترسی بالاترین سطح لینوکس (Root) را به مهاجم تقدیم می‌کند!</p>

<h2>زنجیره حمله (Attack Chain) در دنیای واقعی</h2>

<div class="security-alert">
  <div class="alert-title">⚠ بهره‌برداری فعال — اکسپلویت‌شدن پیش از افشاء</div>
  <p>تحقیقات نشان می‌دهد که مهاجمان (احتمالاً گروه‌های APT دولتی و باج‌افزاری) از <strong>اسفند ۱۴۰۴ (فوریه ۲۰۲۶)</strong> — هفته‌ها پیش از افشاء عمومی — به طور فعال از این Zero-Day استفاده می‌کرده‌اند.</p>
</div>

<p>زنجیره حمله معمولاً شامل این ۴ مرحله است:</p>

<ol>
  <li><strong>اسکن گسترده (Mass Scanning):</strong> مهاجمان اینترنت را برای پورت‌های باز <code>2083</code> (cPanel) و <code>2087</code> (WHM) اسکن می‌کنند.</li>
  <li><strong>تزریق هدر مخرب:</strong> با ارسال یک درخواست HTTP که هدر <code>Authorization</code> آن آلوده به <code>\r\n</code> است، نشست جعلی ساخته می‌شود.</li>
  <li><strong>دریافت Session Token:</strong> سرور یک توکن نشست معتبر بازمی‌گرداند.</li>
  <li><strong>اجرای کد از راه دور (RCE):</strong> مهاجم با استفاده از توکن روت، وارد WHM شده و فوراً یک Web Shell آپلود می‌کند یا اسکریپت باج‌افزار را روی تمام اکانت‌های هاستینگ اجرا می‌کند.</li>
</ol>

<h2>گستردگی و دامنه تاثیر (Impact Scope)</h2>
<p>این آسیب‌پذیری یکی از بالاترین امتیازات <strong>CVSS (معادل ۹.۸ از ۱۰)</strong> را به خود اختصاص داد. دلیل این امتیاز بالا، سادگی اکسپلویت (بدون نیاز به هیچ‌گونه تعامل کاربر یا پیش‌نیاز خاص) و سطح دسترسی نهایی (Root) است.</p>

<p>نسخه‌های آسیب‌پذیر شامل تمام ورژن‌های cPanel &amp; WHM بعد از نسخه <strong>11.40</strong> می‌شدند. این شامل سرویس‌های جانبی مثل <em>DNSOnly</em> و <em>WP Squared</em> نیز می‌شد. در زمان انتشار پچ، موتورهای جستجوی اینترنت اشیا مانند Shodan نشان می‌دادند که بیش از یک میلیون سرور در سطح جهان در معرض خطر فوری قرار دارند.</p>

<h2>راهکارهای مقابله و کاهش خطرات (Mitigation)</h2>
<p>سازمان <strong>CISA</strong> فوراً این آسیب‌پذیری را به کاتالوگ <strong>KEV (Known Exploited Vulnerabilities)</strong> خود اضافه کرد و به تمام سازمان‌های دولتی آمریکا دستور داد تا ظرف ۴۸ ساعت سرورهای خود را آپدیت کنند. در ایران نیز مرکز ماهر هشدارهای مشابهی صادر کرد.</p>

<h3>۱. اعمال پچ فوری (اولین و مهم‌ترین قدم)</h3>
<p>شرکت WebPros (مالک cPanel) پچ‌های امنیتی را برای شاخه‌های مختلف منتشر کرد. مدیران سرور باید مطمئن شوند که حداقل به یکی از نسخه‌های زیر به‌روزرسانی کرده‌اند:</p>

<ul>
  <li><code>11.136.0.5</code> — شاخه اصلی (Stable)</li>
  <li><code>11.134.0.20</code> — شاخه LTS</li>
  <li><code>11.132.0.29</code></li>
  <li><code>11.130.0.19</code></li>
</ul>

<h3>۲. محدودسازی دسترسی شبکه (Workarounds)</h3>
<p>اگر به هر دلیلی آپدیت سرور بلافاصله مقدور نیست، باید پورت‌های cPanel و WHM را از طریق فایروال لینوکس (مانند <code>iptables</code> یا <code>firewalld</code>) مسدود کنید و دسترسی را <strong>فقط به IPهای تایید شده مدیران (Whitelisting)</strong> محدود نمایید:</p>

<pre><code class="language-bash"># مسدود کردن پورت‌های cPanel/WHM از اینترنت عمومی
iptables -I INPUT -p tcp --dport 2083 -j DROP
iptables -I INPUT -p tcp --dport 2087 -j DROP
iptables -I INPUT -p tcp --dport 2095 -j DROP
iptables -I INPUT -p tcp --dport 2096 -j DROP

# اجازه دسترسی فقط از IP مدیر
iptables -I INPUT -s YOUR_ADMIN_IP -p tcp --dport 2087 -j ACCEPT</code></pre>

<h3>۳. شکار تهدید (Threat Hunting)</h3>
<p>اگر نگران هستید که سرور شما پیش از اعمال پچ هک شده باشد، این موارد را بررسی کنید:</p>
<ul>
  <li>بررسی مسیر <code>/var/cpanel/sessions/raw/</code> برای یافتن فایل‌های نشست مشکوک.</li>
  <li>تحلیل لاگ‌های <code>cpsrvd</code> به دنبال هدرهای <code>Authorization</code> با طول غیرعادی یا حاوی کاراکترهای اسکی‌نشده.</li>
  <li>بررسی لاگ کاربران جدید ساخته شده در سطح لینوکس (فایل <code>/etc/passwd</code>).</li>
</ul>

<p>همچنین می‌توانید با دستور زیر لاگ‌های cpsrvd را برای الگوی حمله فیلتر کنید:</p>

<pre><code class="language-bash">grep -aP '[\\r\\n].*user=root' /var/log/cpanel/error_log
grep -aP 'Authorization: Basic [A-Za-z0-9+/]{50,}' /usr/local/cpanel/logs/access_log</code></pre>

<h2>درس‌هایی برای آینده معماری نرم‌افزار</h2>
<p>آسیب‌پذیری <strong>CVE-2026-41940</strong> یک یادآوری تلخ برای مهندسان نرم‌افزار است: <strong>هرگز به ورودی‌های کاربر اعتماد نکنید، حتی در هدرهای استاندارد HTTP.</strong></p>

<p>نوشتن مستقیم داده‌های کنترل‌نشده در فایل‌های سیستمی یک ضدالگو (Anti-Pattern) کلاسیک است که در سال ۲۰۲۶ همچنان قربانی می‌گیرد. معماری‌های مدرن باید از پارسرهای ساختاریافته (مثل JSON یا دیتابیس‌های موقت NoSQL) برای مدیریت نشست‌ها استفاده کنند، جایی که کاراکترهایی مثل <code>\n</code> نمی‌توانند ساختار داده را بشکنند.</p>

<p>تکناو به تمامی مدیران زیرساخت توصیه می‌کند روند به‌روزرسانی سیستم‌عامل و کنترل‌پنل‌های خود را به صورت کاملاً خودکار (Unattended Upgrades) تنظیم کنند، زیرا در دوران Agentic AI، فاصله بین افشای یک آسیب‌پذیری تا اکسپلویت شدن انبوه سرورها به <strong>کمتر از چند ساعت</strong> رسیده است.</p>
`;
