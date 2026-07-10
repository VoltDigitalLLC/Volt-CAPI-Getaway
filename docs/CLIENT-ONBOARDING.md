# Client Onboarding Checklist — Volt CAPI Gateway

Repeatable steps to add a new client to the server-side Conversions API gateway.
No code changes required — each client is one Supabase row plus GoHighLevel config.

**Gateway base URL:** `https://volt-capi-getaway-six.vercel.app`
**Endpoint pattern:** `https://volt-capi-getaway-six.vercel.app/api/capi/{CLIENT_ID}`

---

## How it works (30-second version)

```
GHL landing page
 ├─ Meta Pixel (PageView)        → sets _fbp cookie
 └─ Capture script               → fills hidden fields: fbc, fbp, event_id, user_agent, ip

GHL form/survey submitted
 └─ Workflow → Webhook → gateway → hashes PII → Meta Conversions API
```

The **Lead fires server-side** on form submission. There is **no browser Lead event** — do not
add `fbq('track','Lead')` anywhere (it causes double-counting).

---

## Per-client checklist

### 1. Meta — get credentials
- [ ] Open the client's **Events Manager** → their dataset.
- [ ] Copy the **Dataset (Pixel) ID**.
- [ ] Settings → **Conversions API** → **Generate access token**. Copy it (secret).
- [ ] Test Events tab → copy the **test event code** (e.g. `TEST12345`) for setup.

### 2. Supabase — add the client row
Run in the SQL editor (replace the three values):
```sql
insert into public.capi_clients (name, pixel_id, access_token, test_event_code)
values (
  'CLIENT NAME',
  'THEIR_PIXEL_ID',
  'THEIR_ACCESS_TOKEN',
  'THEIR_TEST_CODE'
)
returning id;
```
- [ ] Copy the returned **`id`** — this is their `{CLIENT_ID}` for the webhook URL.

### 3. GHL landing page — head tracking code
In the funnel: **Settings → Tracking Code → Head**.

