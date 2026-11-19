/**
 * Kodulehele paigaldatav skript:
 * <script src="https://app.aegly.ee/w/aegly.js" data-salon="studio-lumi" async></script>
 * Lisab nurka "Broneeri aeg" nupu (W0); klõps avab vidina paneelina (arvutis paremal, telefonis täisekraanil).
 * Iga element lehel atribuudiga data-aegly-open avab samuti vidina.
 */
const SCRIPT = String.raw`(function () {
  if (window.__aegly) return; window.__aegly = true;
  var me = document.currentScript || document.querySelector('script[data-salon]');
  if (!me) return;
  var base = new URL(me.src).origin, salon = me.getAttribute('data-salon'), label = me.getAttribute('data-button');
  var hideButton = me.getAttribute('data-launcher') === 'false';
  if (!salon) return console.warn('[Aegly] data-salon puudub');
  var root, frame, overlay, lastFocus;
  function css(el, s) { for (var k in s) el.style[k] = s[k]; }
  function mobile() { return window.matchMedia('(max-width: 640px)').matches; }
  function open() {
    lastFocus = document.activeElement;
    if (!overlay) {
      overlay = document.createElement('div');
      css(overlay, { position: 'fixed', inset: '0', background: 'rgba(16,24,40,.45)', zIndex: '2147483646', opacity: '0', transition: 'opacity .2s' });
      overlay.addEventListener('click', close);
      frame = document.createElement('iframe');
      frame.src = base + '/w/' + encodeURIComponent(salon) + '?embed=1';
      frame.title = 'Broneeri aeg';
      frame.setAttribute('allow', 'payment');
      document.body.appendChild(overlay); document.body.appendChild(frame);
    }
    var m = mobile();
    css(frame, { position: 'fixed', zIndex: '2147483647', border: '0', background: '#fff', boxShadow: '0 24px 60px rgba(16,24,40,.25)',
      top: m ? '0' : '16px', right: m ? '0' : '16px', bottom: m ? '0' : '16px', width: m ? '100%' : '440px', height: m ? '100%' : 'calc(100% - 32px)',
      borderRadius: m ? '0' : '20px', display: 'block' });
    overlay.style.display = 'block';
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
    document.documentElement.style.overflow = 'hidden';
    frame.focus();
  }
  function close() {
    if (!frame) return;
    frame.style.display = 'none'; overlay.style.opacity = '0'; overlay.style.display = 'none';
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== base || !e.data) return;
    if (e.data.type === 'aegly:close') close();
    // ettemaks: Stripe'i makseleht avatakse kogu aknas (iframe'is see ei tööta)
    if (e.data.type === 'aegly:redirect' && typeof e.data.url === 'string' && e.data.url.indexOf('https://checkout.stripe.com/') === 0) window.location.href = e.data.url;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-aegly-open]'); if (t) { e.preventDefault(); open(); } });
  window.Aegly = { open: open, close: close };
  if (hideButton) return;
  fetch(base + '/w/' + encodeURIComponent(salon) + '/config').then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (!c) return;
    root = document.createElement('button');
    root.type = 'button';
    root.textContent = label || c.buttonText || 'Broneeri aeg';
    root.setAttribute('aria-haspopup', 'dialog');
    css(root, { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483645', height: '52px', padding: '0 22px', border: '0', borderRadius: '999px',
      background: c.primary, color: c.buttonColor, font: '600 15px/1 system-ui,-apple-system,Segoe UI,sans-serif', cursor: 'pointer', boxShadow: '0 10px 30px rgba(16,24,40,.25)' });
    root.addEventListener('click', open);
    document.body.appendChild(root);
  });
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
