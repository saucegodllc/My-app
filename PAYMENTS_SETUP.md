# ConnectSphere Payments Setup

ConnectSphere Plus currently uses the three-plan Stripe offer shown in the Premium screen:

| Plan key | Price | Billing period | Render env var |
|---|---:|---|---|
| `monthly` | $14.99 | Every 2 weeks | `STRIPE_PRICE_MONTHLY` |
| `sixmonth` | $150.00 | Every 6 months | `STRIPE_PRICE_SIXMONTH` |
| `yearly` | $300.00 | Every year | `STRIPE_PRICE_YEARLY` |

Do not paste `sk_live_...` keys in chat or commit them. Use one of the local runners:

```powershell
.\scripts\run-stripe-setup.ps1
```

```bash
bash scripts/run-stripe-setup.sh
```

The setup script prints these safe public price IDs:

```text
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_SIXMONTH=price_...
STRIPE_PRICE_YEARLY=price_...
```

Paste those into Render -> API server -> Environment with:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_SIXMONTH=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=https://connectsphere-api.onrender.com
APP_SCHEME=connectsphere
```

Then redeploy the API server and test checkout from the Premium screen.