- [ ] Paste the **Meta Pixel base code** with the client's pixel id:
```html
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'THEIR_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

- [ ] Paste the **capture script** below it (universal — never changes between clients):
```html
<script>
(function () {
  function getCookie(n) {
    var m = document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }
  var params = new URLSearchParams(location.search);
  var fbclid = params.get('fbclid');
  var fbc = getCookie('_fbc');
  if (!fbc && fbclid) fbc = 'fb.1.' + Date.now() + '.' + fbclid;

  var values = {
    fbc: fbc,
    fbp: getCookie('_fbp'),
    event_id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
              : String(Date.now()) + '.' + Math.random(),
    user_agent: navigator.userAgent,
    ip: ''
  };

  function setValue(el, val) {
    var win = el.ownerDocument.defaultView;
    var setter = Object.getOwnPropertyDescriptor(
      win.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(el, val || '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function allDocs(root){
    var list=[root];
    root.querySelectorAll('iframe').forEach(function(f){
      try{ if(f.contentDocument) list=list.concat(allDocs(f.contentDocument)); }catch(e){}
    });
    return list;
  }

  function apply() {
    allDocs(document).forEach(function (doc) {
      Object.keys(values).forEach(function (key) {
        if (!values[key]) return;
        doc.querySelectorAll('input[data-q="' + key + '"]').forEach(function (el) {
          if (el.value !== values[key]) setValue(el, values[key]);
        });
      });
    });
  }

  setInterval(apply, 600);

  fetch('https://api.ipify.org?format=json')
    .then(function (r) { return r.json(); })
    .then(function (d) { values.ip = d.ip; })
    .catch(function () {});
})();
</script>
```

### 4. GHL form/survey — hidden fields
- [ ] Create 5 **custom fields** (Text) named exactly: `fbc`, `fbp`, `event_id`, `user_agent`, `ip`.
- [ ] Add all 5 to the form/survey as **hidden fields**.
- [ ] **On surveys:** put them on the **first step** so they render at page load.
- [ ] Leave **Hidden value blank** and **not required** (fbc is empty for non-ad traffic — required would block submits).
- [ ] Make sure the visible **zip** field maps to the standard **Postal Code** contact field.

> The capture script matches fields by their `data-q="<name>"` attribute (GHL sets this to the
> field name), so naming the fields exactly as above is what makes the universal script work.

### 5. GHL workflow — fire the Lead
- [ ] **Automation → Workflows → Create Workflow**.
- [ ] Trigger: **Form Submitted** → filter to the specific form.
- [ ] Action: **Webhook**
  - Method: `POST`
  - URL: `https://volt-capi-getaway-six.vercel.app/api/capi/{CLIENT_ID}`
  - **Custom Data:**

    | Key | Value |
    |-----|-------|
    | `event_name` | `Lead` |
    | `first_name` | `{{contact.first_name}}` |
    | `last_name` | `{{contact.last_name}}` |
    | `phone` | `{{contact.phone}}` |
    | `zip` | `{{contact.postal_code}}` |
    | `fbc` | `{{contact.fbc}}` |
    | `fbp` | `{{contact.fbp}}` |
    | `event_id` | `{{contact.event_id}}` |
    | `user_agent` | `{{contact.user_agent}}` |
    | `ip` | `{{contact.ip}}` |
- [ ] Workflow **Settings → enable "Allow Re-Entry"** (so every submission fires).
- [ ] **Publish** the workflow.

### 6. Test (while test code is set)
- [ ] Open the live page, hard-refresh. In the console, confirm capture:
  ```js
  ['fbp','ip','user_agent','event_id','fbc'].map(function(k){
    var el=document.querySelector('input[data-q="'+k+'"]');
    return k+' = "'+(el?el.value:'??')+'"';
  });
  ```
  Expect fbp/ip/user_agent/event_id filled (fbc empty unless `?fbclid=test123`).
- [ ] Submit with a **fresh name + phone**, watch **Meta Test Events** (keep tab open — it only
      shows events that arrive while watching).
- [ ] Confirm the Lead shows: First name, Last name, Phone, ZIP, Browser id (fbp), IP, User agent.

### 7. Go live
- [ ] Clear the test code so events count as real conversions:
  ```sql
  update public.capi_clients set test_event_code = null
  where id = 'THE_CLIENT_ID';
  ```
- [ ] Events now appear in the **Events / Overview** tab (delayed), not Test Events.

---

## Troubleshooting (lessons already learned)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Event not in Test Events | Test Events only shows events arriving **while watching**; or the tab's code ≠ the stored `test_event_code` | Keep the tab open; confirm the code matches the DB row |
| Only name/phone/zip send; hidden fields empty on contact | Capture script not filling fields | Confirm fields match by `data-q`; check they're on step 1; hard-refresh |
| Hidden fields empty, `NOT FOUND` in console | Wrong selector — GHL uses random `name`, but a stable `data-q="<field>"` | Script already matches `data-q` |
| Form submit doesn't fire the workflow | GHL blocks workflow **re-entry** for an existing contact | Enable "Allow Re-Entry", or test with a new phone/name |
| Values won't "stick" | GHL forms are Vue-based; plain `el.value=` is ignored | Script fires `input`/`change` events (already handled) |
| `permission denied for table capi_clients` | `service_role` lacks grant (auto-expose is off) | `grant select on public.capi_clients to service_role;` |
| "Deduplicated" in Test Events | Same `event_id` received more than once (repeat testing) — this is Meta protecting you | Fine. Don't add a browser Lead event |
| Double-counted leads | A browser `fbq('track','Lead')` + the server Lead with different event_ids | Remove all browser Lead snippets; server is the only Lead |

## Match parameters sent
`ph` (phone), `fn`/`ln` (name), `zp` (zip), `fbp`, `fbc` (ad traffic only), `client_ip_address`,
`client_user_agent`. Add `em` (email) to the webhook as `email` if a client's form collects it.

## Server field aliases (what the webhook can send)
- Name: `first_name` + `last_name`, or a single `full_name` (auto-split).
- Zip: `zip`, `zip_code`, or `postal_code`.
- Value (optional): `value` + `currency` (omit for value-free Leads).
