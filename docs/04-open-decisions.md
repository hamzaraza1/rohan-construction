# 4. Decisions needed from you

Each item below includes the default I have implemented or will implement. Reply with any
changes. None of them blocks Phase 2, but **D1–D4 affect Phases 3–6**.

| # | Question | Default |
|---|---|---|
| **D1** | **Material bought with cash from a walk-in shop** (e.g. a few bags of cement from a local shop). Should it (a) go through Suppliers + Inventory as a "cash supplier" (receipt + payment on the same day), or (b) be a plain *Material Purchase* expense that is not tracked in inventory? | Both are allowed. Use (b) only for small consumables. Anything you want in stock goes through (a). The Suppliers screen will offer a one-step "cash purchase" (receipt + payment). |
| **D2** | **When is contractor work counted as project cost?** Contractor payments (including advances) count as cost when paid. The alternative is contract value × progress %, which is subjective. | Count it when paid. This affects **commission projects** (commission = % of cost). |
| **D3** | **Commission projects: what is commission charged on?** Cost = material received + contractor payments + direct expenses. Should supplier *advances* (paid, but no material yet) be included? | Not included until the material is received. |
| **D4** | **Labour Rate projects:** do you need to record the agreed labour rates and measured quantities (e.g. brickwork 1,200 sq.ft × Rs. 45) to calculate what the client owes? | Not in the initial scope. Labour Rate projects track labour/contractor payments and expenses, plus an optional total agreed amount with the client. This can be added later as a "rate items" table. |
| D5 | Should a client payment ever be split across two projects? | No. Record one payment per project. |
| D6 | Supplier returns / discounts / damaged deliveries: needed now? | Handled by voiding and re-entering the receipt with the correct quantity. A dedicated "supplier credit note" can be added later. |
| D7 | Names and logins for the two other partners. | Add them in Settings → Users (read-only) and Settings → Partners. |
| D8 | Off-site backup destination (Google Drive, Backblaze B2, another server…). **Required**, because a backup kept only on the VPS does not survive loss of the VPS. | Choose one. `rclone` supports all of them. |
| D9 | Domain name. A self-signed IP certificate makes browsers show a warning, and Let's Encrypt needs a domain. A domain costs about Rs. 3,000 a year. | Use `https://<VPS-IP>` with `tls internal` until a domain is bought. |
| D10 | Fiscal year / report periods (July–June in Pakistan?) | Reports take any date range, with a July–June preset. |
