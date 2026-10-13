# ACI Distribution Expense demo

Buildless responsive web demo (Bangla by default, English via the language switch; phone, tablet and desktop layouts) based on expense.xlsx and the supplied conversation.

Files: `index.html`, `style.css`, `app.js` (logic), `i18n.js` (Bangla/English strings and Bangla names for depots, businesses and expense heads).

Run: `python3 -m http.server 4173 --directory public`
Deploy `public` as a static directory on Vercel. No backend, credentials or real ACI transactions are included.

Management: date/depot/business/head filters, totals, day comparison, 12-month trend, depot ranking.
HQ: searchable paginated register, CSV export and depot reporting status.
Manage (Management/HQ): add depots, expense heads (with optional Bangla names) and monthly subscriptions (recurring expenses that post automatically on a chosen day). Stored in localStorage (`aci-custom-v1`).
Depot: depot dropdown preselected to Jashore, bilingual expense form, draft/edit/submit workflow.

Lists are extracted from the workbook. Generated transactions cover November 2025–October 14, 2026. Browser localStorage persists demo edits. Role switching demonstrates personas rather than access control. Clear labelling distinguishes demo fixtures from real data.

Before production: confirm Beanpole/Benapole naming, depot-business assignments, reporting calendar, integration/API details, access control and audit requirements. CSV exports include provenance.
